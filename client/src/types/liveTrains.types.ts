/**
 * Types for live train data from the receiver endpoint
 */

export type LiveTrainType = "slow" | "fast" | "womens" | "ac";

export type LineId = "csmt-kalyan" | "csmt-panvel" | "secr-raipur";

export type SignalAspect = "GREEN" | "DOUBLE_YELLOW" | "YELLOW" | "RED";

export interface LiveTrainData {
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  type: LiveTrainType;
  line_id: LineId;
  destination: string;
  timestamp: number;
  trackType?: string;
  trackVariant?: string;
  laneIndex?: number;
  laneCount?: number;
  sectorId?: string;
  delaySeconds?: number;
  signalAspect?: SignalAspect;
  currentStation?: string;
  nextStation?: string;
  progress?: number;
  stateReason?: string;
  // Derived values from TrainStore
  lastUpdateTime: string;
  smoothedSpeed: number;
  speedHistory: Array<{ speed: number; timestamp: number }>;
  averageSpeed: number;
  isMoving: boolean;
  timeSinceLastUpdate: number;
}

export interface LiveTrainResponse {
  success: boolean;
  totalTrains: number;
  lastUpdated: string;
  countByType: Record<LiveTrainType, number>;
  trains: LiveTrainData[];
}

export const TRAIN_TYPE_COLORS: Record<LiveTrainType, string> = {
  slow: "#3b82f6",
  fast: "#ef4444",
  womens: "#ec4899",
  ac: "#06b6d4",
};

export const TRAIN_TYPE_LABELS: Record<LiveTrainType, string> = {
  slow: "Slow / MEMU",
  fast: "Express / Fast",
  womens: "Women's Special",
  ac: "Vande Bharat / AC",
};
