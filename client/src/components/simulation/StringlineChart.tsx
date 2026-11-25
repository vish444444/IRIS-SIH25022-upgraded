import React, { useMemo, useRef, useEffect, useState } from 'react'
import { LiveTrainData, TRAIN_TYPE_COLORS } from '../../types/liveTrains.types'
import { GPSToMapConverter, Station as GpsStation } from '../../utils/gpsToMapConverter'
import { Station } from '../../utils/corridorMapParser'
import { Activity, AlertTriangle, X } from 'lucide-react'
import { useIsDarkMode } from '../theme-provider'

interface TrajectoryPoint {
  timeMs: number
  km: number
  speed: number
}

interface ForecastSegment {
  trainId: string
  t1: number
  km1: number
  t2: number
  km2: number
  dirSign: number
  speed: number
  signalAspect?: string
  color: string
}

interface CrossingPoint {
  t: number
  km: number
  trainA: string
  trainB: string
}

interface Props {
  lineId: string
  stations: Station[]
  trains: LiveTrainData[]
  currentTime?: Date
  onTrainClick?: (trainId: string) => void
  onClose: () => void
}

const MAX_HISTORY_POINTS = 140

/**
 * Live Time-Distance Trajectory Graph (Stringline / Marey Chart)
 * Dual-theme light/dark chart showing train distance (km) over time,
 * station dwell plateaus, toggleable +10m/+20m forecast, and overtake convergence markers.
 */
export const StringlineChart: React.FC<Props> = ({
  lineId,
  stations,
  trains,
  currentTime,
  onTrainClick,
  onClose,
}) => {
  const isDarkMode = useIsDarkMode()
  const historyRef = useRef<Map<string, TrajectoryPoint[]>>(new Map())
  const lastLineRef = useRef<string>(lineId)
  const [, forceTick] = useState(0)
  const [horizonMin, setHorizonMin] = useState<10 | 20>(10)
  const [hoveredTrain, setHoveredTrain] = useState<{
    id: string
    km: number
    speed: number
    signal: string
  } | null>(null)

  const gpsStations: GpsStation[] = useMemo(
    () =>
      stations.map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      })),
    [stations]
  )

  const converter = useMemo(
    () =>
      new GPSToMapConverter(
        { width: 2000, height: 400, paddingX: 0, paddingY: 0 },
        100,
        gpsStations
      ),
    [gpsStations]
  )

  // Reset buffered trajectories when switching corridors
  if (lastLineRef.current !== lineId) {
    historyRef.current.clear()
    lastLineRef.current = lineId
  }

  // Record incoming train positions into rolling trajectory history
  useEffect(() => {
    const lineTrains = trains.filter((t) => t.line_id === lineId)
    let changed = false

    lineTrains.forEach((train) => {
      const km = converter.getDistanceFromStart(train.lat, train.lng)
      const timeMs = train.timestamp || currentTime?.getTime() || Date.now()
      const pts = historyRef.current.get(train.train_id) || []
      const last = pts[pts.length - 1]

      // Handle simulation reset (timestamp moved backward)
      if (last && timeMs < last.timeMs - 30000) {
        historyRef.current.set(train.train_id, [{ timeMs, km, speed: train.speed }])
        changed = true
        return
      }

      if (!last || timeMs > last.timeMs) {
        pts.push({ timeMs, km, speed: train.speed })
        if (pts.length > MAX_HISTORY_POINTS) pts.shift()
        historyRef.current.set(train.train_id, pts)
        changed = true
      }
    })

    if (changed) forceTick((n) => n + 1)
  }, [trains, lineId, converter, currentTime])

  const totalKm = Math.max(1, stations[stations.length - 1]?.kmFromStart || 50)
  const nowMs = useMemo(() => {
    const lineTrains = trains.filter((t) => t.line_id === lineId)
    if (lineTrains.length > 0) {
      return Math.max(...lineTrains.map((t) => t.timestamp || 0)) || currentTime?.getTime() || Date.now()
    }
    return currentTime?.getTime() || Date.now()
  }, [trains, lineId, currentTime])

  // Time window: [now - 18 min, now + horizonMin min projected]
  const pastMs = 18 * 60 * 1000
  const futureMs = horizonMin * 60 * 1000
  const minTime = nowMs - pastMs
  const maxTime = nowMs + futureMs

  const width = 920
  const height = 220
  const padL = 94
  const padR = 24
  const padT = 18
  const padB = 26
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const xForTime = (tMs: number) =>
    padL + ((tMs - minTime) / (maxTime - minTime)) * plotW
  const yForKm = (km: number) => padT + (1 - km / totalKm) * plotH

  // Pick key station ticks so labels stay clean and legible
  const keyStations = useMemo(() => {
    if (stations.length <= 7) return stations
    const step = Math.max(1, Math.floor((stations.length - 1) / 5))
    return stations.filter(
      (s, idx) =>
        idx === 0 ||
        idx === stations.length - 1 ||
        s.name === 'R' ||
        s.name === 'DADAR' ||
        s.name === 'THANE' ||
        idx % step === 0
    )
  }, [stations])

  const nowX = xForTime(nowMs)
  const activeLineTrains = trains.filter((t) => t.line_id === lineId)

  // Compute linear forecast vectors + detect predicted overtake/headway crossings
  const { forecasts, crossings } = useMemo(() => {
    const segs: ForecastSegment[] = activeLineTrains.map((train) => {
      const currentKm = converter.getDistanceFromStart(train.lat, train.lng)
      const tType = train.trackType?.toLowerCase() || ''
      const dirSign = tType.startsWith('down')
        ? -1
        : tType.startsWith('up')
        ? 1
        : ['CSMT', 'DURG', 'BPHB', 'BIA', 'SRWN'].some((k) =>
            train.destination?.toUpperCase().includes(k)
          )
        ? -1
        : 1

      const speedKmPerMs = (train.speed || 0) / 3600000
      const projectedKm = Math.max(
        0,
        Math.min(totalKm, currentKm + dirSign * speedKmPerMs * futureMs)
      )
      const projTime =
        speedKmPerMs > 0
          ? Math.min(maxTime, nowMs + Math.abs(projectedKm - currentKm) / speedKmPerMs)
          : maxTime

      return {
        trainId: train.train_id,
        t1: nowMs,
        km1: currentKm,
        t2: projTime,
        km2: projectedKm,
        dirSign,
        speed: train.speed || 0,
        signalAspect: train.signalAspect,
        color: TRAIN_TYPE_COLORS[train.type] || '#38bdf8',
      }
    })

    const found: CrossingPoint[] = []
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i]
        const b = segs[j]
        if (a.dirSign !== b.dirSign) continue // Same-direction overtake / headway convergence
        const dtA = a.t2 - a.t1
        const dkA = a.km2 - a.km1
        const dtB = b.t2 - b.t1
        const dkB = b.km2 - b.km1
        const denom = dtA * dkB - dkA * dtB
        if (Math.abs(denom) < 1e-6) continue
        const s = ((b.t1 - a.t1) * dkB - (b.km1 - a.km1) * dtB) / denom
        const u = ((b.t1 - a.t1) * dkA - (b.km1 - a.km1) * dtA) / denom
        if (s > 0.02 && s < 0.98 && u > 0.02 && u < 0.98) {
          found.push({
            t: a.t1 + s * dtA,
            km: a.km1 + s * dkA,
            trainA: a.trainId.replace('SECR_', ''),
            trainB: b.trainId.replace('SECR_', ''),
          })
        }
      }
    }

    return { forecasts: segs, crossings: found }
  }, [activeLineTrains, converter, futureMs, maxTime, nowMs, totalKm])

  // Time grid marks every 5 minutes
  const timeTicks = useMemo(() => {
    const interval = 5 * 60 * 1000
    const first = Math.ceil(minTime / interval) * interval
    const list: number[] = []
    for (let t = first; t <= maxTime; t += interval) {
      list.push(t)
    }
    return list
  }, [minTime, maxTime])

  const gridStroke = isDarkMode ? '#1e293b' : '#cbd5e1'
  const axisLabelColor = isDarkMode ? '#64748b' : '#475569'
  const stationLabelColor = isDarkMode ? '#94a3b8' : '#475569'
  const highlightColor = isDarkMode ? '#f59e0b' : '#d97706'
  const highlightTextColor = isDarkMode ? '#fbbf24' : '#b45309'
  const nowColor = isDarkMode ? '#10b981' : '#059669'

  return (
    <div className="transition-colors duration-300 bg-white/95 dark:bg-slate-950/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-xl px-3 py-2 flex flex-col gap-1.5 z-20">
      <div className="flex items-center justify-between text-[11px] flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="font-bold tracking-wider uppercase text-slate-800 dark:text-slate-200">
            Time-Distance Stringline Graph (Marey Trajectory)
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
            • Solid: Recorded Path | Dashed: +{horizonMin}m Forecast
          </span>
          {crossings.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40">
              <AlertTriangle className="w-3 h-3" />
              {crossings.length} Headway Crossing{crossings.length > 1 ? 's' : ''}
            </span>
          )}
          {hoveredTrain && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
              {hoveredTrain.id.replace('SECR_', '')} • KM {hoveredTrain.km.toFixed(1)} • {Math.round(hoveredTrain.speed)} km/h • {hoveredTrain.signal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
            {[10, 20].map((m) => (
              <button
                key={m}
                onClick={() => setHorizonMin(m as 10 | 20)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  horizonMin === m
                    ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title={`Set forecast horizon to +${m} minutes`}
              >
                +{m}m
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Close Stringline Chart"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[185px] min-w-[640px] select-none">
          {/* Plot background */}
          <rect
            x={padL}
            y={padT}
            width={plotW}
            height={plotH}
            rx={4}
            fill={isDarkMode ? '#020617' : '#f8fafc'}
            style={{ transition: 'fill 300ms ease' }}
          />

          {/* Station horizontal gridlines */}
          {keyStations.map((st) => {
            const y = yForKm(st.kmFromStart)
            const isHighlight = st.name === 'R' || st.name === 'DADAR' || st.name === 'THANE'
            return (
              <g key={`str-st-${st.name}`}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke={isHighlight ? highlightColor : gridStroke}
                  strokeWidth={isHighlight ? 0.9 : 0.7}
                  strokeDasharray={isHighlight ? '4,3' : '2,4'}
                  opacity={isHighlight ? 0.65 : 0.85}
                />
                <text
                  x={padL - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9.5"
                  fontFamily="ui-monospace, monospace"
                  fontWeight={isHighlight ? 'bold' : 'normal'}
                  fill={isHighlight ? highlightTextColor : stationLabelColor}
                >
                  {st.name === 'R' ? 'RAIPUR ★' : st.name.slice(0, 10)}
                </text>
              </g>
            )
          })}

          {/* Time vertical gridlines */}
          {timeTicks.map((t) => {
            const x = xForTime(t)
            return (
              <g key={`str-t-${t}`}>
                <line x1={x} y1={padT} x2={x} y2={height - padB} stroke={gridStroke} strokeWidth={0.7} />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                  fill={axisLabelColor}
                >
                  {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </text>
              </g>
            )
          })}

          {/* Shaded forecast horizon */}
          <rect
            x={nowX}
            y={padT}
            width={Math.max(0, width - padR - nowX)}
            height={plotH}
            fill={isDarkMode ? '#0ea5e9' : '#0284c7'}
            opacity={isDarkMode ? 0.05 : 0.06}
          />
          <line
            x1={nowX}
            y1={padT}
            x2={nowX}
            y2={height - padB}
            stroke={nowColor}
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
          <text
            x={nowX + 4}
            y={padT + 9}
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fontWeight="bold"
            fill={nowColor}
          >
            NOW +{horizonMin}M FORECAST
          </text>

          {/* Train recorded paths + dashed velocity projections */}
          {forecasts.map((fc) => {
            const pts = (historyRef.current.get(fc.trainId) || []).filter(
              (p) => p.timeMs >= minTime && p.timeMs <= nowMs
            )

            const pathStr =
              pts.length > 1
                ? pts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xForTime(p.timeMs).toFixed(1)} ${yForKm(p.km).toFixed(1)}`)
                    .join(' ')
                : ''

            const curX = xForTime(fc.t1)
            const curY = yForKm(fc.km1)

            return (
              <g
                key={`str-tr-${fc.trainId}`}
                className="cursor-pointer"
                onClick={() => onTrainClick?.(fc.trainId)}
                onMouseEnter={() =>
                  setHoveredTrain({
                    id: fc.trainId,
                    km: fc.km1,
                    speed: fc.speed,
                    signal: fc.signalAspect || 'GREEN',
                  })
                }
                onMouseLeave={() => setHoveredTrain(null)}
              >
                {pathStr && (
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={fc.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.92}
                  />
                )}
                {/* Dashed forward forecast line */}
                <line
                  x1={curX}
                  y1={curY}
                  x2={xForTime(fc.t2)}
                  y2={yForKm(fc.km2)}
                  stroke={fc.color}
                  strokeWidth={1.4}
                  strokeDasharray="4,3"
                  opacity={0.6}
                />
                {/* Live marker dot */}
                <circle
                  cx={curX}
                  cy={curY}
                  r={3.5}
                  fill={fc.signalAspect === 'RED' ? '#ef4444' : fc.color}
                  stroke={isDarkMode ? '#020617' : '#ffffff'}
                  strokeWidth={1.3}
                />
                <text
                  x={curX + 5}
                  y={curY + 3}
                  fontSize="7.5"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  fill={isDarkMode ? '#e2e8f0' : '#0f172a'}
                >
                  {fc.trainId.replace('SECR_', '')}
                </text>
              </g>
            )
          })}

          {/* Predicted Overtake / Headway Convergence Crossing Markers */}
          {crossings.map((c, idx) => {
            const cx = xForTime(c.t)
            const cy = yForKm(c.km)
            return (
              <g key={`cross-${idx}`}>
                <circle cx={cx} cy={cy} r={6} fill="none" stroke="#f59e0b" strokeWidth={1.2} opacity={0.65} className="animate-ping" />
                <polygon
                  points={`${cx},${cy - 4.5} ${cx + 4.5},${cy} ${cx},${cy + 4.5} ${cx - 4.5},${cy}`}
                  fill="#f59e0b"
                  stroke={isDarkMode ? '#020617' : '#ffffff'}
                  strokeWidth={1}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
