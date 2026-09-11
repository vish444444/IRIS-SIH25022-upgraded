import {
  SectorBlockageStatusData,
  SectorBlockageRequest,
  SectorBlockageStore,
  SectorBlockageStatus,
} from "../../Interfaces/simulation/sectorBlockage.interface";

/**
 * Service to manage sector blockage status
 * Note: Train rerouting is handled by the simulator, not the API
 */
export class SectorBlockageService {
  private static instance: SectorBlockageService;
  private store: SectorBlockageStore;

  private constructor() {
    this.store = {
      blockages: new Map<string, SectorBlockageStatusData>(),
      lastUpdated: new Date(),
    };
  }

  static getInstance(): SectorBlockageService {
    if (!SectorBlockageService.instance) {
      SectorBlockageService.instance = new SectorBlockageService();
    }
    return SectorBlockageService.instance;
  }

  /**
   * Report or remove sector blockage
   */
  reportBlockage(request: SectorBlockageRequest): SectorBlockageStatusData {
    const id = request.sector_id;

    const blockage: SectorBlockageStatusData = {
      id,
      sector_id: request.sector_id,
      status: request.status,
      reason: request.reason,
      reported_by: request.reported_by,
      timestamp: new Date(),
    };

    if (request.status === "blocked") {
      this.store.blockages.set(id, blockage);
    } else {
      // Remove blockage if status is "open"
      this.store.blockages.delete(id);
    }

    this.store.lastUpdated = new Date();

    return blockage;
  }

  /**
   * Get all blocked sectors
   */
  getBlockedSectors(): SectorBlockageStatusData[] {
    return Array.from(this.store.blockages.values());
  }

  /**
   * Get blockage by sector ID
   */
  getBlockage(sectorId: string): SectorBlockageStatusData | undefined {
    return this.store.blockages.get(sectorId);
  }

  /**
   * Remove blockage by sector ID
   */
  removeBlockage(sectorId: string): boolean {
    const removed = this.store.blockages.delete(sectorId);
    if (removed) {
      this.store.lastUpdated = new Date();
    }
    return removed;
  }

  /**
   * Check if a sector is blocked
   */
  isSectorBlocked(sectorId: string): boolean {
    return this.store.blockages.has(sectorId);
  }
}

