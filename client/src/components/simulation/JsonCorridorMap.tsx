import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { useLiveTrains } from '../../hooks/useLiveTrains'
import { useIsDarkMode } from '../theme-provider'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  Train as TrainIcon,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Maximize2,
  Activity,
  Crosshair,
} from 'lucide-react'
import {
  parseCorridorData,
  getNormalizedTrackType,
  type CorridorConfig,
} from '../../utils/corridorMapParser'
import { LiveTrainsLayer } from './LiveTrainsLayer'
import { StringlineChart } from './StringlineChart'
import {
  LineId,
  LiveTrainData,
  TRAIN_TYPE_COLORS,
  TRAIN_TYPE_LABELS,
} from '../../types/liveTrains.types'
import {
  getTrackIndexForType,
  GPSToMapConverter,
} from '../../utils/gpsToMapConverter'
import { getBlockedSectors } from '../../services/sectorBlockageService'
import { TrackClosure } from '../../types/simulation.types'
import { SectorBlockageDialog } from './SectorBlockageDialog'
import axios from 'axios'

// Import raw track data
import rawTrackData from '../../../../api/src/services/simulation/sampleTrackData.json'
import sectorsData from '../../../../api/src/services/simulation/sectors.json'
import rawTrackSecrData from '../../../../api/src/services/simulation/sampleTrackSecrRaipurData.json'
import sectorsSecrData from '../../../../api/src/services/simulation/sectorsSecrRaipur.json'

// ── Corridor Layout Dimensions ──
// These control the SVG coordinate space (not pixels on screen).
// The SVG viewBox maps these into the actual container.
const TRACK_HEIGHT = 14
const TRACK_SPACING = 70
const GROUP_SPACING = 40
const STATION_LABEL_HEIGHT = 55
const KM_TO_PIXELS = 240
const LANE_GAP = 22

interface JsonCorridorMapProps {
  onTrainClick?: (trainId: string) => void
  focusedTrainId?: string | null
  focusedSectorId?: string | null
  lineId?: LineId
  onSectorBlockageUpdate?: () => void
}

interface PrecomputedSector {
  sector_id: string
  track_type: string
  split_variant: string
  lane_index: number
  lane_count: number
  from_station: string
  to_station: string
  startX: number
  endX: number
  minX: number
  maxX: number
  y: number
  lengthMeters: number
  next_sectors: string[]
  prev_sectors: string[]
  startLat: number
  endLat: number
}

// Major key stations for quick navigation
const CR_QUICK_STATIONS = [
  'CSMT',
  'BYCULLA',
  'DADAR',
  'KURLA',
  'GHATKOPAR',
  'VIKHROLI',
  'BHANDUP',
  'THANE',
  'DIVA',
  'DOMBIVLI',
  'KALYAN',
]

const SECR_QUICK_STATIONS = [
  'DURG',
  'BPHB',
  'BIA',
  'KMI',
  'R',
  'WRC',
  'URK',
  'TLD',
  'BYT',
  'BSP',
]

export const JsonCorridorMap: React.FC<JsonCorridorMapProps> = ({
  onTrainClick,
  focusedTrainId,
  focusedSectorId,
  lineId = 'csmt-kalyan',
  onSectorBlockageUpdate,
}) => {
  const { update } = useSimulation()

  const isDarkMode = useIsDarkMode()

  // Live train polling (1000ms high-frequency telemetry)
  const {
    trains: liveTrains,
    totalTrains: liveTrainCount,
    countByType,
  } = useLiveTrains({
    pollInterval: 1000,
    enabled: true,
  })

  const [followTrainLock, setFollowTrainLock] = useState(false)
  const [showStringline, setShowStringline] = useState(false)

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    content: string
    x: number
    y: number
  } | null>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sector blockage & closure state
  const [blockedSectors, setBlockedSectors] = useState<Set<string>>(new Set())
  const [trackClosures, setTrackClosures] = useState<TrackClosure[]>([])
  const [blockageDialogOpen, setBlockageDialogOpen] = useState(false)
  const [selectedSectorForBlockage, setSelectedSectorForBlockage] = useState<{
    sectorId: string
    sectorInfo?: { from_station: string; to_station: string; track_type: string }
  } | null>(null)

  const [activeQuickStation, setActiveQuickStation] = useState<string | null>(null)

  const getApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_SERVER_URL
    if (
      envUrl &&
      envUrl !== 'undefined' &&
      envUrl !== 'serverurl' &&
      envUrl.startsWith('http')
    ) {
      return envUrl
    }
    return 'http://localhost:3000'
  }

  // ── View State ──
  // viewBox controls what portion of the SVG coordinate space is visible.
  // Default: show a comfortable portion. Zoom/pan to navigate.
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [isFocusedOnTrain, setIsFocusedOnTrain] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, vbX: 0, vbY: 0 })
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 400 })

  // Container dimensions
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setContainerSize({ width, height })
        }
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const isSecr = lineId === 'secr-raipur'
  const kmToPixels = isSecr ? 110 : KM_TO_PIXELS
  const rawTrack = isSecr ? rawTrackSecrData : rawTrackData
  const activeSectorsRaw = (isSecr ? sectorsSecrData : sectorsData) as any[]
  const quickStations = isSecr ? SECR_QUICK_STATIONS : CR_QUICK_STATIONS

  const corridorTrains = useMemo(
    () => liveTrains.filter((t) => t.line_id === lineId),
    [liveTrains, lineId]
  )

  const corridorCountByType = useMemo(() => {
    const counts: Record<string, number> = { slow: 0, fast: 0, womens: 0, ac: 0 }
    corridorTrains.forEach((t) => {
      counts[t.type] = (counts[t.type] || 0) + 1
    })
    return counts
  }, [corridorTrains])

  // 1. Corridor Configuration (Memoized)
  const corridorConfig = useMemo<CorridorConfig>(() => {
    return parseCorridorData(rawTrack)
  }, [rawTrack])

  // 2. Base Layout Coordinates
  const layout = useMemo(() => {
    const { stations, trackTypes } = corridorConfig

    const totalWidth =
      Math.max(...stations.map((s) => s.kmFromStart)) * kmToPixels + 400
    const totalHeight =
      STATION_LABEL_HEIGHT +
      trackTypes.length * (TRACK_HEIGHT + TRACK_SPACING) +
      GROUP_SPACING * 2

    const stationPositions = new Map<string, number>()
    stations.forEach((station) => {
      stationPositions.set(
        station.name,
        station.kmFromStart * kmToPixels + 150
      )
    })

    const trackYPositions = new Map<string, number>()
    trackTypes.forEach((trackType) => {
      trackYPositions.set(
        trackType.id,
        STATION_LABEL_HEIGHT +
          GROUP_SPACING +
          trackType.order * (TRACK_HEIGHT + TRACK_SPACING)
      )
    })

    // Precomputed continuous mainline tracks for background rendering (sorted by vertical order)
    const continuousTracks = [...trackTypes]
      .sort((a, b) => a.order - b.order)
      .map((tt) => {
        const y = trackYPositions.get(tt.id) || 0
        const startX = 100
        const endX = totalWidth - 100
        return {
          id: tt.id,
          label: tt.label,
          color: tt.color,
          order: tt.order,
          y,
          startX,
          endX,
        }
      })

    return {
      stations,
      stationPositions,
      trackYPositions,
      continuousTracks,
      trackTypes,
      totalWidth,
      totalHeight,
    }
  }, [corridorConfig, kmToPixels])

  // 3. Static Precomputed Sector Geometry (Evaluated ONCE, 0 recalculation on render)
  const { precomputedSectors, sectorsById } = useMemo(() => {
    const converter = new GPSToMapConverter(
      {
        width: layout.totalWidth,
        height: layout.totalHeight,
        paddingX: 150,
        paddingY: 40,
      },
      kmToPixels,
      corridorConfig.stations
    )

    const list: PrecomputedSector[] = []
    const byId = new Map<string, PrecomputedSector>()

    for (const sector of activeSectorsRaw) {
      const trackType = getNormalizedTrackType(sector.track_type)
      const baseTrackY = layout.trackYPositions.get(trackType) || 0
      const laneCount = sector.lane_count || 1
      const laneIndex = sector.lane_index || 0
      const laneOffset =
        laneCount > 1
          ? (laneIndex - (laneCount - 1) / 2) * LANE_GAP
          : 0
      const laneY = baseTrackY + laneOffset

      const startPos = converter.convert(sector.start.lat, sector.start.lng, 0)
      const endPos = converter.convert(sector.end.lat, sector.end.lng, 0)

      const startX = startPos.x
      const endX = endPos.x
      const minX = Math.min(startX, endX)
      const maxX = Math.max(startX, endX)
      const sectorY = laneY + TRACK_HEIGHT / 2

      const computed: PrecomputedSector = {
        sector_id: sector.sector_id,
        track_type: sector.track_type,
        split_variant: sector.split_variant || sector.track_type,
        lane_index: laneIndex,
        lane_count: laneCount,
        from_station: sector.from_station,
        to_station: sector.to_station,
        startX,
        endX,
        minX,
        maxX,
        y: sectorY,
        lengthMeters: sector.lengthMeters || 300,
        next_sectors: sector.next_sectors || [],
        prev_sectors: sector.prev_sectors || [],
        startLat: sector.start.lat,
        endLat: sector.end.lat,
      }

      list.push(computed)
      byId.set(sector.sector_id, computed)
    }

    return { precomputedSectors: list, sectorsById: byId }
  }, [layout])

  // Track Type Normalizer
  const normalizeSectorTrackType = useCallback(
    (trackType: string): 'up_slow' | 'down_slow' | 'up_fast' | 'down_fast' | null => {
      const t = trackType.toLowerCase()
      if (t.startsWith('up_slow')) return 'up_slow'
      if (t.startsWith('down_slow')) return 'down_slow'
      if (t.startsWith('up_fast')) return 'up_fast'
      if (t.startsWith('down_fast')) return 'down_fast'
      return null
    },
    []
  )

  const getTrainDirection = useCallback((train: any): 'up' | 'down' => {
    if (train.trackType) {
      const lower = train.trackType.toLowerCase()
      if (lower.startsWith('up')) return 'up'
      if (lower.startsWith('down')) return 'down'
    }
    const dest = train.destination?.toUpperCase() || ''
    const upTerms = ['KALYAN', 'KASARA', 'KHOPOLI', 'TITWALA', 'ASANGAON', 'AMBERNATH', 'BSP', 'BILASPUR', 'BYT', 'TLD']
    const downTerms = ['CSMT', 'CHURCHGATE', 'CST', 'VT', 'DURG', 'BPHB', 'BIA', 'SRWN']

    if (upTerms.some((d) => dest.includes(d))) return 'up'
    if (downTerms.some((d) => dest.includes(d))) return 'down'
    return train.lat < 19.087 ? 'up' : 'down'
  }, [])

  const getTrainTrackKey = useCallback(
    (train: any): 'up_slow' | 'down_slow' | 'up_fast' | 'down_fast' | null => {
      const normalized = train.trackType ? normalizeSectorTrackType(train.trackType) : null
      if (normalized) return normalized
      const dir = getTrainDirection(train)
      const speed = train.type === 'fast' || train.type === 'ac' ? 'fast' : 'slow'
      return `${dir}_${speed}` as const
    },
    [getTrainDirection, normalizeSectorTrackType]
  )

  // 4. Signal Computation (Optimized corridor-filtered lookup)
  const SIGNAL_COLORS = {
    RED: '#ef4444',
    YELLOW: '#eab308',
    DOUBLE_YELLOW: '#f97316',
    GREEN: '#22c55e',
  }

  const sectorSignals = useMemo(() => {
    const signals = new Map<
      string,
      { color: string; borderColor: string; status: 'OCCUPIED' | 'CAUTION' | 'PRELIMINARY_CAUTION' | 'CLEAR' }
    >()

    const occupiedSectorIds = new Set<string>()

    corridorTrains.forEach((train) => {
      const trainTrackKey = getTrainTrackKey(train)
      if (!trainTrackKey) return

      // Exact sectorId match (authoritative from physics loop)
      if (train.sectorId) {
        const sector = sectorsById.get(train.sectorId)
        if (sector) {
          occupiedSectorIds.add(sector.sector_id)
          return
        }
      }

      // Fallback GPS 2D bounding match on matching track key
      precomputedSectors.forEach((sector) => {
        const sectorTrackKey = normalizeSectorTrackType(sector.track_type)
        if (sectorTrackKey !== trainTrackKey) return
        if (
          train.lat >= Math.min(sector.startLat, sector.endLat) - 0.002 &&
          train.lat <= Math.max(sector.startLat, sector.endLat) + 0.002
        ) {
          occupiedSectorIds.add(sector.sector_id)
        }
      })
    })

    occupiedSectorIds.forEach((sectorId) => {
      signals.set(sectorId, {
        color: SIGNAL_COLORS.RED,
        borderColor: '#dc2626',
        status: 'OCCUPIED',
      })
    })

    // Propagate caution signals (1-block behind occupied = yellow, 2-blocks behind = double-yellow)
    occupiedSectorIds.forEach((occId) => {
      const occupiedSector = sectorsById.get(occId)
      if (!occupiedSector) return

      let currentLevel = [...occupiedSector.prev_sectors]
      const levels = [
        { status: 'CAUTION' as const, color: SIGNAL_COLORS.YELLOW, borderColor: '#ca8a04' },
        { status: 'PRELIMINARY_CAUTION' as const, color: SIGNAL_COLORS.DOUBLE_YELLOW, borderColor: '#ea580c' },
      ]

      for (let lvl = 0; lvl < levels.length && currentLevel.length > 0; lvl++) {
        const nextLevel: string[] = []
        for (const prevId of currentLevel) {
          if (signals.has(prevId)) continue
          signals.set(prevId, {
            color: levels[lvl].color,
            borderColor: levels[lvl].borderColor,
            status: levels[lvl].status,
          })
          const prevSector = sectorsById.get(prevId)
          if (prevSector) {
            nextLevel.push(...prevSector.prev_sectors)
          }
        }
        currentLevel = nextLevel
        if (currentLevel.length === 0) break
      }
    })

    return signals
  }, [corridorTrains, precomputedSectors, sectorsById, getTrainTrackKey, normalizeSectorTrackType])

  // 5. Blocked & Closures Fetching
  useEffect(() => {
    let isMounted = true
    const fetchBlockedSectors = async () => {
      try {
        const blockages = await getBlockedSectors()
        if (isMounted) {
          setBlockedSectors(new Set(blockages.map((b) => b.sector_id)))
        }
      } catch (err) {
        console.error('Failed to fetch blocked sectors:', err)
      }
    }

    const fetchTrackClosures = async () => {
      try {
        const apiUrl = getApiBaseUrl()
        const res = await axios.get(`${apiUrl}/api/status/track-closures`)
        if (isMounted && res.data.success) {
          setTrackClosures(res.data.closures || [])
        }
      } catch (err) {
        console.error('Failed to fetch track closures:', err)
      }
    }

    fetchBlockedSectors()
    fetchTrackClosures()

    const interval = setInterval(() => {
      fetchBlockedSectors()
      fetchTrackClosures()
    }, 6000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  // 6. Viewport Virtualization Calculation
  const visibleRange = useMemo(() => {
    const margin = 400
    return {
      visibleMinX: viewBox.x - margin,
      visibleMaxX: viewBox.x + viewBox.w + margin,
    }
  }, [viewBox])

  // Filter visible items
  const visibleSectors = useMemo(() => {
    return precomputedSectors.filter(
      (s) => s.maxX >= visibleRange.visibleMinX && s.minX <= visibleRange.visibleMaxX
    )
  }, [precomputedSectors, visibleRange])

  const visibleStations = useMemo(() => {
    return layout.stations.filter((station) => {
      const x = layout.stationPositions.get(station.name) || 0
      return x >= visibleRange.visibleMinX - 150 && x <= visibleRange.visibleMaxX + 150
    })
  }, [layout.stations, layout.stationPositions, visibleRange])

  // Signal status statistics
  const signalStats = useMemo(() => {
    let red = 0
    let yellow = 0
    let doubleYellow = 0
    sectorSignals.forEach((s) => {
      if (s.status === 'OCCUPIED') red++
      else if (s.status === 'CAUTION') yellow++
      else if (s.status === 'PRELIMINARY_CAUTION') doubleYellow++
    })
    return {
      occupied: red,
      caution: yellow + doubleYellow,
      blocked: blockedSectors.size,
      total: precomputedSectors.length,
    }
  }, [sectorSignals, blockedSectors.size, precomputedSectors.length])

  // Train Y Position Computer
  const computeTrainY = useCallback(
    (train: LiveTrainData, defaultY: number) => {
      try {
        const order = getTrackIndexForType(train.type, train.destination, train.lat, train.trackType)
        const trackType = layout.trackTypes.find((t) => t.order === order)
        if (!trackType) return defaultY
        const topY = layout.trackYPositions.get(trackType.id)
        if (typeof topY !== 'number') return defaultY
        const laneCount = typeof train.laneCount === 'number' && train.laneCount > 0 ? train.laneCount : 1
        const laneIndex = typeof train.laneIndex === 'number' ? train.laneIndex : 0
        const laneOffset =
          laneCount > 1 ? (laneIndex - (laneCount - 1) / 2) * LANE_GAP : 0
        return topY + laneOffset + TRACK_HEIGHT / 2
      } catch (err) {
        return defaultY
      }
    },
    [layout.trackTypes, layout.trackYPositions]
  )

  // ── ViewBox Management ──
  // Compute default viewBox: shows a comfortable initial view (not everything crammed)
  const computeDefaultViewBox = useCallback(() => {
    const padY = 10
    const h = layout.totalHeight + padY * 2
    // Show ~40% of the corridor width initially — user scrolls for the rest
    const containerAR = containerSize.width / Math.max(containerSize.height, 1)
    const w = h * containerAR
    return {
      x: -30,
      y: -padY,
      w,
      h,
    }
  }, [layout.totalHeight, containerSize])

  // Compute full-corridor viewBox (fit all)
  const computeFullViewBox = useCallback(() => {
    const padX = 60
    const padY = 10
    const fullH = layout.totalHeight + padY * 2
    return {
      x: -padX,
      y: -padY,
      w: layout.totalWidth + padX * 2,
      h: fullH,
    }
  }, [layout.totalWidth, layout.totalHeight])

  // Reset to default comfortable view
  const handleResetView = useCallback(() => {
    setViewBox(computeDefaultViewBox())
    setActiveQuickStation(null)
    setIsFocusedOnTrain(false)
  }, [computeDefaultViewBox])

  // Fit entire corridor in view
  const handleFitAll = useCallback(() => {
    setViewBox(computeFullViewBox())
    setActiveQuickStation(null)
    setIsFocusedOnTrain(false)
  }, [computeFullViewBox])

  // Reset drag overrides follow lock cleanly
  const panToStation = useCallback(
    (stationName: string) => {
      const stationX = layout.stationPositions.get(stationName)
      if (typeof stationX !== 'number') return
      setActiveQuickStation(stationName)
      setIsFocusedOnTrain(false)
      setFollowTrainLock(false)
      setViewBox((prev) => ({
        ...prev,
        x: stationX - prev.w / 2,
      }))
    },
    [layout.stationPositions]
  )

  // Zoom in/out by adjusting viewBox dimensions
  const handleZoom = useCallback(
    (direction: 'in' | 'out', centerX?: number, centerY?: number) => {
      setViewBox((prev) => {
        const factor = direction === 'in' ? 0.75 : 1.35
        const newW = prev.w * factor
        const newH = prev.h * factor
        // Clamp: don't zoom in more than 800px wide or out more than full corridor
        const minW = 600
        const maxW = layout.totalWidth + 200
        if (newW < minW || newW > maxW) return prev

        // Zoom centered on the specified point (or center of current view)
        const cx = centerX ?? (prev.x + prev.w / 2)
        const cy = centerY ?? (prev.y + prev.h / 2)
        return {
          x: cx - (cx - prev.x) * factor,
          y: cy - (cy - prev.y) * factor,
          w: newW,
          h: newH,
        }
      })
    },
    [layout.totalWidth]
  )

  // Mouse wheel zoom on the SVG
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const svgEl = svgRef.current
      if (!svgEl) return

      const rect = svgEl.getBoundingClientRect()
      // Convert mouse position to SVG coordinate space
      const mouseXRatio = (e.clientX - rect.left) / rect.width
      const mouseYRatio = (e.clientY - rect.top) / rect.height

      setViewBox((prev) => {
        const svgX = prev.x + prev.w * mouseXRatio
        const svgY = prev.y + prev.h * mouseYRatio
        const factor = e.deltaY > 0 ? 1.12 : 0.88
        const newW = prev.w * factor
        const newH = prev.h * factor
        const minW = 600
        const maxW = layout.totalWidth + 200
        if (newW < minW || newW > maxW) return prev
        return {
          x: svgX - newW * mouseXRatio,
          y: svgY - newH * mouseYRatio,
          w: newW,
          h: newH,
        }
      })
    },
    [layout.totalWidth]
  )

  // Drag-to-pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('button')) {
      setIsDragging(true)
      setFollowTrainLock(false)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        vbX: 0,
        vbY: 0,
      }
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      // Convert pixel delta to viewBox delta
      const dx = (e.movementX / rect.width) * viewBox.w
      const dy = (e.movementY / rect.height) * viewBox.h
      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }))
    },
    [isDragging, viewBox.w, viewBox.h]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  // Initial view
  useEffect(() => {
    setViewBox(computeDefaultViewBox())
  }, [computeDefaultViewBox])

  // Map dispatch hotkeys: G (Stringline), R (Reset View), F (Fit Corridor), L (Follow Lock)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      if (key === 'g') {
        setShowStringline((s) => !s)
      } else if (key === 'r') {
        handleResetView()
      } else if (key === 'f') {
        handleFitAll()
      } else if (key === 'l' && focusedTrainId) {
        setFollowTrainLock((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleResetView, handleFitAll, focusedTrainId])

  // Tooltip helper
  const showTooltip = useCallback(
    (e: React.MouseEvent, content: string) => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
      setTooltip({
        content,
        x: e.clientX,
        y: e.clientY - 12,
      })
    },
    []
  )

  const hideTooltip = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
    setTooltip(null)
  }, [])

  // Sector click handler
  const handleSectorClick = useCallback(
    (e: React.MouseEvent, sector: PrecomputedSector) => {
      e.stopPropagation()
      setSelectedSectorForBlockage({
        sectorId: sector.sector_id,
        sectorInfo: {
          from_station: sector.from_station,
          to_station: sector.to_station,
          track_type: sector.track_type,
        },
      })
      setBlockageDialogOpen(true)
    },
    []
  )

  // Focus on train: zoom & optionally track the train when followTrainLock is active
  const lastFocusedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!focusedTrainId || !containerRef.current) return
    const isNewFocus = lastFocusedRef.current !== focusedTrainId
    if (!isNewFocus && !followTrainLock) return
    if (isNewFocus) {
      lastFocusedRef.current = focusedTrainId
      setFollowTrainLock(true)
    }

    const liveTrain = corridorTrains.find((t) => t.train_id === focusedTrainId) ||
                      liveTrains.find((t) => t.train_id === focusedTrainId)
    if (!liveTrain || liveTrain.line_id !== lineId) return

    const gpsStations = corridorConfig.stations.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    }))

    const converter = new GPSToMapConverter(
      {
        width: layout.totalWidth,
        height: layout.totalHeight,
        paddingX: 150,
        paddingY: 40,
      },
      kmToPixels,
      gpsStations
    )

    const pos = converter.convert(liveTrain.lat, liveTrain.lng, 0)
    const trainY = computeTrainY(liveTrain, pos.y)

    const focusW = layout.totalWidth * 0.2
    const containerAR = containerSize.width / Math.max(containerSize.height, 1)
    const focusH = focusW / containerAR

    setViewBox({
      x: Math.max(-60, pos.x - focusW / 2),
      y: Math.max(-20, trainY - focusH / 2),
      w: focusW,
      h: focusH,
    })
    setIsFocusedOnTrain(true)
  }, [focusedTrainId, followTrainLock, corridorTrains, liveTrains, lineId, layout, kmToPixels, corridorConfig.stations, computeTrainY, containerSize])

  // Minimap click handler to jump camera directly to clicked km
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const targetX = ratio * layout.totalWidth
      setFollowTrainLock(false)
      setViewBox((prev) => ({
        ...prev,
        x: Math.max(-60, Math.min(layout.totalWidth - prev.w + 60, targetX - prev.w / 2)),
      }))
    },
    [layout.totalWidth]
  )

  const minimapConverter = useMemo(
    () =>
      new GPSToMapConverter(
        { width: layout.totalWidth, height: layout.totalHeight, paddingX: 150, paddingY: 40 },
        kmToPixels,
        corridorConfig.stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng }))
      ),
    [layout.totalWidth, layout.totalHeight, kmToPixels, corridorConfig.stations]
  )

  // ── Track direction grouping for labels ──
  const upTracks = layout.continuousTracks.filter(t => t.id.startsWith('up'))
  const downTracks = layout.continuousTracks.filter(t => t.id.startsWith('down'))

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden transition-colors duration-300 bg-slate-50 text-slate-900 dark:bg-[#060913] dark:text-slate-100 select-none flex flex-col font-sans">
      {/* 1. TOP HEADER & TELEMETRY CONTROL BAR */}
      <div className="flex-shrink-0 z-20 px-3 py-2 transition-colors duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap">
        {/* Left: Corridor Title & Signals Summary */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-slate-900 dark:text-slate-200">
            <Radio className={`w-4 h-4 animate-pulse ${isSecr ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
            <span>
              {isSecr ? 'SECR · DURG — RAIPUR — BILASPUR' : 'CR · CSMT — KALYAN CORRIDOR'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-700 text-[11px]">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Clear: {signalStats.total - signalStats.occupied - signalStats.caution}
            </span>
            {signalStats.caution > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" />
                Caution: {signalStats.caution}
              </span>
            )}
            {signalStats.occupied > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold border border-rose-500/30">
                <TrainIcon className="w-3 h-3" />
                Occupied: {signalStats.occupied}
              </span>
            )}
            {signalStats.blocked > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/15 dark:bg-red-600/20 text-red-700 dark:text-red-400 font-semibold border border-red-500/40">
                Blocked: {signalStats.blocked}
              </span>
            )}
          </div>
        </div>

        {/* Right: Corridor Train Stats, Stringline Toggle & Time */}
        <div className="flex items-center gap-2.5">
          {corridorTrains.length > 0 && (
            <div className="hidden xl:flex items-center gap-1.5">
              {Object.entries(TRAIN_TYPE_COLORS).map(([type, color]) => {
                const count = corridorCountByType[type] || 0
                if (count === 0) return null
                return (
                  <span
                    key={type}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {TRAIN_TYPE_LABELS[type as keyof typeof TRAIN_TYPE_LABELS]?.split(' ')[0]}: {count}
                  </span>
                )
              })}
            </div>
          )}

          {focusedTrainId && (
            <button
              onClick={() => setFollowTrainLock((v) => !v)}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all border ${
                followTrainLock
                  ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:text-white'
              }`}
              title="Toggle Follow-Train Camera Lock (L)"
            >
              <Crosshair className="w-3 h-3" />
              {followTrainLock ? `Following ${focusedTrainId.replace('SECR_', '')}` : 'Follow'}
            </button>
          )}

          <button
            onClick={() => setShowStringline((s) => !s)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
              showStringline
                ? 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-white'
            }`}
            title="Toggle Live Time-Distance Stringline Trajectory Chart (G)"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Stringline Graph
          </button>

          <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-slate-950 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-500/30 font-semibold transition-colors duration-300">
            {update?.currentTime
              ? new Date(update.currentTime).toLocaleTimeString()
              : '--:--:--'}
          </div>
        </div>
      </div>

      {/* 2. STATION QUICK-JUMP & ACTIVE TRAIN CAMERA BAR */}
      <div className="flex-shrink-0 z-10 px-3 py-1.5 transition-colors duration-300 bg-slate-100/90 dark:bg-slate-900/75 backdrop-blur border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1 mr-1">
            <Navigation className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            Stations:
          </span>
          {quickStations.map((stationName) => {
            const isActive = activeQuickStation === stationName
            return (
              <button
                key={stationName}
                onClick={() => panToStation(stationName)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/60'
                }`}
              >
                {stationName}
              </button>
            )
          })}
        </div>

        {/* Active Corridor Trains Quick-Focus Strip */}
        {corridorTrains.length > 0 && (
          <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-300 dark:border-slate-700 flex-shrink-0">
            {corridorTrains.slice(0, 3).map((tr) => {
              const isSel = focusedTrainId === tr.train_id
              return (
                <button
                  key={`qf-${tr.train_id}`}
                  onClick={() => onTrainClick?.(tr.train_id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold whitespace-nowrap transition-all border flex items-center gap-1 ${
                    isSel
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-white/90 dark:bg-slate-950/70 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-cyan-500'
                  }`}
                  title={`Focus camera & inspector on ${tr.train_id}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tr.signalAspect === 'RED' ? '#ef4444' : '#10b981' }}
                  />
                  {tr.train_id.replace('SECR_', '').slice(0, 10)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. CORRIDOR MAP — tracks fill vertical space, pan/zoom to navigate */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden transition-colors duration-300 bg-slate-50 dark:bg-[#050914] ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Track Direction Legend (left side) */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
          {/* UP direction group */}
          <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg transition-colors duration-300 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-lg">
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">↑ Up Line</div>
            {upTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-[3px] rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {track.label.replace('UP ', '')}
                </span>
              </div>
            ))}
          </div>
          {/* DOWN direction group */}
          <div className="flex flex-col gap-1 px-2.5 py-1.5 rounded-lg transition-colors duration-300 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 shadow-lg">
            <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">↓ Down Line</div>
            {downTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-[3px] rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {track.label.replace('DOWN ', '')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Zoom & Control Toolbar */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 transition-colors duration-300 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-lg p-1 shadow-xl">
          <button
            onClick={() => handleZoom('in')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="border-t border-slate-200 dark:border-slate-700/60 my-0.5" />
          <button
            onClick={handleResetView}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Default View (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitAll}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Fit Entire Corridor (F)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* SVG Drawing Canvas — viewBox for scaling, drag/wheel for navigation */}
        <svg
          ref={svgRef}
          className="w-full h-full block"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          preserveAspectRatio="none"
          style={{ overflow: 'hidden' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <defs>
            {/* Soft Glow */}
            <filter id="corridor-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Blocked Safety Hazard Pattern */}
            <pattern
              id="blocked-hazard"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="12" height="12" fill="#7f1d1d" />
              <line x1="0" y1="0" x2="0" y2="12" stroke="#ef4444" strokeWidth="6" />
            </pattern>

            {/* Track Closed Pattern */}
            <pattern
              id="track-closed-hazard"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill="#7c2d12" />
              <line x1="0" y1="0" x2="0" y2="10" stroke="#f97316" strokeWidth="5" />
            </pattern>

            {/* Headlight beams */}
            <linearGradient id="headlight-down" x1="100%" y1="50%" x2="0%" y2="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="headlight-up" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>

            {/* Station line gradient */}
            <linearGradient id="station-line-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
              <stop offset="20%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="80%" stopColor="#38bdf8" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>

            {/* Architectural Blueprint Grid Pattern */}
            <pattern id="corridor-grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke={isDarkMode ? '#1e293b' : '#cbd5e1'}
                strokeWidth="0.6"
                opacity={isDarkMode ? 0.32 : 0.45}
              />
            </pattern>
          </defs>

          {/* Dual-Theme Smooth Fade Canvas Backdrop & Blueprint Grid */}
          <rect
            x={viewBox.x - 400}
            y={viewBox.y - 200}
            width={viewBox.w + 800}
            height={viewBox.h + 400}
            fill={isDarkMode ? '#050914' : '#f8fafc'}
            style={{ transition: 'fill 300ms ease' }}
          />
          <rect
            x={viewBox.x - 400}
            y={viewBox.y - 200}
            width={viewBox.w + 800}
            height={viewBox.h + 400}
            fill="url(#corridor-grid-pattern)"
            style={{ pointerEvents: 'none' }}
          />

          {/* Background grid lines for depth */}
          {layout.continuousTracks.map((track) => (
            <line
              key={`grid-h-${track.id}`}
              x1={track.startX - 50}
              y1={track.y + TRACK_HEIGHT / 2}
              x2={track.endX + 50}
              y2={track.y + TRACK_HEIGHT / 2}
              stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
              strokeWidth={0.5}
              opacity={0.3}
            />
          ))}

          {/* 1. CONTINUOUS BASELINE TRACKS (Full Corridor Rail Infrastructure) */}
          {layout.continuousTracks.map((track) => (
            <g key={`mainline-${track.id}`}>
              {/* Track color accent strip (left edge) */}
              <rect
                x={track.startX - 8}
                y={track.y}
                width={4}
                height={TRACK_HEIGHT}
                rx={2}
                fill={track.color}
                opacity={0.9}
              />

              {/* Track designation label (left) */}
              <text
                x={track.startX - 18}
                y={track.y + TRACK_HEIGHT / 2 + 4}
                fill={track.color}
                fontSize="11"
                fontWeight="800"
                textAnchor="end"
                opacity={0.85}
                letterSpacing="0.5"
              >
                {track.label}
              </text>

              {/* Ballast / track bed */}
              <line
                x1={track.startX}
                y1={track.y + TRACK_HEIGHT / 2}
                x2={track.endX}
                y2={track.y + TRACK_HEIGHT / 2}
                stroke={isDarkMode ? '#1e293b' : '#e2e8f0'}
                strokeWidth={TRACK_HEIGHT + 6}
                strokeLinecap="round"
                opacity={isDarkMode ? 0.75 : 0.9}
              />

              {/* Concrete crossties / sleepers */}
              <line
                x1={track.startX}
                y1={track.y + TRACK_HEIGHT / 2}
                x2={track.endX}
                y2={track.y + TRACK_HEIGHT / 2}
                stroke={isDarkMode ? '#334155' : '#94a3b8'}
                strokeWidth={TRACK_HEIGHT}
                strokeDasharray="4,8"
                opacity={isDarkMode ? 0.5 : 0.65}
              />

              {/* Steel Rails (Left & Right) */}
              <line
                x1={track.startX}
                y1={track.y + TRACK_HEIGHT / 2 - 3}
                x2={track.endX}
                y2={track.y + TRACK_HEIGHT / 2 - 3}
                stroke={isDarkMode ? '#64748b' : '#334155'}
                strokeWidth={1.5}
                opacity={0.9}
              />
              <line
                x1={track.startX}
                y1={track.y + TRACK_HEIGHT / 2 + 3}
                x2={track.endX}
                y2={track.y + TRACK_HEIGHT / 2 + 3}
                stroke={isDarkMode ? '#64748b' : '#334155'}
                strokeWidth={1.5}
                opacity={0.9}
              />

              {/* Color accent line on track (subtle) */}
              <line
                x1={track.startX}
                y1={track.y + TRACK_HEIGHT / 2}
                x2={track.endX}
                y2={track.y + TRACK_HEIGHT / 2}
                stroke={track.color}
                strokeWidth={1}
                opacity={0.15}
              />
            </g>
          ))}

          {/* Direction separator line (between UP and DOWN groups) */}
          {upTracks.length > 0 && downTracks.length > 0 && (() => {
            const lastUpY = Math.max(...upTracks.map(t => t.y + TRACK_HEIGHT))
            const firstDownY = Math.min(...downTracks.map(t => t.y))
            const midY = (lastUpY + firstDownY) / 2
            const minX = Math.min(...layout.continuousTracks.map(t => t.startX))
            const maxX = Math.max(...layout.continuousTracks.map(t => t.endX))
            return (
              <line
                x1={minX}
                y1={midY}
                x2={maxX}
                y2={midY}
                stroke={isDarkMode ? '#334155' : '#94a3b8'}
                strokeWidth={1}
                strokeDasharray="8,12"
                opacity={0.4}
              />
            )
          })()}

          {/* 2. STATION PLATFORMS & OVERHEAD GANTRIES (Virtual Viewport Culled) */}
          {visibleStations.map((station) => {
            const x = layout.stationPositions.get(station.name) || 0
            const topTrack = layout.continuousTracks[0]
            const bottomTrack = layout.continuousTracks[layout.continuousTracks.length - 1]
            const topY = topTrack.y - 16
            const bottomY = bottomTrack.y + TRACK_HEIGHT + 16
            const isStationActive = activeQuickStation === station.name
            const isRaipurJn = station.name === 'R'
            const displayName = isRaipurJn ? 'RAIPUR JN ★ DRM HQ' : station.name.replace(/_/g, ' ')
            const badgeWidth = isRaipurJn ? 156 : Math.max(90, displayName.length * 7 + 20)
            const originStationName = isSecr ? 'DURG' : 'CSMT'

            const stationTooltip = isRaipurJn
              ? `⭐ RAIPUR JUNCTION (R)\n🏢 Division Headquarters: DRM Raipur (SECR)\n📍 Distance: ${station.kmFromStart.toFixed(1)} km from ${originStationName}\n🌐 Lat: ${station.lat.toFixed(5)}, Lng: ${station.lng.toFixed(5)}\n🚆 Central Section Controller Dispatch Cabin`
              : `🚉 ${displayName}\n📍 Distance: ${station.kmFromStart.toFixed(1)} km from ${originStationName}\n🌐 Lat: ${station.lat.toFixed(5)}, Lng: ${station.lng.toFixed(5)}`

            return (
              <g
                key={`station-node-${station.name}`}
                className="cursor-pointer"
                onClick={() => panToStation(station.name)}
                onMouseEnter={(e) => showTooltip(e, stationTooltip)}
                onMouseMove={(e) => showTooltip(e, stationTooltip)}
                onMouseLeave={hideTooltip}
              >
                {/* Station vertical guideline */}
                <line
                  x1={x}
                  y1={STATION_LABEL_HEIGHT - 5}
                  x2={x}
                  y2={layout.totalHeight - 10}
                  stroke={isStationActive ? '#06b6d4' : isRaipurJn ? '#f59e0b' : 'url(#station-line-grad)'}
                  strokeWidth={isStationActive || isRaipurJn ? 2.5 : 1}
                  opacity={isStationActive || isRaipurJn ? 0.95 : 0.5}
                />

                {/* Station Overhead Badge */}
                <g transform={`translate(${x}, 28)`}>
                  <rect
                    x={-badgeWidth / 2}
                    y={-14}
                    width={badgeWidth}
                    height={26}
                    rx={6}
                    fill={
                      isStationActive
                        ? '#0e7490'
                        : isRaipurJn
                        ? isDarkMode ? '#451a03' : '#fef3c7'
                        : isDarkMode ? '#0f172a' : '#ffffff'
                    }
                    stroke={
                      isStationActive
                        ? '#22d3ee'
                        : isRaipurJn
                        ? '#f59e0b'
                        : isDarkMode ? '#334155' : '#0284c7'
                    }
                    strokeWidth={isStationActive || isRaipurJn ? 2.5 : 1}
                    filter={isDarkMode ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' : 'drop-shadow(0 2px 5px rgba(15,23,42,0.14))'}
                  />
                  <text
                    x={0}
                    y={-1}
                    fill={
                      isStationActive
                        ? '#ffffff'
                        : isRaipurJn
                        ? isDarkMode ? '#fde68a' : '#92400e'
                        : isDarkMode ? '#e2e8f0' : '#0f172a'
                    }
                    fontSize={isRaipurJn ? '10.5' : '10'}
                    fontWeight="800"
                    textAnchor="middle"
                    letterSpacing="0.5"
                  >
                    {displayName}
                  </text>
                  <text
                    x={0}
                    y={9}
                    fill={
                      isStationActive
                        ? '#a5f3fc'
                        : isRaipurJn
                        ? isDarkMode ? '#f59e0b' : '#b45309'
                        : isDarkMode ? '#94a3b8' : '#64748b'
                    }
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {isRaipurJn ? `DIVISION HQ • KM ${station.kmFromStart.toFixed(1)}` : `KM ${station.kmFromStart.toFixed(1)}`}
                  </text>
                </g>

                {/* Junction Turnout Crossovers (Slow ↔ Fast point switches) */}
                {(quickStations.includes(station.name) && upTracks.length >= 2) && (
                  <g opacity={0.45} stroke="#94a3b8" strokeWidth={1.3} strokeDasharray="3,2">
                    <line
                      x1={x - 36}
                      y1={upTracks[0].y + TRACK_HEIGHT / 2}
                      x2={x - 10}
                      y2={upTracks[1].y + TRACK_HEIGHT / 2}
                    />
                    <line
                      x1={x + 10}
                      y1={upTracks[1].y + TRACK_HEIGHT / 2}
                      x2={x + 36}
                      y2={upTracks[0].y + TRACK_HEIGHT / 2}
                    />
                  </g>
                )}
                {(quickStations.includes(station.name) && downTracks.length >= 2) && (
                  <g opacity={0.45} stroke="#94a3b8" strokeWidth={1.3} strokeDasharray="3,2">
                    <line
                      x1={x - 36}
                      y1={downTracks[0].y + TRACK_HEIGHT / 2}
                      x2={x - 10}
                      y2={downTracks[1].y + TRACK_HEIGHT / 2}
                    />
                    <line
                      x1={x + 10}
                      y1={downTracks[1].y + TRACK_HEIGHT / 2}
                      x2={x + 36}
                      y2={downTracks[0].y + TRACK_HEIGHT / 2}
                    />
                  </g>
                )}

                {/* Vertical Platform Backing Capsule */}
                <rect
                  x={x - 7}
                  y={topY}
                  width={14}
                  height={bottomY - topY}
                  rx={7}
                  fill={isDarkMode ? '#1e293b' : '#f1f5f9'}
                  stroke={isStationActive ? '#22d3ee' : isDarkMode ? '#334155' : '#cbd5e1'}
                  strokeWidth={isStationActive ? 2.5 : 1.5}
                  opacity={0.85}
                />

                {/* Track Intersection Platform Lights */}
                {layout.continuousTracks.map((track) => (
                  <circle
                    key={`station-light-${station.name}-${track.id}`}
                    cx={x}
                    cy={track.y + TRACK_HEIGHT / 2}
                    r={isStationActive ? 5 : 4}
                    fill={isStationActive ? '#22d3ee' : '#38bdf8'}
                    stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                    strokeWidth={1.2}
                  />
                ))}
              </g>
            )
          })}

          {/* 3. SIGNALING SECTORS & OCCUPANCY BLOCKS (Virtual Viewport Culled) */}
          {visibleSectors.map((sector) => {
            const signalInfo = sectorSignals.get(sector.sector_id)
            const isBlocked = blockedSectors.has(sector.sector_id)

            // Check if sector is closed by traffic controller
            const isClosed = trackClosures.some(
              (c) =>
                c.status === 'closed' &&
                ((c.station_from === sector.from_station && c.station_to === sector.to_station) ||
                  (c.station_from === sector.to_station && c.station_to === sector.from_station))
            )

            const status = isBlocked
              ? 'BLOCKED (Maintenance)'
              : isClosed
              ? 'CLOSED (Safety Interlock)'
              : signalInfo?.status || 'CLEAR'

            const statusColor = isBlocked
              ? '#ef4444'
              : isClosed
              ? '#f97316'
              : signalInfo?.color || SIGNAL_COLORS.GREEN

            const sectorTooltip =
              `⚡ Sector: ${sector.sector_id}\n` +
              `🛤️ Track: ${sector.track_type.toUpperCase()}\n` +
              `📍 ${sector.from_station} ➔ ${sector.to_station}\n` +
              `📏 Length: ${(sector.lengthMeters / 1000).toFixed(2)} km\n` +
              `🚦 Signal: ${status}`

            const isOccupied = signalInfo?.status === 'OCCUPIED'
            const isCaution = signalInfo?.status === 'CAUTION' || signalInfo?.status === 'PRELIMINARY_CAUTION'

            return (
              <g
                key={`sector-${sector.sector_id}`}
                onClick={(e) => handleSectorClick(e, sector)}
                onMouseEnter={(e) => showTooltip(e, sectorTooltip)}
                onMouseMove={(e) => showTooltip(e, sectorTooltip)}
                onMouseLeave={hideTooltip}
                className="cursor-pointer"
              >
                {/* Hit Box Area */}
                <rect
                  x={sector.minX}
                  y={sector.y - TRACK_HEIGHT}
                  width={Math.max(12, sector.maxX - sector.minX)}
                  height={TRACK_HEIGHT * 2}
                  fill="transparent"
                />

                {/* OCCUPIED (Red) Track Circuit Illumination */}
                {isOccupied && (
                  <g>
                    {/* Glowing underlay */}
                    <line
                      x1={sector.startX}
                      y1={sector.y}
                      x2={sector.endX}
                      y2={sector.y}
                      stroke="#ef4444"
                      strokeWidth={TRACK_HEIGHT + 6}
                      strokeLinecap="round"
                      opacity={0.6}
                      filter="url(#corridor-glow)"
                    />
                    {/* Solid track fill */}
                    <line
                      x1={sector.startX}
                      y1={sector.y}
                      x2={sector.endX}
                      y2={sector.y}
                      stroke="#b91c1c"
                      strokeWidth={TRACK_HEIGHT}
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* CAUTION (Yellow/Orange) Track Circuit Illumination */}
                {isCaution && !isOccupied && (
                  <g>
                    <line
                      x1={sector.startX}
                      y1={sector.y}
                      x2={sector.endX}
                      y2={sector.y}
                      stroke={signalInfo?.color || '#eab308'}
                      strokeWidth={TRACK_HEIGHT + 4}
                      strokeLinecap="round"
                      opacity={0.45}
                      filter="url(#corridor-glow)"
                    />
                    <line
                      x1={sector.startX}
                      y1={sector.y}
                      x2={sector.endX}
                      y2={sector.y}
                      stroke={signalInfo?.color || '#ca8a04'}
                      strokeWidth={TRACK_HEIGHT - 2}
                      strokeLinecap="round"
                      opacity={0.85}
                    />
                  </g>
                )}

                {/* BLOCKED / CLOSED Hazard Overlay */}
                {(isBlocked || isClosed) && (
                  <g>
                    <line
                      x1={sector.startX}
                      y1={sector.y}
                      x2={sector.endX}
                      y2={sector.y}
                      stroke={isBlocked ? 'url(#blocked-hazard)' : 'url(#track-closed-hazard)'}
                      strokeWidth={TRACK_HEIGHT + 2}
                      strokeLinecap="round"
                      opacity={0.95}
                    />
                  </g>
                )}

                {/* Block Boundary Dividers & 3-Aspect Signal Heads */}
                <line
                  x1={sector.startX}
                  y1={sector.y - TRACK_HEIGHT / 2 - 4}
                  x2={sector.startX}
                  y2={sector.y + TRACK_HEIGHT / 2 + 4}
                  stroke={statusColor}
                  strokeWidth={2}
                  opacity={0.85}
                />
                <circle
                  cx={sector.startX}
                  cy={sector.y - TRACK_HEIGHT / 2 - 5}
                  r={3.2}
                  fill={statusColor}
                  stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                  strokeWidth={1}
                />

                <line
                  x1={sector.endX}
                  y1={sector.y - TRACK_HEIGHT / 2 - 4}
                  x2={sector.endX}
                  y2={sector.y + TRACK_HEIGHT / 2 + 4}
                  stroke={statusColor}
                  strokeWidth={2}
                  opacity={0.85}
                />
                <circle
                  cx={sector.endX}
                  cy={sector.y - TRACK_HEIGHT / 2 - 5}
                  r={3.2}
                  fill={statusColor}
                  stroke={isDarkMode ? '#0f172a' : '#ffffff'}
                  strokeWidth={1}
                />
              </g>
            )
          })}

          {/* 3B. GRADUATED KILOMETER CHAINAGE RULER */}
          {(() => {
            const maxKm = Math.ceil(Math.max(...layout.stations.map((s) => s.kmFromStart), 10) / 5) * 5
            const rulerY = layout.totalHeight - 16
            const stepKm = isSecr ? 10 : 5
            const ticks: number[] = []
            for (let km = 0; km <= maxKm; km += stepKm) ticks.push(km)
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={150}
                  y1={rulerY}
                  x2={150 + maxKm * kmToPixels}
                  y2={rulerY}
                  stroke={isDarkMode ? '#334155' : '#94a3b8'}
                  strokeWidth={1}
                  opacity={0.7}
                />
                {ticks.map((km) => {
                  const tx = 150 + km * kmToPixels
                  if (tx < visibleRange.visibleMinX - 100 || tx > visibleRange.visibleMaxX + 100) return null
                  return (
                    <g key={`km-tick-${km}`}>
                      <line
                        x1={tx}
                        y1={rulerY - 4}
                        x2={tx}
                        y2={rulerY + 3}
                        stroke={isDarkMode ? '#475569' : '#64748b'}
                        strokeWidth={1.2}
                      />
                      <text
                        x={tx}
                        y={rulerY + 12}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontFamily="ui-monospace, monospace"
                        fontWeight="bold"
                        fill={isDarkMode ? '#64748b' : '#475569'}
                      >
                        KM {km}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })()}

          {/* 4. LIVE TRAINS LAYER (Corridor-accurate coordinates + 60fps transitions) */}
          <LiveTrainsLayer
            trains={liveTrains}
            mapWidth={layout.totalWidth}
            mapHeight={layout.totalHeight}
            kmToPixels={kmToPixels}
            paddingX={150}
            stations={corridorConfig.stations}
            lineId={lineId}
            computeTrainY={computeTrainY}
            focusedTrainId={focusedTrainId}
            onTrainClick={onTrainClick}
            onMouseEnter={showTooltip}
            onMouseMove={showTooltip}
            onMouseLeave={hideTooltip}
          />
        </svg>

        {/* GLASSMORPHISM TOOLTIP */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none transition-colors duration-200 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 text-xs rounded-lg px-3 py-2 shadow-2xl border border-slate-300 dark:border-slate-700/80 backdrop-blur-md whitespace-pre-line font-mono leading-relaxed"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
              transform: 'translate(-50%, -100%)',
              maxWidth: '320px',
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      {/* 4B. INTERACTIVE FULL-CORRIDOR MINIMAP RADAR BAR */}
      <div className="flex-shrink-0 transition-colors duration-300 bg-white/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center gap-3 z-20">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold flex-shrink-0">
          Minimap ({corridorTrains.length} Active):
        </span>
        <div
          onClick={handleMinimapClick}
          className="relative flex-1 h-6 transition-colors duration-300 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-800 overflow-hidden cursor-pointer"
          title="Click anywhere along the corridor minimap to jump camera"
        >
          {/* Baseline line */}
          <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-slate-300 dark:bg-slate-800" />

          {/* Station ticks */}
          {corridorConfig.stations.map((st) => {
            const x = layout.stationPositions.get(st.name) || 0
            const pct = Math.max(1, Math.min(99, (x / layout.totalWidth) * 100))
            const isMajor = st.name === 'R' || st.name === 'DADAR' || st.name === 'THANE'
            return (
              <div
                key={`mm-${st.name}`}
                style={{ left: `${pct}%` }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${
                  isMajor ? 'w-1.5 h-3.5 bg-amber-500 dark:bg-amber-400 rounded-sm' : 'w-[2px] h-2 bg-slate-400 dark:bg-slate-600'
                }`}
              />
            )
          })}

          {/* Live train dots */}
          {corridorTrains.map((tr) => {
            const posX = minimapConverter.getXPosition(tr.lat, tr.lng)
            const pct = Math.max(1, Math.min(99, (posX / layout.totalWidth) * 100))
            const color = tr.signalAspect === 'RED' ? '#ef4444' : TRAIN_TYPE_COLORS[tr.type] || '#38bdf8'
            const isFocused = tr.train_id === focusedTrainId
            return (
              <div
                key={`mm-tr-${tr.train_id}`}
                style={{ left: `${pct}%`, backgroundColor: color }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-700 ${
                  isFocused ? 'w-3 h-3 ring-2 ring-amber-400 z-10' : 'w-2 h-2'
                }`}
                title={`${tr.train_id} (${Math.round(tr.speed)} km/h)`}
              />
            )
          })}

          {/* Current Camera Viewport Box */}
          <div
            style={{
              left: `${Math.max(0, Math.min(100, (viewBox.x / layout.totalWidth) * 100))}%`,
              width: `${Math.max(4, Math.min(100, (viewBox.w / layout.totalWidth) * 100))}%`,
            }}
            className="absolute top-0 bottom-0 border border-cyan-600/80 dark:border-cyan-400/70 bg-cyan-500/15 dark:bg-cyan-400/10 rounded pointer-events-none"
          />
        </div>
      </div>

      {/* 4C. TOGGLEABLE TIME-DISTANCE STRINGLINE TRAJECTORY GRAPH */}
      {showStringline && (
        <StringlineChart
          lineId={lineId}
          stations={corridorConfig.stations}
          trains={liveTrains}
          currentTime={update?.currentTime}
          onTrainClick={onTrainClick}
          onClose={() => setShowStringline(false)}
        />
      )}

      {/* 5. SECTOR BLOCKAGE DIALOG */}
      {selectedSectorForBlockage && (
        <SectorBlockageDialog
          open={blockageDialogOpen}
          onOpenChange={setBlockageDialogOpen}
          sectorId={selectedSectorForBlockage.sectorId}
          sectorInfo={selectedSectorForBlockage.sectorInfo}
          onSuccess={() => {
            onSectorBlockageUpdate?.()
          }}
        />
      )}
    </div>
  )
}
