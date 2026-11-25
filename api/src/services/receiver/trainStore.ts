import {
  TrainReceiverPayload,
  StoredTrainData,
  TrainStoreState,
} from "../../Interfaces/receiver/trainReceiver.interface";

const SPEED_HISTORY_LIMIT = 15; // Keep last 15 speed readings for smoothing
const SMOOTHING_FACTOR = 0.3; // Exponential smoothing factor (0-1)
const SPEED_THRESHOLD = 0.5; // km/h - below this, train is considered stationary

export class TrainStore {
  private static instance: TrainStore;
  private trains: Map<string, StoredTrainData>;
  private lastUpdated: Date;
  private simulationRunning: boolean = true;
  private speedMultiplier: number = 5;
  private resetGeneration: number = 0;

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
      this.clear();
    }
  }

  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  setSpeedMultiplier(multiplier: number): void {
    if (Number.isFinite(multiplier) && multiplier >= 0.5 && multiplier <= 50) {
      this.speedMultiplier = multiplier;
    }
  }

  getResetGeneration(): number {
    return this.resetGeneration;
  }

  triggerReset(): number {
    this.clear();
    this.resetGeneration += 1;
    this.simulationRunning = true;
    return this.resetGeneration;
  }

  static getInstance(): TrainStore {
    if (!TrainStore.instance) {
      TrainStore.instance = new TrainStore();
    }
    return TrainStore.instance;
  }

  upsertTrain(payload: TrainReceiverPayload): StoredTrainData {
    const existingTrain = this.trains.get(payload.train_id);
    const now = new Date();

    if (existingTrain) {
      const updatedTrain = this.updateExistingTrain(existingTrain, payload, now);
      this.trains.set(payload.train_id, updatedTrain);
      this.lastUpdated = now;
      return updatedTrain;
    } else {
      const newTrain = this.createNewTrain(payload, now);
      this.trains.set(payload.train_id, newTrain);
      this.lastUpdated = now;
      return newTrain;
    }
  }

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
      delaySeconds: payload.delaySeconds ?? 0,
      signalAspect: payload.signalAspect ?? "GREEN",
      currentStation: payload.currentStation,
      nextStation: payload.nextStation,
      progress: payload.progress,
      stateReason: payload.stateReason,
      lastUpdateTime: now,
      smoothedSpeed: payload.speed,
      speedHistory: [{ speed: payload.speed, timestamp: payload.timestamp }],
      averageSpeed: payload.speed,
      isMoving: payload.speed > SPEED_THRESHOLD,
      timeSinceLastUpdate: 0,
    };
  }

  private updateExistingTrain(
    existing: StoredTrainData,
    payload: TrainReceiverPayload,
    now: Date
  ): StoredTrainData {
    const speedHistory = [...existing.speedHistory, { speed: payload.speed, timestamp: payload.timestamp }];
    if (speedHistory.length > SPEED_HISTORY_LIMIT) {
      speedHistory.shift();
    }

    const smoothedSpeed =
      SMOOTHING_FACTOR * payload.speed + (1 - SMOOTHING_FACTOR) * existing.smoothedSpeed;

    const averageSpeed =
      speedHistory.reduce((sum, entry) => sum + entry.speed, 0) / speedHistory.length;

    const timeSinceLastUpdate = now.getTime() - existing.lastUpdateTime.getTime();

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
      delaySeconds: payload.delaySeconds ?? existing.delaySeconds ?? 0,
      signalAspect: payload.signalAspect ?? existing.signalAspect ?? "GREEN",
      currentStation: payload.currentStation ?? existing.currentStation,
      nextStation: payload.nextStation ?? existing.nextStation,
      progress: payload.progress ?? existing.progress,
      stateReason: payload.stateReason ?? existing.stateReason,
      lastUpdateTime: now,
      smoothedSpeed: Math.round(smoothedSpeed * 100) / 100,
      speedHistory,
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      isMoving: payload.speed > SPEED_THRESHOLD,
      timeSinceLastUpdate,
    };
  }

  getTrain(trainId: string): StoredTrainData | undefined {
    return this.trains.get(trainId);
  }

  getAllTrains(): StoredTrainData[] {
    return Array.from(this.trains.values());
  }

  getAllTrainsWithCurrentTimings(): StoredTrainData[] {
    const now = new Date();
    return Array.from(this.trains.values()).map((train) => ({
      ...train,
      timeSinceLastUpdate: now.getTime() - train.lastUpdateTime.getTime(),
    }));
  }

  getState(): TrainStoreState {
    return {
      trains: this.trains,
      totalTrains: this.trains.size,
      lastUpdated: this.lastUpdated,
    };
  }

  removeTrain(trainId: string): boolean {
    return this.trains.delete(trainId);
  }

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

  clear(): void {
    this.trains.clear();
    this.lastUpdated = new Date();
  }

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

  getMovingTrains(): StoredTrainData[] {
    return Array.from(this.trains.values()).filter((train) => train.isMoving);
  }

  getStationaryTrains(): StoredTrainData[] {
    return Array.from(this.trains.values()).filter((train) => !train.isMoving);
  }
}
