import { TrainEntry, getTrainType, TrainType } from "./timetableLoader";
import {
  TrackGraph,
  StationCoord,
  interpolateCoordinates,
  haversineDistance,
  allocateTrainLane,
  resolveCompositeSectorPath,
  SectorPathInfo,
} from "./trackBuilder";

export type SignalAspect = "GREEN" | "DOUBLE_YELLOW" | "YELLOW" | "RED";

export interface TrainState {
  train_id: string;
  lat: number;
  lng: number;
  speed: number; // in km/h
  type: TrainType;
  destination: string;
  currentStation: string;
  nextStation: string;
  progress: number; // 0-1 progress along current segment
  isAtStation: boolean;
  previousLat: number;
  previousLng: number;
  lastUpdateTime: number;
  trackType?: string;
  trackVariant?: string;
  laneIndex?: number;
  laneCount?: number;
  sectorId?: string;
  // Enhanced railway physics & interlocking state
  delaySeconds: number;
  signalAspect: SignalAspect;
  stateReason: string;
  sectorIndices?: string[];
  currentSectorIndex?: number;
  line_id?: "csmt-kalyan" | "csmt-panvel" | "secr-raipur";
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
 * S-curve velocity/progress shaping near station departures and arrivals
 * so trains smoothly accelerate out of platforms and brake on approach.
 */
function smoothStationProgress(linearProgress: number): number {
  const p = Math.max(0, Math.min(1, linearProgress));
  // Blend linear (70%) + cosine S-curve (30%) for realistic acceleration/braking curves
  const cosine = 0.5 - 0.5 * Math.cos(Math.PI * p);
  return 0.7 * p + 0.3 * cosine;
}

export function findActiveSegment(
  train: TrainEntry,
  currentTime: Date,
  trackGraph: TrackGraph
): ActiveSegment | null {
  const stopTimes = train.stop_times;
  if (!stopTimes || stopTimes.length < 2) return null;

  const firstDeparture = stopTimes[0].departureDate!;
  if (currentTime < firstDeparture) {
    return null;
  }

  const lastArrival = stopTimes[stopTimes.length - 1].arrivalDate!;
  if (currentTime > lastArrival) {
    return null;
  }

  for (let i = 0; i < stopTimes.length - 1; i++) {
    const currentStop = stopTimes[i];
    const nextStop = stopTimes[i + 1];

    const departure = currentStop.departureDate!;
    const arrival = nextStop.arrivalDate!;

    // Dwelling at current station before departing (except stop 0 handled above)
    if (currentTime >= currentStop.arrivalDate! && currentTime < departure) {
      const stationCoord = trackGraph.stationMap.get(currentStop.station);
      if (stationCoord) {
        return {
          fromStation: currentStop.station,
          toStation: currentStop.station,
          departureTime: currentStop.arrivalDate!,
          arrivalTime: departure,
          fromCoord: stationCoord,
          toCoord: stationCoord,
        };
      }
    }

    // Running between currentStop and nextStop
    if (currentTime >= departure && currentTime <= arrival) {
      const fromCoord = trackGraph.stationMap.get(currentStop.station);
      const toCoord = trackGraph.stationMap.get(nextStop.station);

      if (!fromCoord || !toCoord) {
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

    // Dwelling at nextStop
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

export function calculateSpeed(
  previousLat: number,
  previousLng: number,
  currentLat: number,
  currentLng: number,
  intervalSeconds: number
): number {
  if (intervalSeconds <= 0) return 0;
  const distanceKm = haversineDistance(
    previousLat,
    previousLng,
    currentLat,
    currentLng
  );
  const speedKmh = (distanceKm / intervalSeconds) * 3600;
  return Math.min(Math.max(0, speedKmh), 135);
}

function getMaxPermittedSpeed(train: TrainEntry, lineId?: string): number {
  if (lineId === "secr-raipur") {
    if (train.train_subtype === "vande_bharat") return 130;
    if (train.train_subtype === "superfast" || train.train_subtype === "mail_express") return 110;
    if (train.train_subtype === "freight") return 60;
    return 75; // MEMU
  }
  const t = getTrainType(train);
  if (t === "fast") return 95;
  if (t === "ac") return 85;
  if (t === "womens") return 65;
  return 70;
}

export function simulateTrain(
  train: TrainEntry,
  currentTime: Date,
  trackGraph: TrackGraph,
  previousState: TrainState | null,
  intervalSeconds: number,
  blockedSectors: Set<string> = new Set(),
  occupiedByOthers: Map<string, string> = new Map()
): TrainState | null {
  const prevDelaySec = previousState?.delaySeconds ?? 0;
  const effectiveTime = new Date(currentTime.getTime() - prevDelaySec * 1000);

  const segment = findActiveSegment(train, effectiveTime, trackGraph);
  if (!segment) {
    return null;
  }

  const isAtStation = segment.fromStation === segment.toStation;
  const trainType = getTrainType(train);

  // Determine direction from station topological order (never alphabetical string comparison!)
  const fromOrder = trackGraph.stationMap.get(segment.fromStation)?.order ?? 0;
  const toOrder = trackGraph.stationMap.get(segment.toStation)?.order ?? 0;
  const fallbackDir = train.direction === "DOWN" ? "down" : "up";
  const direction = isAtStation ? fallbackDir : fromOrder < toOrder ? "up" : "down";
  const speedRole = trainType === "fast" || trainType === "ac" ? "fast" : "slow";
  const trackType = train.track_type || `${direction}_${speedRole}`;

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

  const sectorPath = !isAtStation
    ? resolveCompositeSectorPath(
        trackGraph,
        segment.fromStation,
        segment.toStation,
        trackVariant,
        trackType
      )
    : undefined;

  let rawProgress = calculateProgress(
    effectiveTime,
    segment.departureTime,
    segment.arrivalTime
  );
  let progress = isAtStation ? rawProgress : smoothStationProgress(rawProgress);

  let coords = interpolateCoordinates(segment.fromCoord, segment.toCoord, progress);
  let sectorId: string | undefined;
  let currentSectorIdx = -1;

  if (sectorPath && sectorPath.segments.length > 0) {
    const projected = projectOntoSectorPath(sectorPath, progress);
    coords = projected.coords;
    sectorId = projected.sectorId;
    currentSectorIdx = projected.segmentIndex;
    if (typeof sectorPath.laneIndex === "number") {
      laneIndex = sectorPath.laneIndex;
    }
    laneCount = sectorPath.laneCount || laneCount;
    trackVariant = sectorPath.splitVariant || trackVariant;
  }

  // Signal Aspect & Block Occupancy Check (Lookahead 3 sectors ahead)
  let signalAspect: SignalAspect = "GREEN";
  let stateReason = isAtStation ? "Station Dwell Halt" : "Running at Sectional MPS";
  let delaySeconds = prevDelaySec;

  if (!isAtStation && sectorPath && currentSectorIdx >= 0) {
    const segs = sectorPath.segments;
    const isBlockedAt = (idx: number) => idx < segs.length && blockedSectors.has(segs[idx].sectorId);
    const isOccupiedAt = (idx: number) => {
      if (idx >= segs.length) return false;
      const occupant = occupiedByOthers.get(segs[idx].sectorId);
      return Boolean(occupant && occupant !== train.train_id);
    };

    const redAhead =
      isBlockedAt(currentSectorIdx) ||
      isBlockedAt(currentSectorIdx + 1) ||
      isOccupiedAt(currentSectorIdx + 1);
    const yellowAhead = isBlockedAt(currentSectorIdx + 2) || isOccupiedAt(currentSectorIdx + 2);
    const doubleYellowAhead = isBlockedAt(currentSectorIdx + 3) || isOccupiedAt(currentSectorIdx + 3);

    if (redAhead) {
      signalAspect = "RED";
      stateReason = isBlockedAt(currentSectorIdx) || isBlockedAt(currentSectorIdx + 1)
        ? "Held at Red Signal (Blocked Sector Ahead)"
        : "Held at Red Signal (Block Occupied by Leading Train)";

      // Hold safely before advancing into occupied/blocked block and accumulate real delay
      if (previousState) {
        delaySeconds = prevDelaySec + intervalSeconds;
        const dampedSpeed = Math.max(0, (previousState.speed || 0) - 22 * Math.min(intervalSeconds / 2, 2));
        return {
          ...previousState,
          speed: dampedSpeed < 2 ? 0 : Math.round(dampedSpeed * 100) / 100,
          previousLat: previousState.lat,
          previousLng: previousState.lng,
          lastUpdateTime: currentTime.getTime(),
          delaySeconds: Math.round(delaySeconds),
          signalAspect,
          stateReason,
        };
      }
    } else if (yellowAhead) {
      signalAspect = "YELLOW";
      stateReason = "Caution Aspect — Slowing for Next Block";
    } else if (doubleYellowAhead) {
      signalAspect = "DOUBLE_YELLOW";
      stateReason = "Preliminary Caution — Approach Restricted";
    }
  } else if (sectorId && blockedSectors.has(sectorId)) {
    signalAspect = "RED";
    stateReason = "Held at Red Signal (Blocked Sector)";
    if (previousState) {
      return {
        ...previousState,
        speed: 0,
        lastUpdateTime: currentTime.getTime(),
        delaySeconds: Math.round(prevDelaySec + intervalSeconds),
        signalAspect,
        stateReason,
      };
    }
  }

  // Schedule recovery on clear GREEN signal when slightly delayed
  if (signalAspect === "GREEN" && delaySeconds > 0 && !isAtStation) {
    delaySeconds = Math.max(0, delaySeconds - intervalSeconds * 0.12);
  }

  // Compute physical speed in km/h
  let speed = 0;
  const prevLat = previousState?.lat ?? coords.lat;
  const prevLng = previousState?.lng ?? coords.lng;

  if (isAtStation) {
    speed = 0;
  } else if (previousState) {
    const calcSpeed = calculateSpeed(
      prevLat,
      prevLng,
      coords.lat,
      coords.lng,
      intervalSeconds
    );
    const maxSpeed = getMaxPermittedSpeed(train, trackGraph.lineId);

    const segDistKm =
      haversineDistance(
        segment.fromCoord.lat,
        segment.fromCoord.lng,
        segment.toCoord.lat,
        segment.toCoord.lng
      ) / 1000;
    const segDurSec = (segment.arrivalTime.getTime() - segment.departureTime.getTime()) / 1000;
    const scheduledAvgSpeed = segDurSec > 0 ? (segDistKm / segDurSec) * 3600 : maxSpeed * 0.7;

    // Velocity envelope near station ends (accel / decel ramps)
    const edgeFactor =
      rawProgress < 0.1
        ? 0.35 + (rawProgress / 0.1) * 0.65
        : rawProgress > 0.9
        ? 0.35 + ((1 - rawProgress) / 0.1) * 0.65
        : 1.0;

    let targetSpeed = Math.min(maxSpeed, Math.max(calcSpeed, scheduledAvgSpeed * 1.1)) * edgeFactor;

    if (signalAspect === "YELLOW") {
      targetSpeed = Math.min(targetSpeed, 42);
    } else if (signalAspect === "DOUBLE_YELLOW") {
      targetSpeed = Math.min(targetSpeed, 65);
    }

    // Smooth acceleration / braking inertia blending
    const prevSpeed = previousState.speed ?? targetSpeed;
    const maxDelta = 18 * Math.min(intervalSeconds / 2, 2.5);
    if (Math.abs(targetSpeed - prevSpeed) > maxDelta) {
      speed = prevSpeed + Math.sign(targetSpeed - prevSpeed) * maxDelta;
    } else {
      speed = targetSpeed;
    }
    speed = Math.max(5, Math.min(maxSpeed, speed));
  } else {
    speed = isAtStation ? 0 : Math.min(getMaxPermittedSpeed(train, trackGraph.lineId), 55);
  }

  return {
    train_id: train.train_id,
    lat: coords.lat,
    lng: coords.lng,
    speed: Math.round(speed * 100) / 100,
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
    delaySeconds: Math.round(delaySeconds),
    signalAspect,
    stateReason,
    line_id: trackGraph.lineId as any,
  };
}

export function simulateAllTrains(
  trains: TrainEntry[],
  currentTime: Date,
  trackGraph: TrackGraph,
  previousStates: Map<string, TrainState>,
  intervalSeconds: number,
  blockedSectors: Set<string> = new Set()
): Map<string, TrainState> {
  // Build occupied sector snapshot from previous tick for safe moving-block/fixed-block spacing
  const occupiedMap = new Map<string, string>();
  for (const [tid, st] of previousStates.entries()) {
    if (st.sectorId && !st.isAtStation) {
      occupiedMap.set(st.sectorId, tid);
    }
  }

  const newStates = new Map<string, TrainState>();

  for (const train of trains) {
    const previousState = previousStates.get(train.train_id) || null;
    const state = simulateTrain(
      train,
      currentTime,
      trackGraph,
      previousState,
      intervalSeconds,
      blockedSectors,
      occupiedMap
    );

    if (state) {
      newStates.set(train.train_id, state);
      if (state.sectorId && !state.isAtStation) {
        occupiedMap.set(state.sectorId, train.train_id);
      }
    }
  }

  return newStates;
}

function projectOntoSectorPath(
  sectorPath: SectorPathInfo,
  segmentProgress: number
): { coords: { lat: number; lng: number }; sectorId: string; segmentIndex: number } {
  const clampedProgress = Math.max(0, Math.min(1, segmentProgress));
  const targetDistance = clampedProgress * (sectorPath.totalLengthMeters || 0);

  if (!sectorPath.segments.length) {
    return {
      coords: { lat: 0, lng: 0 },
      sectorId: "",
      segmentIndex: -1,
    };
  }

  let activeIndex = sectorPath.segments.length - 1;
  let activeSegment = sectorPath.segments[activeIndex];

  for (let i = 0; i < sectorPath.segments.length; i++) {
    const seg = sectorPath.segments[i];
    if (targetDistance <= seg.cumulativeEnd) {
      activeSegment = seg;
      activeIndex = i;
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
    segmentIndex: activeIndex,
  };
}

export default {
  findActiveSegment,
  calculateProgress,
  calculateSpeed,
  simulateTrain,
  simulateAllTrains,
};
