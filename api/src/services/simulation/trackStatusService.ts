import {
  TrackClosureStatus,
  TrackClosureRequest,
  TrackStatusStore,
  TrackType,
  Direction,
} from "../../Interfaces/simulation/trackStatus.interface";

/**
 * Service to manage track closure status
 * Note: Train rerouting is handled by the simulator, not the API
 */
export class TrackStatusService {
  private static instance: TrackStatusService;
  private store: TrackStatusStore;

  private constructor() {
    this.store = {
      closures: new Map<string, TrackClosureStatus>(),
      lastUpdated: new Date(),
    };
  }

  static getInstance(): TrackStatusService {
    if (!TrackStatusService.instance) {
      TrackStatusService.instance = new TrackStatusService();
    }
    return TrackStatusService.instance;
  }

  /**
   * Update track closure status
   */
  updateTrackStatus(request: TrackClosureRequest): TrackClosureStatus {
    const id = this.generateClosureId(
      request.station_from,
      request.station_to,
      request.track_type,
      request.direction
    );

    const closure: TrackClosureStatus = {
      id,
      station_from: request.station_from,
      station_to: request.station_to,
      track_type: request.track_type,
      direction: request.direction,
      status: request.status,
      timestamp: new Date(),
      description: request.description,
    };

    if (request.status === "closed") {
      this.store.closures.set(id, closure);
    } else {
      // Remove closure if status is "open"
      this.store.closures.delete(id);
    }

    this.store.lastUpdated = new Date();

    // Note: Train rerouting is handled by the simulator, not the API

    return closure;
  }

  /**
   * Get all active closures
   */
  getActiveClosures(): TrackClosureStatus[] {
    return Array.from(this.store.closures.values());
  }

  /**
   * Get closure by ID
   */
  getClosure(id: string): TrackClosureStatus | undefined {
    return this.store.closures.get(id);
  }

  /**
   * Check if a track segment is closed
   */
  isTrackClosed(
    stationFrom: string,
    stationTo: string,
    trackType: TrackType,
    direction: Direction
  ): boolean {
    const id = this.generateClosureId(stationFrom, stationTo, trackType, direction);
    return this.store.closures.has(id);
  }

  /**
   * Get affected pipeline IDs for a track closure
   * Returns empty array since pipeline graph is not available
   * (Rerouting is handled by the simulator)
   */
  getAffectedPipelines(closure: TrackClosureStatus): string[] {
    // Pipeline information is managed by the simulator, not the API
    return [];
  }

  /**
   * Helper: Generate closure ID
   */
  private generateClosureId(
    stationFrom: string,
    stationTo: string,
    trackType: TrackType,
    direction: Direction
  ): string {
    return `${stationFrom.toUpperCase()}_${stationTo.toUpperCase()}_${trackType}_${direction}`;
  }
}

