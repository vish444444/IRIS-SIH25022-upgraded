export interface PipelineNode {
  id: string;
  stationId: string | null;
  position: number;
}

export interface PipelineEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  curvatureFactor: number;
  crossingDensity: number;
  defaultHeadway: number;
  maxSpeed: number;
  isOccupied: boolean;
  occupiedBy: string | null;
  nextTrain: string | null;
  nextNextTrain: string | null;
  isFrozen: boolean;
}

export interface PipelineGraph {
  nodes: Map<string, PipelineNode>;
  edges: Map<string, PipelineEdge>;
}

export interface BlockOccupancyEvent {
  pipelineId: string;
  trainId: string;
  eventType: "enter" | "exit";
  timestamp: Date;
}

