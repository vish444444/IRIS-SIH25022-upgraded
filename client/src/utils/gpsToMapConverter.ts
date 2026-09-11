/**
 * Utility to convert GPS coordinates to map positions
 * Uses the track data to establish coordinate bounds and linear interpolation
 */

import rawTrackData from "../../../api/src/services/simulation/sampleTrackData.json";

interface Station {
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

// Module-level cache for static station and bounds data
let cachedStations: Station[] | null = null;
let cachedBounds: GPSBounds | null = null;

/**
 * Parse the raw track data to extract stations with coordinates (cached)
 */
function parseStations(): Station[] {
  if (cachedStations) return cachedStations;
  const stationNames = Object.keys(rawTrackData);
  cachedStations = stationNames.map((name) => {
    const data = (rawTrackData as Record<string, any>)[name];
    return {
      name,
      lat: data.lat,
      lng: data.lng,
      id: data.id,
    };
  }).sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
  return cachedStations;
}

/**
 * Get the GPS bounds from all stations (cached)
 */
export function getGPSBounds(): GPSBounds {
  if (cachedBounds) return cachedBounds;
  const stations = parseStations();
  
  const lats = stations.map(s => s.lat);
  const lngs = stations.map(s => s.lng);

  cachedBounds = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
  return cachedBounds;
}

/**
 * Get station information for reference
 */
export function getStations(): Station[] {
  return parseStations();
}

/**
 * Find the nearest station to given coordinates
 */
export function findNearestStation(lat: number, lng: number): { station: Station; distance: number } | null {
  const stations = parseStations();
  
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

/**
 * Haversine formula to calculate distance between two lat/lng points in meters
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
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

/**
 * Converter class to map GPS coordinates to screen positions
 * The map is rendered as a horizontal line from CSMT (south) to Kalyan (north)
 * X position is determined by distance along the track (primarily latitude-based)
 */
export class GPSToMapConverter {
  private bounds: GPSBounds;
  private stations: Station[];
  private mapWidth: number;
  private paddingX: number;
  private kmToPixels: number;

  constructor(dimensions: MapDimensions, kmToPixels: number = 150) {
    this.bounds = getGPSBounds();
    this.stations = parseStations();
    this.mapWidth = dimensions.width;
    this.paddingX = dimensions.paddingX;
    this.kmToPixels = kmToPixels;
  }

  /**
   * Convert GPS coordinates to X position on the map
   * Uses linear interpolation based on distance from start (CSMT)
   */
  getXPosition(lat: number, lng: number): number {
    // Find the two stations the train is between
    const distanceFromStart = this.getDistanceFromStart(lat, lng);
    
    // Convert km to pixels
    const x = this.paddingX + (distanceFromStart * this.kmToPixels);
    
    return Math.max(this.paddingX, Math.min(this.mapWidth - this.paddingX, x));
  }

  /**
   * Get Y position based on track type
   * For now, return a default middle position
   * This can be extended to use track type from train data
   */
  getYPosition(trackIndex: number = 0): number {
    const trackSpacing = 35;
    const baseY = 60; // After station labels
    return baseY + (trackIndex * trackSpacing) + trackSpacing / 2;
  }

  /**
   * Calculate distance from the start station (CSMT) in km
   * Uses cumulative distance along the track, with lng for haversine accuracy
   */
  private getDistanceFromStart(lat: number, lng: number): number {
    const stations = this.stations;
    const firstStation = stations[0];

    // If only one station, return 0
    if (stations.length <= 1) {
      return 0;
    }

    // Find which segment the point is in
    let cumulativeDistance = 0;

    for (let i = 0; i < stations.length - 1; i++) {
      const current = stations[i];
      const next = stations[i + 1];

      const segmentLength = haversineDistance(
        current.lat, current.lng,
        next.lat, next.lng
      ) / 1000; // Convert to km

      // Check if point is roughly in this segment
      // Using latitude as primary indicator since track runs roughly south to north
      // Handle both increasing and decreasing latitude
      const minSegmentLat = Math.min(current.lat, next.lat);
      const maxSegmentLat = Math.max(current.lat, next.lat);
      
      if (lat >= minSegmentLat && lat <= maxSegmentLat) {
        // Use haversine distance from segment start for more accurate positioning
        const distanceFromCurrent = haversineDistance(current.lat, current.lng, lat, lng) / 1000;
        return cumulativeDistance + Math.min(distanceFromCurrent, segmentLength);
      }

      cumulativeDistance += segmentLength;
    }

    // If beyond last station, return total distance
    const lastStation = stations[stations.length - 1];
    if (lat > lastStation.lat) {
      return cumulativeDistance;
    }
    
    // If before first station, return 0
    if (lat < firstStation.lat) {
      return 0;
    }

    // Fallback: use direct distance interpolation
    const totalLatRange = this.bounds.maxLat - this.bounds.minLat;
    const latProgress = (lat - this.bounds.minLat) / totalLatRange;
    return latProgress * cumulativeDistance;
  }

  /**
   * Convert GPS coordinates to map coordinates
   */
  convert(lat: number, lng: number, trackIndex: number = 0): { x: number; y: number } {
    return {
      x: this.getXPosition(lat, lng),
      y: this.getYPosition(trackIndex),
    };
  }

  /**
   * Get the total track length in km
   */
  getTotalTrackLength(): number {
    let total = 0;
    for (let i = 0; i < this.stations.length - 1; i++) {
      const current = this.stations[i];
      const next = this.stations[i + 1];
      total += haversineDistance(current.lat, current.lng, next.lat, next.lng) / 1000;
    }
    return total;
  }
}

/**
 * Determine track index (Y position) based on train type and direction
 * Direction is determined by comparing current position to destination
 * 
 * Track order:
 * - up_slow (0): Slow trains going UP (towards Kalyan/north)
 * - up_fast (1): Fast trains going UP (towards Kalyan/north)
 * - down_fast (2): Fast trains going DOWN (towards CSMT/south)
 * - down_slow (3): Slow trains going DOWN (towards CSMT/south)
 * 
 * @param trainType - "slow", "fast", "womens", or "ac"
 * @param destination - destination station name (e.g., "KALYAN", "CSMT")
 * @param currentLat - current latitude of the train
 */
export function getTrackIndexForType(trainType: string, destination?: string, _currentLat?: number): number {
  // Determine direction based on destination
  // CSMT is in the south (lower lat ~19.08), Kalyan is in the north (higher lat ~19.24)
  // If destination contains "CSMT" or similar south stations -> going DOWN (south)
  // Otherwise -> going UP (north)
  
  const isGoingDown = destination?.toUpperCase().includes("CSMT") || 
                      destination?.toUpperCase().includes("CST") ||
                      destination?.toUpperCase().includes("VT");
  
  const isFast = trainType === "fast" || trainType === "ac";
  
  if (isGoingDown) {
    // Going DOWN (towards CSMT) - use down tracks
    return isFast ? 2 : 3; // down_fast (2) or down_slow (3)
  } else {
    // Going UP (towards Kalyan) - use up tracks
    return isFast ? 1 : 0; // up_fast (1) or up_slow (0)
  }
}
