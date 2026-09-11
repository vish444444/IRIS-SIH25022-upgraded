import { Request, Response, NextFunction } from "express";
import { TrackStatusService } from "../services/simulation/trackStatusService";
import { TrackClosureRequest } from "../Interfaces/simulation/trackStatus.interface";
import * as fs from "fs";
import * as path from "path";

export class TrackStatusController {
  private trackStatusService: TrackStatusService;

  constructor() {
    this.trackStatusService = TrackStatusService.getInstance();
  }

  /**
   * POST /api/status/track-closure
   * Receive track closure status and trigger rerouting
   */
  updateTrackClosure = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const request: TrackClosureRequest = req.body;

      // Validate required fields
      if (!request.station_from || typeof request.station_from !== "string") {
        res.status(400).json({ error: "station_from is required and must be a string" });
        return;
      }

      if (!request.station_to || typeof request.station_to !== "string") {
        res.status(400).json({ error: "station_to is required and must be a string" });
        return;
      }

      if (!request.track_type || !["slow", "fast"].includes(request.track_type)) {
        res.status(400).json({ error: "track_type is required and must be 'slow' or 'fast'" });
        return;
      }

      if (!request.direction || !["up", "down"].includes(request.direction)) {
        res.status(400).json({ error: "direction is required and must be 'up' or 'down'" });
        return;
      }

      if (!request.status || !["closed", "open"].includes(request.status)) {
        res.status(400).json({ error: "status is required and must be 'closed' or 'open'" });
        return;
      }

      // Update track status
      const closure = this.trackStatusService.updateTrackStatus(request);

      res.status(200).json({
        success: true,
        message: `Track status updated: ${request.station_from} to ${request.station_to} ${request.track_type} track (${request.direction}) is now ${request.status}`,
        closure,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/track-closures
   * Get all active track closures
   */
  getActiveClosures = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const closures = this.trackStatusService.getActiveClosures();

      res.status(200).json({
        success: true,
        count: closures.length,
        closures,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/track-closure/:id
   * Get a specific track closure by ID
   */
  getClosureById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { id } = req.params;
      const closure = this.trackStatusService.getClosure(id);

      if (!closure) {
        res.status(404).json({
          success: false,
          error: `Track closure with ID ${id} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        closure,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/stations
   * Get list of available stations from track data
   */
  getStations = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Read track data from JSON file
      // Handle both development and production paths
      const possiblePaths = [
        path.join(__dirname, "../services/simulation/sampleTrackData.json"),
        path.join(process.cwd(), "src/services/simulation/sampleTrackData.json"),
        path.join(process.cwd(), "api/src/services/simulation/sampleTrackData.json"),
      ];
      
      let trackDataPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!trackDataPath) {
        res.status(500).json({ error: "Track data file not found" });
        return;
      }
      
      const trackData = JSON.parse(fs.readFileSync(trackDataPath, "utf-8"));

      // Extract station names
      const stations = Object.keys(trackData).map((stationName) => ({
        name: stationName,
        id: trackData[stationName].id,
        lat: trackData[stationName].lat,
        lng: trackData[stationName].lng,
        availableTracks: Object.keys(trackData[stationName].tracks || {}).map((trackKey) => {
          const track = trackData[stationName].tracks[trackKey];
          // Parse track type and direction from key (e.g., "up_slow", "down_fast")
          const parts = trackKey.split("_");
          const direction = parts[0] as "up" | "down";
          const trackType = parts.slice(1).join("_") as string;
          
          return {
            key: trackKey,
            direction,
            trackType: trackType.includes("slow") ? "slow" : trackType.includes("fast") ? "fast" : "unknown",
            next: track.next || [],
          };
        }),
      }));

      res.status(200).json({
        success: true,
        stations,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/status/track-info
   * Get track information (connections between stations)
   */
  getTrackInfo = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Read track data from JSON file
      // Handle both development and production paths
      const possiblePaths = [
        path.join(__dirname, "../services/simulation/sampleTrackData.json"),
        path.join(process.cwd(), "src/services/simulation/sampleTrackData.json"),
        path.join(process.cwd(), "api/src/services/simulation/sampleTrackData.json"),
      ];
      
      let trackDataPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!trackDataPath) {
        res.status(500).json({ error: "Track data file not found" });
        return;
      }
      
      const trackData = JSON.parse(fs.readFileSync(trackDataPath, "utf-8"));

      // Build track connections map
      const connections: Array<{
        from: string;
        to: string;
        trackType: "slow" | "fast";
        direction: "up" | "down";
      }> = [];

      Object.keys(trackData).forEach((stationName) => {
        const station = trackData[stationName];
        if (station.tracks) {
          Object.keys(station.tracks).forEach((trackKey) => {
            const track = station.tracks[trackKey];
            const parts = trackKey.split("_");
            const direction = parts[0] as "up" | "down";
            const trackType = parts.slice(1).join("_");
            
            const normalizedTrackType: "slow" | "fast" = 
              trackType.includes("slow") ? "slow" : 
              trackType.includes("fast") ? "fast" : 
              "slow"; // default to slow

            if (track.next && Array.isArray(track.next)) {
              track.next.forEach((nextTrack: string) => {
                // Extract destination station from track name (e.g., "GHATKOPAR.up_slow" -> "GHATKOPAR")
                const nextStation = nextTrack.split(".")[0];
                connections.push({
                  from: stationName,
                  to: nextStation,
                  trackType: normalizedTrackType,
                  direction,
                });
              });
            }
          });
        }
      });

      res.status(200).json({
        success: true,
        connections,
      });
    } catch (error) {
      next(error);
    }
  };
}
