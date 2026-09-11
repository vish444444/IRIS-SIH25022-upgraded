import { Request, Response, NextFunction } from "express";
import { SectorBlockageService } from "../services/simulation/sectorBlockageService";
import { SectorBlockageRequest } from "../Interfaces/simulation/sectorBlockage.interface";
import { AuthenticatedRequest } from "../middleware/rbac.middleware";
import auditLogRepository from "../db/repositories/auditLogRepository";
import * as fs from "fs";
import * as path from "path";

const getClientIP = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

export class SectorBlockageController {
  private sectorBlockageService: SectorBlockageService;

  constructor() {
    this.sectorBlockageService = SectorBlockageService.getInstance();
  }

  /**
   * POST /api/status/sector-blockage
   * Report sector blockage
   */
  reportBlockage = (req: Request | AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const request: SectorBlockageRequest = req.body;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      // Validate required fields
      if (!request.sector_id || typeof request.sector_id !== "string") {
        res.status(400).json({ error: "sector_id is required and must be a string" });
        return;
      }

      if (!request.status || !["blocked", "open"].includes(request.status)) {
        res.status(400).json({ error: "status is required and must be 'blocked' or 'open'" });
        return;
      }

      // Report blockage
      const blockage = this.sectorBlockageService.reportBlockage(request);

      // Create audit log entry
      const action = request.status === "blocked" ? "sector.block" : "sector.unblock";
      auditLogRepository.create({
        actor_id: userId || undefined,
        action: action,
        resource: `sector:${request.sector_id}`,
        details: {
          sector_id: request.sector_id,
          status: request.status,
          reason: request.reason || null,
          reported_by: request.reported_by || (userId ? authReq.user?.email : "system"),
        },
        ip: getClientIP(req),
      });

      res.status(200).json({
        success: true,
        message: `Sector ${request.sector_id} is now ${request.status}`,
        blockage,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/sector-blockages
   * Get all blocked sectors
   */
  getBlockedSectors = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const blockages = this.sectorBlockageService.getBlockedSectors();

      res.status(200).json({
        success: true,
        count: blockages.length,
        blockages,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /api/status/sector-blockage/:sectorId
   * Remove sector blockage
   */
  removeBlockage = (req: Request | AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      const { sectorId } = req.params;
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;

      if (!sectorId) {
        res.status(400).json({
          success: false,
          error: "sectorId parameter is required",
        });
        return;
      }

      // Get blockage info before removing (for audit log)
      const blockage = this.sectorBlockageService.getBlockage(sectorId);

      const removed = this.sectorBlockageService.removeBlockage(sectorId);

      if (!removed) {
        res.status(404).json({
          success: false,
          error: `Sector blockage with ID ${sectorId} not found`,
        });
        return;
      }

      // Create audit log entry
      auditLogRepository.create({
        actor_id: userId || undefined,
        action: "sector.unblock",
        resource: `sector:${sectorId}`,
        details: {
          sector_id: sectorId,
          status: "open",
          previous_reason: blockage?.reason || null,
          removed_by: userId ? authReq.user?.email : "system",
        },
        ip: getClientIP(req),
      });

      res.status(200).json({
        success: true,
        message: `Sector blockage ${sectorId} removed successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/sectors
   * Get list of available sectors (for form dropdown)
   */
  getSectors = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Read sectors data from JSON file
      const possiblePaths = [
        path.join(__dirname, "../services/simulation/sectors.json"),
        path.join(process.cwd(), "src/services/simulation/sectors.json"),
        path.join(process.cwd(), "api/src/services/simulation/sectors.json"),
      ];

      let sectorsPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!sectorsPath) {
        res.status(500).json({ error: "Sectors data file not found" });
        return;
      }

      const sectorsData = JSON.parse(fs.readFileSync(sectorsPath, "utf-8"));

      // Extract unique sectors with their metadata
      const sectors = sectorsData.map((sector: any) => ({
        sector_id: sector.sector_id,
        track_type: sector.track_type,
        from_station: sector.from_station,
        to_station: sector.to_station,
        next_station: sector.next_station,
        index: sector.index,
        lengthMeters: sector.lengthMeters,
      }));

      res.status(200).json({
        success: true,
        count: sectors.length,
        sectors,
      });
    } catch (error) {
      next(error);
    }
  };
}

