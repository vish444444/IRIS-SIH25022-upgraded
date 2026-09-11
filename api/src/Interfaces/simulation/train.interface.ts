export enum TrainState {
  APPROACHING = "approaching",
  STOPPED = "stopped",
  ACCELERATING = "accelerating",
  CRUISING = "cruising",
  BRAKING = "braking",
  EMERGENCY = "emergency",
}

export enum TrainClass {
  AC_LOCAL = "AC Local",
  LADIES_SPECIAL = "Ladies Special",
  FAST_LOCAL = "Fast Local",
}

export interface Train {
  id: string;
  position: number;
  speed: number;
  currentPipeline: string;
  nextPipeline: string | null;
  state: TrainState;
  class: TrainClass;
  coaches: number;
  scheduledArrival: Date;
  scheduledDeparture: Date;
  actualArrival: Date | null;
  actualDeparture: Date | null;
  platform: number | null;
  assignedPath: string[];
  priority: number;
  gps: {
    latitude: number;
    longitude: number;
    speed: number;
  };
  speedHistory: Array<{ timestamp: Date; speed: number }>;
  totalKm: number;
  pipelineTimes: Map<string, number>;
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
  scheduledArrival?: Date | string;
  scheduledDeparture?: Date | string;
  actualArrival?: Date | string | null;
  actualDeparture?: Date | string | null;
  platform?: number | null;
  class?: TrainClass;
}

