import * as fs from "fs";
import * as path from "path";

export interface StationCoord {
  code: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface StationsData {
  line_id: string;
  stations: StationCoord[];
}

export interface TrackSegment {
  from: StationCoord;
  to: StationCoord;
  distance: number; // in kilometers
}

export interface TrackSplit {
  variant: string; // e.g., "up_slow_1", "up_slow_2"
  next: string; // next station for this variant
}

export interface TrackLaneInfo {
  fromStation: string;
  toStation: string;
  trackType: string; // e.g., "up_slow", "down_fast"
  splits: TrackSplit[];
  laneCount: number; // 1 if no split, 2+ if split
}

export interface TrackGraph {
  segments: TrackSegment[];
  stationMap: Map<string, StationCoord>;
  totalDistance: number;
  laneMap?: Map<string, TrackLaneInfo>; // Key: "STATION1__STATION2__type"
  sectorMap?: Map<string, SectorPathInfo>; // Key: "FROM__TO__variant"
}

export interface SectorSegment {
  sectorId: string;
  trackType: string;
  splitVariant: string;
  fromStation: string;
  toStation: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  index: number;
  lengthMeters: number;
  cumulativeStart: number;
  cumulativeEnd: number;
  laneIndex: number;
  laneCount: number;
}

export interface SectorPathInfo {
  key: string;
  trackType: string;
  splitVariant: string;
  fromStation: string;
  toStation: string;
  laneIndex: number;
  laneCount: number;
  totalLengthMeters: number;
  segments: SectorSegment[];
}

/**
 * Haversine formula to calculate distance between two lat/lng points
 * Returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Loads stations.json and builds the track graph
 */
export function loadStations(): StationsData {
  // Handle both development (ts-node) and production (compiled) paths
  let stationsPath = path.join(__dirname, "stations.json");
  if (!fs.existsSync(stationsPath)) {
    stationsPath = path.join(__dirname, "..", "stations.json");
  }
  const rawData = fs.readFileSync(stationsPath, "utf-8");
  return JSON.parse(rawData);
}

/**
 * Loads secrStations.json for South East Central Railway (Raipur Division)
 */
export function loadSecrStations(): StationsData {
  let stationsPath = path.join(__dirname, "secrStations.json");
  if (!fs.existsSync(stationsPath)) {
    stationsPath = path.join(__dirname, "..", "secrStations.json");
  }
  const rawData = fs.readFileSync(stationsPath, "utf-8");
  return JSON.parse(rawData);
}

/**
 * Builds a track graph from stations data
 * Creates segments between consecutive stations with distances
 */
export function buildTrackGraph(stationsData: StationsData): TrackGraph {
  const stations = stationsData.stations.sort((a, b) => a.order - b.order);
  const segments: TrackSegment[] = [];
  const stationMap = new Map<string, StationCoord>();

  // Build station lookup map
  for (const station of stations) {
    stationMap.set(station.code, station);
  }

  // Build segments between consecutive stations
  let totalDistance = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);

    segments.push({ from, to, distance });
    totalDistance += distance;
  }

  // Load track data to build lane map
  const trackData = loadTrackData();
  const laneMap = buildLaneMap(trackData);

  // Load sectors metadata for per-lane geometry
  const sectorsData = loadSectorsData();
  const sectorMap = buildSectorMap(sectorsData);

  console.log(`[TrackBuilder] Built track with ${segments.length} segments`);
  console.log(`[TrackBuilder] Total track distance: ${totalDistance.toFixed(2)} km`);
  console.log(`[TrackBuilder] Built lane map with ${laneMap.size} split points`);
  console.log(`[TrackBuilder] Built sector map with ${sectorMap.size} lane paths`);

  return { segments, stationMap, totalDistance, laneMap, sectorMap };
}

/**
 * Gets the segment between two stations
 */
export function getSegment(
  trackGraph: TrackGraph,
  fromStation: string,
  toStation: string
): TrackSegment | null {
  const from = trackGraph.stationMap.get(fromStation);
  const to = trackGraph.stationMap.get(toStation);

  if (!from || !to) return null;

  return {
    from,
    to,
    distance: haversineDistance(from.lat, from.lng, to.lat, to.lng),
  };
}

/**
 * Interpolates coordinates between two points based on progress (0-1)
 */
export function interpolateCoordinates(
  from: StationCoord,
  to: StationCoord,
  progress: number
): { lat: number; lng: number } {
  const clampedProgress = Math.max(0, Math.min(1, progress));

  return {
    lat: from.lat + (to.lat - from.lat) * clampedProgress,
    lng: from.lng + (to.lng - from.lng) * clampedProgress,
  };
}

/**
 * Loads and parses track data to extract split/lane information
 */
export function loadTrackData(): Record<string, any> {
  let trackPath = path.join(__dirname, "../api/src/services/simulation/sampleTrackData.json");
  if (!fs.existsSync(trackPath)) {
    // Fallback paths
    trackPath = path.join(__dirname, "../../api/src/services/simulation/sampleTrackData.json");
  }
  if (!fs.existsSync(trackPath)) {
    console.warn("[TrackBuilder] Could not find sampleTrackData.json, skipping lane metadata");
    return {};
  }
  const rawData = fs.readFileSync(trackPath, "utf-8");
  return JSON.parse(rawData);
}

/**
 * Loads sectors.json which contains split-aware per-lane geometry
 */
export function loadSectorsData(): Record<string, any>[] {
  let sectorsPath = path.join(__dirname, "../api/src/services/simulation/sectors.json");
  if (!fs.existsSync(sectorsPath)) {
    sectorsPath = path.join(__dirname, "../../api/src/services/simulation/sectors.json");
  }
  if (!fs.existsSync(sectorsPath)) {
    console.warn("[TrackBuilder] Could not find sectors.json, lane geometry will use station interpolation");
    return [];
  }
  const rawData = fs.readFileSync(sectorsPath, "utf-8");
  return JSON.parse(rawData);
}

/**
 * Builds lane info map from track data
 */
export function buildLaneMap(trackData: Record<string, any>): Map<string, TrackLaneInfo> {
  const laneMap = new Map<string, TrackLaneInfo>();

  // Iterate through stations and their tracks
  for (const stationName in trackData) {
    const stationData = trackData[stationName];
    const tracks = stationData?.tracks || {};

    for (const trackType in tracks) {
      const trackInfo = tracks[trackType];
      const segments = trackInfo?.segments || [];

      for (const segment of segments) {
        const toStation = segment?.to_station;
        if (!toStation) continue;

        const split = segment?.split || {};
        const splitVariants = Object.keys(split);
        const laneCount = Math.max(1, splitVariants.length);

        const mapKey = `${stationName}__${toStation}__${trackType}`;
        const splits: TrackSplit[] = splitVariants.map((variant, index) => ({
          variant,
          next: split[variant]?.next?.[0] || `${toStation}.${trackType}`,
        }));

        laneMap.set(mapKey, {
          fromStation: stationName,
          toStation,
          trackType,
          splits,
          laneCount,
        });
      }
    }
  }

  return laneMap;
}

/**
 * Builds a sector path map keyed by station pair and variant
 */
export function buildSectorMap(sectorsData: Record<string, any>[]): Map<string, SectorPathInfo> {
  const sectorMap = new Map<string, SectorPathInfo>();
  if (!sectorsData || sectorsData.length === 0) return sectorMap;

  // Group sectors by from/to/variant
  const buckets = new Map<string, Record<string, any>[]>();
  for (const sector of sectorsData) {
    const variant = sector.split_variant || sector.track_type;
    const key = `${sector.from_station}__${sector.to_station}__${variant}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(sector);
  }

  for (const [key, bucket] of buckets.entries()) {
    // Sort by index to preserve geometric order
    bucket.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    let cumulative = 0;
    const segments: SectorSegment[] = bucket.map((sector) => {
      const lengthMeters =
        typeof sector.lengthMeters === "number"
          ? sector.lengthMeters
          : haversineDistance(
              sector.start.lat,
              sector.start.lng,
              sector.end.lat,
              sector.end.lng
            ) * 1000;

      const start = cumulative;
      const end = cumulative + lengthMeters;
      cumulative = end;

      return {
        sectorId: sector.sector_id,
        trackType: sector.track_type,
        splitVariant: sector.split_variant || sector.track_type,
        fromStation: sector.from_station,
        toStation: sector.to_station,
        start: sector.start,
        end: sector.end,
        index: sector.index ?? 0,
        lengthMeters,
        cumulativeStart: start,
        cumulativeEnd: end,
        laneIndex: Number.isFinite(sector.lane_index) ? sector.lane_index : 0,
        laneCount: Number.isFinite(sector.lane_count) ? sector.lane_count : 1,
      };
    });

    if (segments.length === 0) continue;

    const first = segments[0];
    sectorMap.set(key, {
      key,
      trackType: first.trackType,
      splitVariant: first.splitVariant,
      fromStation: first.fromStation,
      toStation: first.toStation,
      laneIndex: first.laneIndex,
      laneCount: segments.reduce((max, seg) => Math.max(max, seg.laneCount), first.laneCount),
      totalLengthMeters: cumulative,
      segments,
    });
  }

  return sectorMap;
}

/**
 * Allocates a train to a lane based on train ID and track
 * Uses hash-based allocation for deterministic distribution
 */
export function allocateTrainLane(
  trainId: string,
  trackType: string,
  laneCount: number,
  variants?: string[]
): { laneIndex: number; variant: string } {
  // Simple hash-based allocation: use train ID to pick a lane consistently
  let hash = 0;
  for (let i = 0; i < trainId.length; i++) {
    hash = (hash << 5) - hash + trainId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const laneIndex = Math.abs(hash) % laneCount;
  const variantList = variants && variants.length === laneCount ? variants : undefined;
  const variant = laneCount === 1
    ? trackType
    : variantList?.[laneIndex] ?? `${trackType}_${laneIndex + 1}`;
  return { laneIndex, variant };
}

export default {
  loadStations,
  buildTrackGraph,
  haversineDistance,
  getSegment,
  interpolateCoordinates,
  loadTrackData,
  buildLaneMap,
  allocateTrainLane,
};
