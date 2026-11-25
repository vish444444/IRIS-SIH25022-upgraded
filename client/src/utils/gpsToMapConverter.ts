/**
 * Utility to convert GPS coordinates to map positions.
 * Uses exact 2D piecewise segment projection across corridor stations
 * so curves, East-West segments (SECR), and bends (e.g. Mumbra) stay linear-accurate.
 */

import rawTrackData from "../../../api/src/services/simulation/sampleTrackData.json";

export interface Station {
  name: string;
  lat: number;
  lng: number;
  id: string;
}

interface GPSBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface MapDimensions {
  width: number;
  height: number;
  paddingX: number;
  paddingY: number;
}

let cachedStations: Station[] | null = null;
let cachedBounds: GPSBounds | null = null;

function parseStations(): Station[] {
  if (cachedStations) return cachedStations;
  const stationNames = Object.keys(rawTrackData);
  cachedStations = stationNames
    .map((name) => {
      const data = (rawTrackData as Record<string, any>)[name];
      return {
        name,
        lat: data.lat,
        lng: data.lng,
        id: data.id,
      };
    })
    .sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  return cachedStations;
}

export function getGPSBounds(): GPSBounds {
  if (cachedBounds) return cachedBounds;
  const stations = parseStations();
  const lats = stations.map((s) => s.lat);
  const lngs = stations.map((s) => s.lng);

  cachedBounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
  return cachedBounds;
}

export function getStations(): Station[] {
  return parseStations();
}

export function findNearestStation(
  lat: number,
  lng: number,
  customStations?: Station[]
): { station: Station; distance: number } | null {
  const stations = customStations || parseStations();
  if (stations.length === 0) return null;

  let nearest: Station = stations[0];
  let minDistance = haversineDistance(lat, lng, nearest.lat, nearest.lng);

  for (let i = 1; i < stations.length; i++) {
    const station = stations[i];
    const distance = haversineDistance(lat, lng, station.lat, station.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = station;
    }
  }

  return { station: nearest, distance: minDistance };
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export class GPSToMapConverter {
  private bounds: GPSBounds;
  private stations: Station[];
  private mapWidth: number;
  private paddingX: number;
  private kmToPixels: number;
  private cumulativeKm: number[];

  constructor(
    dimensions: MapDimensions,
    kmToPixels: number = 150,
    customStations?: Station[]
  ) {
    this.stations = customStations || parseStations();
    const lats = this.stations.map((s) => s.lat);
    const lngs = this.stations.map((s) => s.lng);
    this.bounds = {
      minLat: lats.length > 0 ? Math.min(...lats) : 0,
      maxLat: lats.length > 0 ? Math.max(...lats) : 0,
      minLng: lngs.length > 0 ? Math.min(...lngs) : 0,
      maxLng: lngs.length > 0 ? Math.max(...lngs) : 0,
    };
    this.mapWidth = dimensions.width;
    this.paddingX = dimensions.paddingX;
    this.kmToPixels = kmToPixels;

    this.cumulativeKm = [0];
    let total = 0;
    for (let i = 0; i < this.stations.length - 1; i++) {
      const a = this.stations[i];
      const b = this.stations[i + 1];
      total += haversineDistance(a.lat, a.lng, b.lat, b.lng) / 1000;
      this.cumulativeKm.push(total);
    }
  }

  /**
   * Exact 2D projection along the piecewise linear corridor polyline.
   * Accurately maps both North-South (CR) and East-West / diagonal (SECR) segments.
   */
  public getDistanceFromStart(lat: number, lng: number): number {
    const stations = this.stations;
    if (stations.length <= 1) return 0;

    let bestDistSq = Infinity;
    let bestKm = 0;

    // Cosine latitude correction keeps lat/lng scaling metric-faithful
    const cosLat = Math.cos((lat * Math.PI) / 180);

    for (let i = 0; i < stations.length - 1; i++) {
      const a = stations[i];
      const b = stations[i + 1];

      const ax = a.lng * cosLat;
      const ay = a.lat;
      const bx = b.lng * cosLat;
      const by = b.lat;
      const px = lng * cosLat;
      const py = lat;

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;

      let t = 0;
      if (lenSq > 1e-12) {
        t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
      }

      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const distSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        const segLenKm = this.cumulativeKm[i + 1] - this.cumulativeKm[i];
        bestKm = this.cumulativeKm[i] + segLenKm * t;
      }
    }

    return bestKm;
  }

  getXPosition(lat: number, lng: number): number {
    const distanceFromStart = this.getDistanceFromStart(lat, lng);
    const x = this.paddingX + distanceFromStart * this.kmToPixels;
    return Math.max(this.paddingX, Math.min(this.mapWidth - this.paddingX, x));
  }

  getYPosition(trackIndex: number = 0): number {
    const trackSpacing = 35;
    const baseY = 60;
    return baseY + trackIndex * trackSpacing + trackSpacing / 2;
  }

  convert(lat: number, lng: number, trackIndex: number = 0): { x: number; y: number } {
    return {
      x: this.getXPosition(lat, lng),
      y: this.getYPosition(trackIndex),
    };
  }

  getTotalTrackLength(): number {
    return this.cumulativeKm[this.cumulativeKm.length - 1] || 0;
  }

  getStationBounds(): GPSBounds {
    return this.bounds;
  }
}

/**
 * Determine track index (Y position row) from explicit trackType or corridor-aware direction.
 * Row ordering: 0 = up_slow, 1 = up_fast, 2 = down_fast, 3 = down_slow.
 */
export function getTrackIndexForType(
  trainType: string,
  destination?: string,
  _currentLat?: number,
  trackType?: string
): number {
  if (trackType) {
    const lower = trackType.toLowerCase();
    if (lower.startsWith("up_slow")) return 0;
    if (lower.startsWith("up_fast")) return 1;
    if (lower.startsWith("down_fast")) return 2;
    if (lower.startsWith("down_slow")) return 3;
  }

  const dest = destination?.toUpperCase() || "";
  const downTerms = ["CSMT", "CHURCHGATE", "CST", "VT", "DURG", "BPHB", "BIA", "SRWN"];
  const isGoingDown = downTerms.some((d) => dest.includes(d));
  const isFast = trainType === "fast" || trainType === "ac";

  if (isGoingDown) {
    return isFast ? 2 : 3;
  }
  return isFast ? 1 : 0;
}
