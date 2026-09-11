import { TrainLogEntry, TrainLogEventType, TrainLogQuery } from "../../Interfaces/simulation/trainLog.interface";

export class TrainLogService {
  private static instance: TrainLogService;
  private logs: Map<string, TrainLogEntry[]> = new Map();
  private readonly MAX_LOGS_PER_TRAIN = 1000;

  private constructor() {}

  static getInstance(): TrainLogService {
    if (!TrainLogService.instance) {
      TrainLogService.instance = new TrainLogService();
    }
    return TrainLogService.instance;
  }

  logEvent(
    trainId: string,
    eventType: TrainLogEventType,
    description: string,
    metadata?: { [key: string]: any }
  ): void {
    const logEntry: TrainLogEntry = {
      id: `${trainId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      trainId,
      eventType,
      timestamp: new Date(),
      description,
      metadata,
    };

    if (!this.logs.has(trainId)) {
      this.logs.set(trainId, []);
    }

    const trainLogs = this.logs.get(trainId)!;
    trainLogs.push(logEntry);

    if (trainLogs.length > this.MAX_LOGS_PER_TRAIN) {
      trainLogs.shift();
    }
  }

  getLogs(query: TrainLogQuery = {}): TrainLogEntry[] {
    let allLogs: TrainLogEntry[] = [];

    if (query.trainId) {
      const trainLogs = this.logs.get(query.trainId) || [];
      allLogs = [...trainLogs];
    } else {
      for (const logs of this.logs.values()) {
        allLogs.push(...logs);
      }
    }

    if (query.eventType) {
      allLogs = allLogs.filter((log) => log.eventType === query.eventType);
    }

    if (query.startTime) {
      allLogs = allLogs.filter(
        (log) => log.timestamp >= query.startTime!
      );
    }

    if (query.endTime) {
      allLogs = allLogs.filter((log) => log.timestamp <= query.endTime!);
    }

    allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.limit) {
      allLogs = allLogs.slice(0, query.limit);
    }

    return allLogs;
  }

  getTrainLogs(trainId: string, limit?: number): TrainLogEntry[] {
    const logs = this.logs.get(trainId) || [];
    const sortedLogs = [...logs].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    return limit ? sortedLogs.slice(0, limit) : sortedLogs;
  }

  clearLogs(trainId?: string): void {
    if (trainId) {
      this.logs.delete(trainId);
    } else {
      this.logs.clear();
    }
  }
}

