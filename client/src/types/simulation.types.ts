export enum TrainState {
  SCHEDULED = "scheduled",      // Train hasn't departed yet (before departure time)
  APPROACHING = "approaching",
  STOPPED = "stopped",           // Train is stationary (speed = 0, at station or on track)
  ACCELERATING = "accelerating",
  CRUISING = "cruising",         // Train is moving (speed > 0)
  BRAKING = "braking",
  EMERGENCY = "emergency",
}

export enum TrainClass {
  AC_LOCAL = "AC Local",
  LADIES_SPECIAL = "Ladies Special",
  FAST_LOCAL = "Fast Local",
}

export interface TrainUpdate {
  id: string;
  position: number;
  speed: number;
  currentPipeline: string;
  nextPipeline: string | null;
  state: TrainState;
  gps: {
    latitude: number;
    longitude: number;
    speed: number;
  };
  delay: number;
  recommendedSpeed: number;
  class?: TrainClass;
  trainType?: string;
  destination?: string;
  currentSection?: string;
  nextSection?: string | null;
  currentPosition?: { latitude: number; longitude: number };
  previousSpeed?: number;
  predictedDestinationArrival?: Date | string | null;
  disruptionActive?: boolean;
  scheduledArrival?: Date | string;
  scheduledDeparture?: Date | string;
  actualArrival?: Date | string | null;
  actualDeparture?: Date | string | null;
  platform?: number | null;
}

export interface PipelineUpdate {
  id: string;
  isOccupied: boolean;
  occupiedBy: string | null;
  nextTrain: string | null;
  nextNextTrain: string | null;
  isFrozen: boolean;
}

export interface EmergencyEvent {
  id: string;
  trainId: string;
  pipelineId: string;
  timestamp: Date;
  reason: string;
  type: "speed_drop" | "overspeed" | "stall" | "signal_violation" | "power_failure" | "unknown";
  resolved: boolean;
}

export interface Forecast {
  trainId: string;
  affectedTrains: Array<{
    trainId: string;
    originalArrival: Date;
    forecastArrival: Date;
    delay: number;
  }>;
}

export interface TrackClosure {
  id: string;
  station_from: string;
  station_to: string;
  track_type: "slow" | "fast";
  direction: "up" | "down";
  status: "closed" | "open";
  timestamp: Date | string;
  description?: string;
}

export interface SectorBlockage {
  id: string;
  sector_id: string;
  status: "blocked" | "open";
  reason?: string;
  reported_by?: string;
  timestamp: Date | string;
}

export interface SimulationUpdate {
  trains: TrainUpdate[];
  pipelines: PipelineUpdate[];
  emergencyEvents: EmergencyEvent[];
  forecasts: Forecast[];
  trackClosures?: TrackClosure[];
  currentTime: Date;
}

