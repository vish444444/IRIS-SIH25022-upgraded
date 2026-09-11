import { TrainEntry, getTrainType, TrainType } from "./timetableLoader";
import {
  TrackGraph,
  StationCoord,
  interpolateCoordinates,
  haversineDistance,
  allocateTrainLane,
  SectorPathInfo,
} from "./trackBuilder";

export interface TrainState {
  train_id: string;
  lat: number;
  lng: number;
  speed: number; // in km/h
  type: TrainType;
  destination: string;
  currentStation: string;
  nextStation: string;
  progress: number; // 0-1 progress between current and next station
  isAtStation: boolean;
  previousLat: number;
  previousLng: number;
  lastUpdateTime: number;
  // Track allocation info
  trackType?: string; // e.g., "up_slow", "down_fast"
  trackVariant?: string; // e.g., "up_slow_1", "up_slow_2" for split tracks
  laneIndex?: number; // 0-based lane index for split tracks
  laneCount?: number; // total lanes for this segment
  sectorId?: string; // active sector the train occupies
}

export interface ActiveSegment {
  fromStation: string;
  toStation: string;
  departureTime: Date;
  arrivalTime: Date;
  fromCoord: StationCoord;
  toCoord: StationCoord;
}

/**
 * Finds the active segment for a train at the current simulation time
 * Returns null if the train hasn't started or has completed its journey
 */
export function findActiveSegment(
  train: TrainEntry,
  currentTime: Date,
  trackGraph: TrackGraph
): ActiveSegment | null {
  const stopTimes = train.stop_times;

  // Check if train hasn't started yet (SCHEDULED state - not rendered)
  const firstDeparture = stopTimes[0].departureDate!;
  if (currentTime < firstDeparture) {
    return null; // Train is scheduled but not yet active
  }

  // Check if train has completed its journey
  const lastArrival = stopTimes[stopTimes.length - 1].arrivalDate!;
  if (currentTime > lastArrival) {
    return null;
  }

  // Find the segment where currentTime is between departure(A) and arrival(B)
  for (let i = 0; i < stopTimes.length - 1; i++) {
    const currentStop = stopTimes[i];
    const nextStop = stopTimes[i + 1];

    const departure = currentStop.departureDate!;
    const arrival = nextStop.arrivalDate!;

    // Train is on this segment
    if (currentTime >= departure && currentTime <= arrival) {
      const fromCoord = trackGraph.stationMap.get(currentStop.station);
      const toCoord = trackGraph.stationMap.get(nextStop.station);

      if (!fromCoord || !toCoord) {
        console.warn(
          `[TrainSimulator] Station not found: ${currentStop.station} or ${nextStop.station}`
        );
        continue;
      }

      return {
        fromStation: currentStop.station,
        toStation: nextStop.station,
        departureTime: departure,
        arrivalTime: arrival,
        fromCoord,
        toCoord,
      };
    }

    // Train is stopped at a station (between arrival and departure at same station)
    if (i < stopTimes.length - 1) {
      const stationArrival = nextStop.arrivalDate!;
      const stationDeparture = nextStop.departureDate!;

      if (currentTime >= stationArrival && currentTime <= stationDeparture) {
        const stationCoord = trackGraph.stationMap.get(nextStop.station);
        if (stationCoord) {
          return {
            fromStation: nextStop.station,
            toStation: nextStop.station,
            departureTime: stationArrival,
            arrivalTime: stationDeparture,
            fromCoord: stationCoord,
            toCoord: stationCoord,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Calculates the progress (0-1) along the current segment
 */
export function calculateProgress(
  currentTime: Date,
  departureTime: Date,
  arrivalTime: Date
): number {
  const totalDuration = arrivalTime.getTime() - departureTime.getTime();
  if (totalDuration <= 0) return 1;

  const elapsed = currentTime.getTime() - departureTime.getTime();
  const progress = elapsed / totalDuration;

  return Math.max(0, Math.min(1, progress));
}

/**
 * Calculates speed based on distance traveled since last update
 */
export function calculateSpeed(
  previousLat: number,
  previousLng: number,
  currentLat: number,
  currentLng: number,
  intervalSeconds: number
): number {
  const distance = haversineDistance(
    previousLat,
    previousLng,
    currentLat,
    currentLng
  );

  // Convert km per interval to km/h
  const speedKmh = (distance / intervalSeconds) * 3600;

  // Clamp to reasonable train speeds based on type:
  // - Slow trains: 0-60 km/h (typically 40-50 km/h)
  // - Fast trains: 0-80 km/h (typically 60-70 km/h)
  // - AC trains: 0-70 km/h (typically 55-65 km/h)
  // - Women's trains: 0-55 km/h (typically 40-50 km/h)
  const maxSpeed = 120; // Absolute maximum
  return Math.min(Math.max(0, speedKmh), maxSpeed);
}

/**
 * Simulates a single train at the current time
 * Returns the train state or null if the train is not active
 */
export function simulateTrain(
  train: TrainEntry,
  currentTime: Date,
  trackGraph: TrackGraph,
  previousState: TrainState | null,
  intervalSeconds: number,
  blockedSectors: Set<string> = new Set()
): TrainState | null {
  const segment = findActiveSegment(train, currentTime, trackGraph);

  if (!segment) {
    return null;
  }

  // If train is at station (same from and to), speed is 0
  const isAtStation = segment.fromStation === segment.toStation;

  // Calculate base progress from timetable
  let progress = calculateProgress(
    currentTime,
    segment.departureTime,
    segment.arrivalTime
  );

  // Start with a straight interpolation between stations
  let coords = interpolateCoordinates(segment.fromCoord, segment.toCoord, progress);

  // Track metadata (direction + speed role)
  const trainType = getTrainType(train);
  const direction = segment.fromStation < segment.toStation ? "up" : "down";
  const speedRole = trainType === "fast" ? "fast" : "slow";
  const trackType = train.track_type || `${direction}_${speedRole}`;

  // Lane allocation info
  const laneMapKey = `${segment.fromStation}__${segment.toStation}__${trackType}`;
  const laneInfo = trackGraph.laneMap?.get(laneMapKey);
  let laneCount = Number.isFinite(train.lane_count)
    ? (train.lane_count as number)
    : laneInfo?.laneCount || 1;
  const variantNames = laneInfo?.splits?.map((s) => s.variant);

  const { laneIndex: allocatedLaneIndex, variant: allocatedVariant } = allocateTrainLane(
    train.train_id,
    trackType,
    laneCount,
    variantNames
  );

  let laneIndex = Number.isFinite(train.lane_index)
    ? (train.lane_index as number)
    : allocatedLaneIndex;
  let trackVariant = train.track_variant || allocatedVariant;
  let sectorId: string | undefined;

  // If sector geometry exists, project the train onto that path so it "rides" its lane
  const sectorPath = getSectorPath(
    trackGraph,
    segment.fromStation,
    segment.toStation,
    trackVariant,
    trackType
  );

  if (sectorPath) {
    const sectorPosition = projectOntoSectorPath(sectorPath, progress);
    coords = sectorPosition.coords;
    sectorId = sectorPosition.sectorId;
    // Use lane metadata from the sector path when available
    if (typeof sectorPath.laneIndex === "number") {
      laneIndex = sectorPath.laneIndex;
    }
    laneCount = sectorPath.laneCount || laneCount;
    trackVariant = sectorPath.splitVariant || trackVariant;
  }

  // Calculate speed based on movement since last update
  let speed = 0;
  const prevLat = previousState?.lat ?? coords.lat;
  const prevLng = previousState?.lng ?? coords.lng;
  
  if (isAtStation) {
    speed = 0;
  } else if (previousState) {
    // Calculate speed from movement
    speed = calculateSpeed(
      prevLat,
      prevLng,
      coords.lat,
      coords.lng,
      intervalSeconds
    );
    
    // Apply realistic speed limits based on train type
    const trainType = getTrainType(train);
    const segmentDuration = (segment.arrivalTime.getTime() - segment.departureTime.getTime()) / 1000; // seconds
    const segmentDistance = haversineDistance(
      segment.fromCoord.lat,
      segment.fromCoord.lng,
      segment.toCoord.lat,
      segment.toCoord.lng
    ) / 1000; // km
    
    if (segmentDuration > 0 && segmentDistance > 0) {
      // Calculate average speed for this segment
      const avgSpeed = (segmentDistance / segmentDuration) * 3600; // km/h
      
      // Apply type-specific speed limits
      let maxSpeed = 60; // Default for slow trains
      if (trainType === "fast") {
        maxSpeed = 80;
      } else if (trainType === "ac") {
        maxSpeed = 70;
      } else if (trainType === "womens") {
        maxSpeed = 55;
      }
      
      // Apply type-specific speed limits first
      speed = Math.min(speed, maxSpeed);
      
      // Occasionally introduce speed anomalies for emergency testing (3% chance per tick)
      // This helps test emergency detection
      if (Math.random() < 0.03 && !isAtStation && speed > 5) {
        // Randomly introduce speed issues
        const anomalyType = Math.random();
        if (anomalyType < 0.4) {
          // Speed drop (sudden brake) - reduce speed significantly
          speed = Math.max(0, speed * 0.2); // Drop to 20% of current speed
        } else if (anomalyType < 0.8) {
          // Overspeed (acceleration issue) - exceed normal limits
          speed = Math.min(120, maxSpeed * 1.3); // 30% over max speed
        }
        // else: normal speed (no anomaly)
      }
      
      // If calculated speed is very low but we're moving, use a minimum realistic speed
      if (speed < 5 && !isAtStation && progress > 0.1 && progress < 0.9) {
        speed = Math.max(speed, avgSpeed * 0.7); // At least 70% of average for segment
      }
    }
  }
  
  let finalState: TrainState = {
    train_id: train.train_id,
    lat: coords.lat,
    lng: coords.lng,
    speed,
    type: trainType,
    destination: train.to,
    currentStation: segment.fromStation,
    nextStation: segment.toStation,
    progress,
    isAtStation,
    previousLat: prevLat,
    previousLng: prevLng,
    lastUpdateTime: currentTime.getTime(),
    trackType,
    trackVariant,
    laneIndex,
    laneCount,
    sectorId,
  };

  if (sectorId && blockedSectors.has(sectorId)) {
    return {
      ...finalState,
      ...(previousState?.sectorId === sectorId
        ? { lat: previousState.lat, lng: previousState.lng, progress: previousState.progress }
        : {}),
      speed: 0,
    };
  }
  
  return finalState;
}

/**
 * Simulates all trains at the current time
 */
export function simulateAllTrains(
  trains: TrainEntry[],
  currentTime: Date,
  trackGraph: TrackGraph,
  previousStates: Map<string, TrainState>,
  intervalSeconds: number,
  blockedSectors: Set<string> = new Set()
): Map<string, TrainState> {
  const newStates = new Map<string, TrainState>();

  for (const train of trains) {
    const previousState = previousStates.get(train.train_id) || null;
    const state = simulateTrain(
      train,
      currentTime,
      trackGraph,
      previousState,
      intervalSeconds,
      blockedSectors
    );

    if (state) {
      newStates.set(train.train_id, state);
    }
  }

  return newStates;
}

function getSectorPath(
  trackGraph: TrackGraph,
  fromStation: string,
  toStation: string,
  trackVariant?: string,
  trackType?: string
): SectorPathInfo | undefined {
  const sectorMap = trackGraph.sectorMap;
  if (!sectorMap) return undefined;

  if (trackVariant) {
    const variantKey = `${fromStation}__${toStation}__${trackVariant}`;
    const byVariant = sectorMap.get(variantKey);
    if (byVariant) return byVariant;
  }

  if (trackType) {
    const fallbackKey = `${fromStation}__${toStation}__${trackType}`;
    const byType = sectorMap.get(fallbackKey);
    if (byType) return byType;
  }

  return undefined;
}

function projectOntoSectorPath(
  sectorPath: SectorPathInfo,
  segmentProgress: number
): { coords: { lat: number; lng: number }; sectorId: string } {
  const clampedProgress = Math.max(0, Math.min(1, segmentProgress));
  const targetDistance = clampedProgress * (sectorPath.totalLengthMeters || 0);

  if (!sectorPath.segments.length) {
    return {
      coords: { lat: 0, lng: 0 },
      sectorId: "",
    };
  }

  let activeSegment = sectorPath.segments[sectorPath.segments.length - 1];

  for (const segment of sectorPath.segments) {
    if (targetDistance <= segment.cumulativeEnd) {
      activeSegment = segment;
      break;
    }
  }

  const segmentLength = Math.max(activeSegment.lengthMeters, 1e-6);
  const distanceIntoSegment = targetDistance - activeSegment.cumulativeStart;
  const localProgress = Math.max(
    0,
    Math.min(1, distanceIntoSegment / segmentLength)
  );

  const lat =
    activeSegment.start.lat +
    (activeSegment.end.lat - activeSegment.start.lat) * localProgress;
  const lng =
    activeSegment.start.lng +
    (activeSegment.end.lng - activeSegment.start.lng) * localProgress;

  return {
    coords: { lat, lng },
    sectorId: activeSegment.sectorId,
  };
}

export default {
  findActiveSegment,
  calculateProgress,
  calculateSpeed,
  simulateTrain,
  simulateAllTrains,
};
