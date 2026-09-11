/**
 * Types for live train data from the receiver endpoint
 */

export type LiveTrainType = "slow" | "fast" | "womens" | "ac";

// Supported railway line identifiers
export type LineId = "csmt-kalyan" | "csmt-panvel";

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

/**
 * Color mapping for train types
 */
export const TRAIN_TYPE_COLORS: Record<LiveTrainType, string> = {
  slow: "#3b82f6",     // blue
  fast: "#ef4444",     // red
  womens: "#ec4899",   // pink
  ac: "#06b6d4",       // cyan
};

/**
 * Human-readable labels for train types
 */
export const TRAIN_TYPE_LABELS: Record<LiveTrainType, string> = {
  slow: "Slow Local",
  fast: "Fast Local",
  womens: "Women's Special",
  ac: "AC Local",
};
