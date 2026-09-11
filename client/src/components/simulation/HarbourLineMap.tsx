import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { useTheme } from '../theme-provider'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import {
  parseCorridorData,
  getNormalizedTrackType,
  type CorridorConfig,
} from '../../utils/corridorMapParser'

// Import the raw harbour line data
import rawHarbourLineData from '../../../../api/src/services/simulation/sampleTrackHabourLineData.json'

const TRACK_HEIGHT = 8
const TRACK_SPACING = 35
const GROUP_SPACING = 20
const STATION_LABEL_HEIGHT = 40
const KM_TO_PIXELS = 150 // scale factor for horizontal spacing

interface HarbourLineMapProps {
  onTrainClick?: (trainId: string) => void
  focusedTrainId?: string | null
}

export const HarbourLineMap: React.FC<HarbourLineMapProps> = ({
  // onTrainClick, // TODO: Implement train click handling
  focusedTrainId,
}) => {
  const { /* pipelines, */ trains, update } = useSimulation()
  const { theme } = useTheme()

  // Determine if dark mode is active
  const isDarkMode = useMemo(() => {
    if (theme === 'dark') return true
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  }, [theme])

  const [tooltip, setTooltip] = useState<{
    content: string
    x: number
    y: number
  } | null>(null)
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zoom and pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)

  // Parse corridor configuration
  const corridorConfig = useMemo<CorridorConfig>(() => {
    return parseCorridorData(rawHarbourLineData)
  }, [])

  // Build layout for rendering
  const layout = useMemo(() => {
    const { stations, connections, trackTypes } = corridorConfig

    // Calculate canvas dimensions
    const totalWidth =
      Math.max(...stations.map((s) => s.kmFromStart)) * KM_TO_PIXELS + 200
    const totalHeight =
      STATION_LABEL_HEIGHT +
      trackTypes.length * (TRACK_HEIGHT + TRACK_SPACING) +
      GROUP_SPACING * 2

    // Station positions (X coordinates based on distance)
    const stationPositions = new Map<string, number>()
    stations.forEach((station) => {
      stationPositions.set(
        station.name,
        station.kmFromStart * KM_TO_PIXELS + 100
      )
    })

    // Track Y positions based on order
    const trackYPositions = new Map<string, number>()
    trackTypes.forEach((trackType) => {
      trackYPositions.set(
        trackType.id,
        STATION_LABEL_HEIGHT +
          GROUP_SPACING +
          trackType.order * (TRACK_HEIGHT + TRACK_SPACING)
      )
    })

    // Build track segments for rendering
    const trackSegments: Array<{
      id: string
      fromStation: string
      toStation: string
      fromX: number
      toX: number
      y: number
      trackType: string
      color: string
      length: number // meters
    }> = []

    connections.forEach((conn, index) => {
      const fromX = stationPositions.get(conn.fromStation) || 0
      const toX = stationPositions.get(conn.toStation) || 0
      const trackType = getNormalizedTrackType(conn.fromTrack)
      const y = trackYPositions.get(trackType) || 0
      const trackColor =
        trackTypes.find((t) => t.id === trackType)?.color || '#6b7280'

      trackSegments.push({
        id: `${conn.fromStation}_${conn.fromTrack}_${conn.toStation}_${conn.toTrack}_${index}`,
        fromStation: conn.fromStation,
        toStation: conn.toStation,
        fromX,
        toX,
        y,
        trackType,
        color: trackColor,
        length: conn.distance,
      })
    })

    return {
      stations,
      stationPositions,
      trackYPositions,
      trackSegments,
      trackTypes,
      totalWidth,
      totalHeight,
    }
  }, [corridorConfig])

  // Tooltip handlers
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, content: string) => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
      setTooltip({
        content,
        x: e.clientX,
        y: e.clientY - 10,
      })
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, content: string) => {
      if (!isDragging && tooltip) {
        setTooltip({
          content,
          x: e.clientX,
          y: e.clientY - 10,
        })
      }
    },
    [isDragging, tooltip]
  )

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
    setTooltip(null)
  }, [])

  // Zoom and pan handlers
  const clampPan = useCallback(
    (nextPan: { x: number; y: number }, zoomLevel: number) => {
      if (!containerRef.current) return nextPan
      const { width, height } = containerRef.current.getBoundingClientRect()

      const contentWidth = layout.totalWidth * zoomLevel
      const contentHeight = layout.totalHeight * zoomLevel

      const minX = Math.min(0, width - contentWidth)
      const maxX = 0
      const minY = Math.min(0, height - contentHeight)
      const maxY = 0

      return {
        x: Math.min(maxX, Math.max(minX, nextPan.x)),
        y: Math.min(maxY, Math.max(minY, nextPan.y)),
      }
    },
    [layout.totalWidth, layout.totalHeight]
  )

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const zoomStep = 0.08
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep

      setZoom((prevZoom) => {
        const newZoom = Math.max(0.3, Math.min(3, prevZoom + delta))
        if (!containerRef.current) return newZoom

        const rect = containerRef.current.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top

        setPan((prevPan) =>
          clampPan(
            {
              x: cursorX - ((cursorX - prevPan.x) * newZoom) / prevZoom,
              y: cursorY - ((cursorY - prevPan.y) * newZoom) / prevZoom,
            },
            newZoom
          )
        )

        return newZoom
      })
    },
    [clampPan]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0 && !(e.target as HTMLElement).closest('button')) {
        setIsDragging(true)
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      }
    },
    [pan]
  )

  const handleMapMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan(
          clampPan(
            {
              x: e.clientX - dragStart.x,
              y: e.clientY - dragStart.y,
            },
            zoomRef.current
          )
        )
      }
    },
    [isDragging, dragStart, clampPan]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  const handleResetView = useCallback(() => {
    if (!containerRef.current) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }

    const { width, height } = containerRef.current.getBoundingClientRect()
    const resetZoom = 1
    setZoom(resetZoom)
    const centeredPan = {
      x: width / 2 - (layout.totalWidth * resetZoom) / 2,
      y: height / 2 - (layout.totalHeight * resetZoom) / 2,
    }
    setPan(clampPan(centeredPan, resetZoom))
  }, [clampPan, layout.totalWidth, layout.totalHeight])

  // Initial centering
  useEffect(() => {
    if (!containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const initialPan = {
      x: width / 2 - (layout.totalWidth * zoomRef.current) / 2,
      y: height / 2 - (layout.totalHeight * zoomRef.current) / 2,
    }
    setPan((prev) =>
      prev.x === 0 && prev.y === 0
        ? clampPan(initialPan, zoomRef.current)
        : prev
    )
  }, [layout.totalWidth, layout.totalHeight, clampPan])

  // Focus on train when selected
  useEffect(() => {
    if (!focusedTrainId) return
    const train = trains.get(focusedTrainId)
    if (!train || !containerRef.current) return

    // For now, just center on the first station
    // TODO: Implement train positioning based on pipeline mapping
    const desiredZoom = Math.max(zoomRef.current, 1.3)
    setZoom(desiredZoom)

    const { width, height } = containerRef.current.getBoundingClientRect()
    const centerX = layout.totalWidth / 2
    const centerY = layout.totalHeight / 2

    const nextPan = {
      x: width / 2 - centerX * desiredZoom,
      y: height / 2 - centerY * desiredZoom,
    }
    setPan(clampPan(nextPan, desiredZoom))
  }, [focusedTrainId, trains, layout, clampPan])

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden relative">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-2xl pointer-events-none whitespace-pre-line border border-gray-700 dark:border-slate-500"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            maxWidth: '300px',
            animation: 'tooltipFadeIn 0.15s ease-out',
          }}
        >
          <div className="relative">
            <div className="font-mono leading-relaxed">{tooltip.content}</div>
            <div
              className="absolute left-1/2 top-full -translate-x-1/2 -mt-px"
              style={{
                width: 0,
                height: 0,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: isDarkMode
                  ? '8px solid #334155'
                  : '8px solid #111827',
              }}
            />
          </div>
          <style>{`
            @keyframes tooltipFadeIn {
              from {
                opacity: 0;
                transform: translate(-50%, calc(-100% - 8px)) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translate(-50%, calc(-100% - 12px)) scale(1);
              }
            }
          `}</style>
        </div>
      )}

      {/* Legend */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 dark:border-slate-600 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-12 bg-emerald-500 dark:bg-emerald-400 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-300">
            UP SLOW
          </span>
          <div className="h-1.5 w-12 bg-blue-600 dark:bg-blue-400 rounded"></div>
          <span className="text-xs text-gray-600 dark:text-gray-300">
            DOWN SLOW
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {update?.currentTime
            ? new Date(update.currentTime).toLocaleTimeString()
            : '--:--:--'}
        </div>
      </div>

      {/* Main SVG Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMapMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleResetView}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          ref={svgRef}
          width={layout.totalWidth}
          height={layout.totalHeight}
          className="harbour-line-map-svg"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <defs>
            <filter id="glow-harbour">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Station labels at top */}
          {layout.stations.map((station) => {
            const x = layout.stationPositions.get(station.name) || 0
            const stationTooltip = `${
              station.name
            }\nKm ${station.kmFromStart.toFixed(1)}\nLat: ${station.lat.toFixed(
              6
            )}\nLng: ${station.lng.toFixed(6)}`

            return (
              <g key={`station-label-${station.name}`}>
                <text
                  x={x}
                  y={25}
                  fill={isDarkMode ? '#e2e8f0' : '#1f2937'}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, stationTooltip)}
                  onMouseMove={(e) => handleMouseMove(e, stationTooltip)}
                  onMouseLeave={handleMouseLeave}
                >
                  {station.name}
                </text>
                {/* Vertical station line */}
                <line
                  x1={x}
                  y1={STATION_LABEL_HEIGHT}
                  x2={x}
                  y2={layout.totalHeight - 20}
                  stroke={isDarkMode ? '#334155' : '#e5e7eb'}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity="0.4"
                />
              </g>
            )
          })}

          {/* Track segments */}
          {layout.trackSegments.map((segment) => {
            const segmentTooltip = `Track: ${segment.trackType}\n${
              segment.fromStation
            } → ${segment.toStation}\nDistance: ${(
              segment.length / 1000
            ).toFixed(2)} km`

            return (
              <g key={segment.id}>
                {/* Invisible hover area */}
                <rect
                  x={Math.min(segment.fromX, segment.toX) - 5}
                  y={segment.y - 5}
                  width={Math.abs(segment.toX - segment.fromX) + 10}
                  height={TRACK_HEIGHT + 10}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, segmentTooltip)}
                  onMouseMove={(e) => handleMouseMove(e, segmentTooltip)}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Track line */}
                <line
                  x1={segment.fromX}
                  y1={segment.y + TRACK_HEIGHT / 2}
                  x2={segment.toX}
                  y2={segment.y + TRACK_HEIGHT / 2}
                  stroke={segment.color}
                  strokeWidth={TRACK_HEIGHT}
                  strokeLinecap="round"
                  opacity={0.8}
                />

                {/* Track border */}
                <line
                  x1={segment.fromX}
                  y1={segment.y + TRACK_HEIGHT / 2}
                  x2={segment.toX}
                  y2={segment.y + TRACK_HEIGHT / 2}
                  stroke={segment.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  opacity={1}
                />
              </g>
            )
          })}

          {/* Track type labels on the left */}
          {layout.trackTypes.map((trackType) => {
            const y = layout.trackYPositions.get(trackType.id) || 0
            return (
              <g key={`track-label-${trackType.id}`}>
                <rect
                  x={10}
                  y={y - 2}
                  width={80}
                  height={TRACK_HEIGHT + 4}
                  fill={trackType.color}
                  opacity={0.2}
                  stroke={trackType.color}
                  strokeWidth={1}
                  rx={2}
                />
                <text
                  x={50}
                  y={y + TRACK_HEIGHT / 2 + 4}
                  fill={trackType.color}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {trackType.label}
                </text>
              </g>
            )
          })}

          {/* TODO: Render trains when pipeline mapping is implemented */}
          {/* This requires mapping train.currentPipeline to our track segments */}
        </svg>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded shadow-lg p-1 z-10">
        <button
          onClick={() => setZoom((prev) => Math.min(prev + 0.2, 3))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={() => setZoom((prev) => Math.max(prev - 0.2, 0.3))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </div>
  )
}
