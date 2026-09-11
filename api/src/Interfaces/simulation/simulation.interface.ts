import { Train, TrainUpdate } from "./train.interface";
import { PipelineGraph, BlockOccupancyEvent } from "./pipeline.interface";
import { Station } from "./station.interface";

export type EmergencyType =
  | "speed_drop"
  | "overspeed"
  | "stall"
  | "signal_violation"
  | "power_failure"
  | "unknown";

export interface SimulationState {
  trains: Map<string, Train>;
  pipelineGraph: PipelineGraph;
  stations: Map<string, Station>;
  blockEvents: BlockOccupancyEvent[];
  isRunning: boolean;
  currentTime: Date;
  emergencyEvents: EmergencyEvent[];
}

export interface EmergencyEvent {
  id: string;
  trainId: string;
  pipelineId: string;
  timestamp: Date;
  reason: string;
  type: EmergencyType;
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

export interface ControllerOverride {
  trainId: string;
  action: "route_change" | "hold" | "accelerate" | "slow_run";
  value?: any;
}

export interface SimulationUpdate {
  trains: TrainUpdate[];
  pipelines: Array<{
    id: string;
    isOccupied: boolean;
    occupiedBy: string | null;
    nextTrain: string | null;
    nextNextTrain: string | null;
    isFrozen: boolean;
  }>;
  emergencyEvents: EmergencyEvent[];
  forecasts: Forecast[];
  currentTime: Date;
}

