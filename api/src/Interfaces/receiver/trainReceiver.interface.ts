export type TrainType = "slow" | "fast" | "womens" | "ac";

// Supported railway line identifiers
export type LineId = "csmt-kalyan" | "csmt-panvel" | "secr-raipur";

export interface TrainReceiverPayload {
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  type: TrainType;
  line_id: LineId;
  destination: string;
  timestamp: number;
  trackType?: string;
  trackVariant?: string;
  laneIndex?: number;
  laneCount?: number;
  sectorId?: string;
}

export interface StoredTrainData {
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  type: TrainType;
  line_id: LineId;
  destination: string;
  timestamp: number;
  trackType?: string;
  trackVariant?: string;
  laneIndex?: number;
  laneCount?: number;
  sectorId?: string;
  // Derived values
  lastUpdateTime: Date;
  smoothedSpeed: number;
  speedHistory: Array<{ speed: number; timestamp: number }>;
  averageSpeed: number;
  isMoving: boolean;
  timeSinceLastUpdate: number; // in milliseconds
}

export interface TrainStoreState {
  trains: Map<string, StoredTrainData>;
  totalTrains: number;
  lastUpdated: Date;
}
