import {
  TrainReceiverPayload,
  StoredTrainData,
  TrainStoreState,
} from "../../Interfaces/receiver/trainReceiver.interface";

const SPEED_HISTORY_LIMIT = 10; // Keep last 10 speed readings for smoothing
const SMOOTHING_FACTOR = 0.3; // Exponential smoothing factor (0-1)
const SPEED_THRESHOLD = 0.5; // km/h - below this, train is considered stationary

export class TrainStore {
  private static instance: TrainStore;
  private trains: Map<string, StoredTrainData>;
  private lastUpdated: Date;
  private simulationRunning: boolean = true;

  private constructor() {
    this.trains = new Map();
    this.lastUpdated = new Date();
    this.simulationRunning = true;
  }

  isSimulationRunning(): boolean {
    return this.simulationRunning;
  }

  setSimulationRunning(running: boolean): void {
    this.simulationRunning = running;
    if (!running) {
      this.clear(); // Clear all trains when stopped!
    }
  }

  static getInstance(): TrainStore {
    if (!TrainStore.instance) {
      TrainStore.instance = new TrainStore();
    }
    return TrainStore.instance;
  }

  /**
   * Update or create a train entry with new data
   */
  upsertTrain(payload: TrainReceiverPayload): StoredTrainData {
    const existingTrain = this.trains.get(payload.train_id);
    const now = new Date();

    if (existingTrain) {
      // Update existing train
      const updatedTrain = this.updateExistingTrain(existingTrain, payload, now);
      this.trains.set(payload.train_id, updatedTrain);
      this.lastUpdated = now;
      return updatedTrain;
    } else {
      // Create new train entry
      const newTrain = this.createNewTrain(payload, now);
      this.trains.set(payload.train_id, newTrain);
      this.lastUpdated = now;
      return newTrain;
    }
  }

  /**
   * Create a new train entry
   */
  private createNewTrain(payload: TrainReceiverPayload, now: Date): StoredTrainData {
    return {
      train_id: payload.train_id,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
      type: payload.type,
      line_id: payload.line_id,
      destination: payload.destination,
      timestamp: payload.timestamp,
      trackType: payload.trackType,
      trackVariant: payload.trackVariant,
      laneIndex: payload.laneIndex,
      laneCount: payload.laneCount,
      sectorId: payload.sectorId,
      lastUpdateTime: now,
      smoothedSpeed: payload.speed,
      speedHistory: [{ speed: payload.speed, timestamp: payload.timestamp }],
      averageSpeed: payload.speed,
      isMoving: payload.speed > SPEED_THRESHOLD,
      timeSinceLastUpdate: 0,
    };
  }

  /**
   * Update an existing train with new data and compute derived values
   */
  private updateExistingTrain(
    existing: StoredTrainData,
    payload: TrainReceiverPayload,
    now: Date
  ): StoredTrainData {
    // Update speed history
    const speedHistory = [...existing.speedHistory, { speed: payload.speed, timestamp: payload.timestamp }];
    if (speedHistory.length > SPEED_HISTORY_LIMIT) {
      speedHistory.shift(); // Remove oldest entry
    }

    // Compute smoothed speed using exponential smoothing
    const smoothedSpeed =
      SMOOTHING_FACTOR * payload.speed + (1 - SMOOTHING_FACTOR) * existing.smoothedSpeed;

    // Compute average speed from history
    const averageSpeed =
      speedHistory.reduce((sum, entry) => sum + entry.speed, 0) / speedHistory.length;

    // Compute time since last update
    const timeSinceLastUpdate = now.getTime() - existing.lastUpdateTime.getTime();

    // Preserve lane/track metadata unless new values are provided
    const trackType = payload.trackType ?? existing.trackType;
    const trackVariant = payload.trackVariant ?? existing.trackVariant;
    const laneIndex =
      typeof payload.laneIndex === "number" ? payload.laneIndex : existing.laneIndex;
    const laneCount =
      typeof payload.laneCount === "number" ? payload.laneCount : existing.laneCount;
    const sectorId = payload.sectorId ?? existing.sectorId;

    return {
      train_id: payload.train_id,
      lat: payload.lat,
      lng: payload.lng,
      speed: payload.speed,
      type: payload.type,
      line_id: payload.line_id,
      destination: payload.destination,
      timestamp: payload.timestamp,
      trackType,
      trackVariant,
      laneIndex,
      laneCount,
      sectorId,
      lastUpdateTime: now,
      smoothedSpeed: Math.round(smoothedSpeed * 100) / 100, // Round to 2 decimals
      speedHistory,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      isMoving: payload.speed > SPEED_THRESHOLD,
      timeSinceLastUpdate,
    };
  }

  /**
   * Get a specific train by ID
   */
  getTrain(trainId: string): StoredTrainData | undefined {
    return this.trains.get(trainId);
  }

  /**
   * Get all trains currently in the store
   */
  getAllTrains(): StoredTrainData[] {
    return Array.from(this.trains.values());
  }

  /**
   * Get trains with updated time since last update values
   */
  getAllTrainsWithCurrentTimings(): StoredTrainData[] {
    const now = new Date();
    return Array.from(this.trains.values()).map((train) => ({
      ...train,
      timeSinceLastUpdate: now.getTime() - train.lastUpdateTime.getTime(),
    }));
  }

  /**
   * Get the current state of the train store
   */
  getState(): TrainStoreState {
    return {
      trains: this.trains,
      totalTrains: this.trains.size,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Remove a train from the store
   */
  removeTrain(trainId: string): boolean {
    return this.trains.delete(trainId);
  }

  /**
   * Remove stale trains that haven't updated in the specified time (ms)
   */
  removeStaleTrains(maxAge: number = 300000): string[] {
    const now = new Date();
    const removedTrains: string[] = [];

    for (const [trainId, train] of this.trains.entries()) {
      const age = now.getTime() - train.lastUpdateTime.getTime();
      if (age > maxAge) {
        this.trains.delete(trainId);
        removedTrains.push(trainId);
      }
    }

    return removedTrains;
  }

  /**
   * Clear all trains from the store
   */
  clear(): void {
    this.trains.clear();
    this.lastUpdated = new Date();
  }

  /**
   * Get count of trains by type
   */
  getTrainCountByType(): Record<string, number> {
    const counts: Record<string, number> = {
      slow: 0,
      fast: 0,
      womens: 0,
      ac: 0,
    };

    for (const train of this.trains.values()) {
      counts[train.type]++;
    }

    return counts;
  }

  /**
   * Get trains that are currently moving
   */
  getMovingTrains(): StoredTrainData[] {
    return Array.from(this.trains.values()).filter((train) => train.isMoving);
  }

  /**
   * Get trains that are stationary
   */
  getStationaryTrains(): StoredTrainData[] {
    return Array.from(this.trains.values()).filter((train) => !train.isMoving);
  }
}
