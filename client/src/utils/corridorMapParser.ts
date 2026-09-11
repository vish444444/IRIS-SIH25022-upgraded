/**
 * Utility to parse sampleTrackData.json and create a normalized corridor configuration
 * Computes distances between stations using Haversine formula
 */

export interface TrackConnection {
  fromStation: string
  fromTrack: string
  toStation: string
  toTrack: string
  distance: number // in meters
  laneIndex: number
  laneCount: number
}

export interface StationTrack {
  id: string // e.g., "up_slow_1", "down_fast"
  type: 'up' | 'down'
  role: 'slow' | 'fast'
  number?: number // track number if specified (e.g., 1, 2)
  next: string[] // array of "STATION.track" references
}

export interface Station {
  id: string // numeric ID
  name: string // station name
  lat: number
  lng: number
  index: number // order from south to north
  tracks: StationTrack[]
  kmFromStart: number // cumulative distance from first station
}

export interface CorridorConfig {
  stations: Station[]
  connections: TrackConnection[]
  trackTypes: {
    id: string // e.g., "up_slow", "down_fast"
    label: string
    color: string
    order: number // vertical ordering for rendering
  }[]
}

/**
 * Haversine formula to calculate distance between two lat/lng points in meters
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Parse track ID to extract type and role
 */
function parseTrackId(trackId: string): {
  type: 'up' | 'down'
  role: 'slow' | 'fast'
  number?: number
} {
  const lower = trackId.toLowerCase()
  const type = lower.includes('up') ? 'up' : 'down'
  const role = lower.includes('slow') ? 'slow' : 'fast'

  // Extract number if present (e.g., up_slow_1 -> 1)
  const numberMatch = trackId.match(/_(\d+)$/)
  const number = numberMatch ? parseInt(numberMatch[1]) : undefined

  return { type, role, number }
}

/**
 * Parse the sampleTrackData.json format and create normalized corridor config
 */
export function parseCorridorData(
  rawData: Record<string, any>
): CorridorConfig {
  const stationNames = Object.keys(rawData)
  const stations: Station[] = []
  const connections: TrackConnection[] = []
  const trackTypeSet = new Set<string>()

  // First pass: Create stations sorted by ID (south to north)
  // Sort stations South -> North using numeric part of id (supports formats like "H1", "S12", "3")
  const getIdNumber = (id: string): number => {
    if (typeof id !== 'string') return Number(id) || 0
    const match = id.match(/\d+/)
    return match ? parseInt(match[0], 10) : Number(id) || 0
  }

  const sortedStations = stationNames
    .map((name) => ({
      name,
      ...rawData[name],
    }))
    .sort((a, b) => getIdNumber(a.id) - getIdNumber(b.id))

  let cumulativeDistance = 0

  sortedStations.forEach((stationData, index) => {
    const { name, id, lat, lng, tracks: rawTracks } = stationData

    // Calculate distance from previous station
    if (index > 0) {
      const prevStation = sortedStations[index - 1]
      const distance = haversineDistance(
        prevStation.lat,
        prevStation.lng,
        lat,
        lng
      )
      cumulativeDistance += distance
    }

    const tracks: StationTrack[] = []

    // New structure: each track_type contains segments with splits (lanes)
    Object.entries(rawTracks).forEach(([trackTypeKey, trackValue]: any) => {
      const { type, role } = parseTrackId(trackTypeKey)
      const baseTrackType = `${type}_${role}`
      trackTypeSet.add(baseTrackType)

      const segments = trackValue?.segments ?? []
      segments.forEach((segment: any) => {
        const split = segment?.split ?? {}
        Object.keys(split).forEach((splitVariant) => {
          const { number } = parseTrackId(splitVariant)
          const nextConnections = split[splitVariant]?.next ?? []

          tracks.push({
            id: splitVariant,
            type,
            role,
            number,
            next: nextConnections,
          })
        })
      })
    })

    stations.push({
      id,
      name,
      lat,
      lng,
      index,
      tracks,
      kmFromStart: cumulativeDistance / 1000, // convert to km
    })
  })

  // Second pass: Create connections
  stations.forEach((station) => {
    // Group tracks by base type to determine lane counts for parallel rendering
    const baseToVariants = new Map<string, StationTrack[]>()
    station.tracks.forEach((track) => {
      const base = getNormalizedTrackType(track.id)
      if (!baseToVariants.has(base)) baseToVariants.set(base, [])
      baseToVariants.get(base)!.push(track)
    })

    baseToVariants.forEach((variants, base) => {
      const laneCount = variants.length || 1
      variants.forEach((track, laneIndex) => {
        track.next.forEach((nextRef) => {
          const [nextStationName, nextTrackId] = nextRef.split('.')
          const nextStation = stations.find((s) => s.name === nextStationName)

          if (nextStation) {
            const distance = haversineDistance(
              station.lat,
              station.lng,
              nextStation.lat,
              nextStation.lng
            )

            connections.push({
              fromStation: station.name,
              fromTrack: track.id,
              toStation: nextStation.name,
              toTrack: nextTrackId,
              distance,
              laneIndex,
              laneCount,
            })
          }
        })
      })
    })
  })

  // Create track types with colors and ordering
  const trackTypes = Array.from(trackTypeSet)
    .sort()
    .map((trackType, index) => {
      const [type, role] = trackType.split('_')
      let color = '#6b7280' // default gray
      let order = index

      // Assign colors based on type and role
      if (type === 'up' && role === 'slow') {
        color = '#22c55e' // green
        order = 0
      } else if (type === 'up' && role === 'fast') {
        color = '#10b981' // emerald
        order = 1
      } else if (type === 'down' && role === 'fast') {
        color = '#3b82f6' // blue
        order = 2
      } else if (type === 'down' && role === 'slow') {
        color = '#2563eb' // indigo
        order = 3
      }

      return {
        id: trackType,
        label: `${type.toUpperCase()} ${role.toUpperCase()}`,
        color,
        order,
      }
    })

  // Compress ordering so that only present track types occupy sequential rows.
  // This prevents gaps when some expected orders (e.g. `down_slow` = 3) exist
  // but only a subset of track types is present in the dataset.
  if (trackTypes.length > 0) {
    const sortedByOrder = [...trackTypes].sort((a, b) => a.order - b.order)
    const orderMap = new Map<string, number>()
    sortedByOrder.forEach((t, i) => orderMap.set(t.id, i))
    for (let t of trackTypes) {
      t.order = orderMap.get(t.id) ?? t.order
    }
  }

  return {
    stations,
    connections,
    trackTypes,
  }
}

/**
 * Get the normalized track type for a specific track
 * (removes numbers, e.g., "up_slow_1" -> "up_slow")
 */
export function getNormalizedTrackType(trackId: string): string {
  const { type, role } = parseTrackId(trackId)
  return `${type}_${role}`
}
