export enum TrainLogEventType {
  STATE_CHANGE = "state_change",
  EMERGENCY_DETECTED = "emergency_detected",
  EMERGENCY_RESOLVED = "emergency_resolved",
  ARRIVAL = "arrival",
  DEPARTURE = "departure",
  PLATFORM_ASSIGNED = "platform_assigned",
  ROUTE_CHANGED = "route_changed",
  DELAY_RECORDED = "delay_recorded",
}

export interface TrainLogEntry {
  id: string;
  trainId: string;
  eventType: TrainLogEventType;
  timestamp: Date;
  description: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface TrainLogQuery {
  trainId?: string;
  eventType?: TrainLogEventType;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

