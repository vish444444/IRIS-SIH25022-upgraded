export type TrackType = "slow" | "fast";
export type Direction = "up" | "down";
export type TrackStatus = "closed" | "open";

export interface TrackClosureStatus {
  id: string;
  station_from: string;
  station_to: string;
  track_type: TrackType;
  direction: Direction;
  status: TrackStatus;
  timestamp: Date;
  description?: string;
}

export interface TrackStatusStore {
  closures: Map<string, TrackClosureStatus>;
  lastUpdated: Date;
}

export interface TrackClosureRequest {
  station_from: string;
  station_to: string;
  track_type: TrackType;
  direction: Direction;
  status: TrackStatus;
  description?: string;
}

