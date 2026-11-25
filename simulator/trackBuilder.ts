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
  variant: string;
  next: string;
}

export interface TrackLaneInfo {
  fromStation: string;
  toStation: string;
  trackType: string;
  splits: TrackSplit[];
  laneCount: number;
}

export interface TrackGraph {
  lineId: string;
  segments: TrackSegment[];
  orderedStations: StationCoord[];
  stationMap: Map<string, StationCoord>;
  totalDistance: number;
  laneMap?: Map<string, TrackLaneInfo>;
  sectorMap?: Map<string, SectorPathInfo>;
  multiHopCache?: Map<string, SectorPathInfo | null>;
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

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
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

export function loadStations(): StationsData {
  let stationsPath = path.join(__dirname, "stations.json");
  if (!fs.existsSync(stationsPath)) {
    stationsPath = path.join(__dirname, "..", "stations.json");
  }
  const rawData = fs.readFileSync(stationsPath, "utf-8");
  return JSON.parse(rawData);
}

export function loadSecrStations(): StationsData {
  let stationsPath = path.join(__dirname, "secrStations.json");
  if (!fs.existsSync(stationsPath)) {
    stationsPath = path.join(__dirname, "..", "secrStations.json");
  }
  const rawData = fs.readFileSync(stationsPath, "utf-8");
  return JSON.parse(rawData);
}

export function buildTrackGraph(stationsData: StationsData): TrackGraph {
  const lineId = stationsData.line_id || "csmt-kalyan";
  const stations = [...stationsData.stations].sort((a, b) => a.order - b.order);
  const segments: TrackSegment[] = [];
  const stationMap = new Map<string, StationCoord>();

  for (const station of stations) {
    stationMap.set(station.code, station);
  }

  let totalDistance = 0;
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);

    segments.push({ from, to, distance });
    totalDistance += distance;
  }

  // Load corridor-specific track and sector geometry (CR vs SECR Raipur)
  const trackData = loadTrackData(lineId);
  const laneMap = buildLaneMap(trackData);

  const sectorsData = loadSectorsData(lineId);
  const sectorMap = buildSectorMap(sectorsData);

  console.log(`[TrackBuilder][${lineId}] Built ${segments.length} segments (${totalDistance.toFixed(2)} km), ${laneMap.size} lanes, ${sectorMap.size} sector chains`);

  return {
    lineId,
    segments,
    orderedStations: stations,
    stationMap,
    totalDistance,
    laneMap,
    sectorMap,
    multiHopCache: new Map(),
  };
}

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

function resolveSimulationDataFile(filename: string): string | null {
  const candidates = [
    path.join(__dirname, "../api/src/services/simulation", filename),
    path.join(__dirname, "../../api/src/services/simulation", filename),
    path.resolve(process.cwd(), "api/src/services/simulation", filename),
    path.resolve(process.cwd(), "../api/src/services/simulation", filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function loadTrackData(lineId: string = "csmt-kalyan"): Record<string, any> {
  const filename = lineId === "secr-raipur" ? "sampleTrackSecrRaipurData.json" : "sampleTrackData.json";
  const trackPath = resolveSimulationDataFile(filename);
  if (!trackPath) {
    console.warn(`[TrackBuilder] Could not find ${filename}, skipping lane metadata`);
    return {};
  }
  return JSON.parse(fs.readFileSync(trackPath, "utf-8"));
}

export function loadSectorsData(lineId: string = "csmt-kalyan"): Record<string, any>[] {
  const filename = lineId === "secr-raipur" ? "sectorsSecrRaipur.json" : "sectors.json";
  const sectorsPath = resolveSimulationDataFile(filename);
  if (!sectorsPath) {
    console.warn(`[TrackBuilder] Could not find ${filename}, using station interpolation`);
    return [];
  }
  return JSON.parse(fs.readFileSync(sectorsPath, "utf-8"));
}

export function buildLaneMap(trackData: Record<string, any>): Map<string, TrackLaneInfo> {
  const laneMap = new Map<string, TrackLaneInfo>();

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
        const splits: TrackSplit[] = splitVariants.map((variant) => ({
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

export function buildSectorMap(sectorsData: Record<string, any>[]): Map<string, SectorPathInfo> {
  const sectorMap = new Map<string, SectorPathInfo>();
  if (!sectorsData || sectorsData.length === 0) return sectorMap;

  const buckets = new Map<string, Record<string, any>[]>();
  for (const sector of sectorsData) {
    const variant = sector.split_variant || sector.track_type;
    const key = `${sector.from_station}__${sector.to_station}__${variant}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(sector);
  }

  for (const [key, bucket] of buckets.entries()) {
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
 * Resolves single-hop OR multi-hop composite sector chains between two stations
 * so fast/express trains skipping intermediate stops still track exact sectors.
 */
export function resolveCompositeSectorPath(
  trackGraph: TrackGraph,
  fromStation: string,
  toStation: string,
  trackVariant?: string,
  trackType?: string
): SectorPathInfo | undefined {
  const sectorMap = trackGraph.sectorMap;
  if (!sectorMap || fromStation === toStation) return undefined;

  const cacheKey = `${fromStation}__${toStation}__${trackVariant || trackType || ""}`;
  if (trackGraph.multiHopCache?.has(cacheKey)) {
    return trackGraph.multiHopCache.get(cacheKey) || undefined;
  }

  const pickHop = (a: string, b: string): SectorPathInfo | undefined => {
    const candidates = [
      trackVariant ? `${a}__${b}__${trackVariant}` : "",
      trackType ? `${a}__${b}__${trackType}` : "",
      trackType ? `${a}__${b}__${trackType}_1` : "",
      trackType ? `${a}__${b}__${trackType}_2` : "",
    ].filter(Boolean);

    for (const k of candidates) {
      const hit = sectorMap.get(k);
      if (hit) return hit;
    }

    for (const val of sectorMap.values()) {
      if (val.fromStation === a && val.toStation === b && (!trackType || val.trackType.startsWith(trackType))) {
        return val;
      }
    }
    return undefined;
  };

  // Direct adjacent hop check
  const direct = pickHop(fromStation, toStation);
  if (direct) {
    trackGraph.multiHopCache?.set(cacheKey, direct);
    return direct;
  }

  // Multi-hop stitch across intermediate corridor stations
  const stations = trackGraph.orderedStations;
  const fromIdx = stations.findIndex((s) => s.code === fromStation);
  const toIdx = stations.findIndex((s) => s.code === toStation);
  if (fromIdx === -1 || toIdx === -1) {
    trackGraph.multiHopCache?.set(cacheKey, null);
    return undefined;
  }

  const step = toIdx > fromIdx ? 1 : -1;
  const stitchedSegments: SectorSegment[] = [];
  let cumulative = 0;

  for (let i = fromIdx; i !== toIdx; i += step) {
    const a = stations[i].code;
    const b = stations[i + step].code;
    const hop = pickHop(a, b);
    if (!hop) continue;

    for (const seg of hop.segments) {
      const start = cumulative;
      const end = cumulative + seg.lengthMeters;
      cumulative = end;
      stitchedSegments.push({
        ...seg,
        cumulativeStart: start,
        cumulativeEnd: end,
      });
    }
  }

  if (stitchedSegments.length === 0) {
    trackGraph.multiHopCache?.set(cacheKey, null);
    return undefined;
  }

  const first = stitchedSegments[0];
  const composite: SectorPathInfo = {
    key: cacheKey,
    trackType: trackType || first.trackType,
    splitVariant: trackVariant || first.splitVariant,
    fromStation,
    toStation,
    laneIndex: first.laneIndex,
    laneCount: stitchedSegments.reduce((max, s) => Math.max(max, s.laneCount), first.laneCount),
    totalLengthMeters: cumulative,
    segments: stitchedSegments,
  };

  trackGraph.multiHopCache?.set(cacheKey, composite);
  return composite;
}

export function allocateTrainLane(
  trainId: string,
  trackType: string,
  laneCount: number,
  variants?: string[]
): { laneIndex: number; variant: string } {
  let hash = 0;
  for (let i = 0; i < trainId.length; i++) {
    hash = (hash << 5) - hash + trainId.charCodeAt(i);
    hash = hash & hash;
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
  loadSecrStations,
  buildTrackGraph,
  haversineDistance,
  getSegment,
  interpolateCoordinates,
  loadTrackData,
  loadSectorsData,
  buildLaneMap,
  resolveCompositeSectorPath,
  allocateTrainLane,
};
