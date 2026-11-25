import React, { useMemo, useRef, useEffect, useState } from 'react'
import { LiveTrainData, TRAIN_TYPE_COLORS } from '../../types/liveTrains.types'
import { GPSToMapConverter, Station as GpsStation } from '../../utils/gpsToMapConverter'
import { Station } from '../../utils/corridorMapParser'
import { Activity, X } from 'lucide-react'

interface TrajectoryPoint {
  timeMs: number
  km: number
  speed: number
}

interface Props {
  lineId: string
  stations: Station[]
  trains: LiveTrainData[]
  currentTime?: Date
  onTrainClick?: (trainId: string) => void
  onClose: () => void
}

const MAX_HISTORY_POINTS = 120

/**
 * Live Time-Distance Trajectory Graph (Stringline / Marey Chart)
 * Standard railway dispatch view showing train distance (km) over time,
 * station dwell plateaus, forward velocity projections, and overtake convergence.
 */
export const StringlineChart: React.FC<Props> = ({
  lineId,
  stations,
  trains,
  currentTime,
  onTrainClick,
  onClose,
}) => {
  const historyRef = useRef<Map<string, TrajectoryPoint[]>>(new Map())
  const lastLineRef = useRef<string>(lineId)
  const [, forceTick] = useState(0)

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

  // Time window: [now - 18 min, now + 10 min projected]
  const pastMs = 18 * 60 * 1000
  const futureMs = 10 * 60 * 1000
  const minTime = nowMs - pastMs
  const maxTime = nowMs + futureMs

  const width = 920
  const height = 220
  const padL = 78
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

  return (
    <div className="bg-slate-950/95 border-t border-slate-800 backdrop-blur-xl px-3 py-2 flex flex-col gap-1.5 z-20">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold tracking-wider uppercase text-slate-200">
            Time-Distance Stringline Graph (Marey Trajectory)
          </span>
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            • Solid: Recorded Path | Dashed: +10m Velocity Forecast
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Close Stringline Chart"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[185px] min-w-[640px] select-none">
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
                  stroke={isHighlight ? '#f59e0b' : '#1e293b'}
                  strokeWidth={isHighlight ? 0.9 : 0.7}
                  strokeDasharray={isHighlight ? '4,3' : '2,4'}
                  opacity={isHighlight ? 0.55 : 0.8}
                />
                <text
                  x={padL - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="8.5"
                  fontFamily="ui-monospace, monospace"
                  fontWeight={isHighlight ? 'bold' : 'normal'}
                  fill={isHighlight ? '#fbbf24' : '#94a3b8'}
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
                <line x1={x} y1={padT} x2={x} y2={height - padB} stroke="#1e293b" strokeWidth={0.7} />
                <text
                  x={x}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                  fill="#64748b"
                >
                  {new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </text>
              </g>
            )
          })}

          {/* Shaded +10 min forecast horizon */}
          <rect
            x={nowX}
            y={padT}
            width={Math.max(0, width - padR - nowX)}
            height={plotH}
            fill="#0ea5e9"
            opacity={0.05}
          />
          <line
            x1={nowX}
            y1={padT}
            x2={nowX}
            y2={height - padB}
            stroke="#10b981"
            strokeWidth={1.5}
            strokeDasharray="3,3"
          />
          <text
            x={nowX + 4}
            y={padT + 9}
            fontSize="8"
            fontFamily="ui-monospace, monospace"
            fontWeight="bold"
            fill="#10b981"
          >
            NOW + FORECAST
          </text>

          {/* Train recorded paths + dashed velocity projections */}
          {activeLineTrains.map((train) => {
            const pts = (historyRef.current.get(train.train_id) || []).filter(
              (p) => p.timeMs >= minTime && p.timeMs <= nowMs
            )
            const currentKm = converter.getDistanceFromStart(train.lat, train.lng)
            const color = TRAIN_TYPE_COLORS[train.type] || '#38bdf8'

            // Determine sign along corridor (+1 UP, -1 DOWN)
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
                ? Math.min(
                    maxTime,
                    nowMs + Math.abs(projectedKm - currentKm) / speedKmPerMs
                  )
                : maxTime

            const pathStr =
              pts.length > 1
                ? pts
                    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${xForTime(p.timeMs).toFixed(1)} ${yForKm(p.km).toFixed(1)}`)
                    .join(' ')
                : ''

            const curX = xForTime(nowMs)
            const curY = yForKm(currentKm)

            return (
              <g
                key={`str-tr-${train.train_id}`}
                className="cursor-pointer"
                onClick={() => onTrainClick?.(train.train_id)}
              >
                {pathStr && (
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                )}
                {/* Dashed forward forecast line */}
                <line
                  x1={curX}
                  y1={curY}
                  x2={xForTime(projTime)}
                  y2={yForKm(projectedKm)}
                  stroke={color}
                  strokeWidth={1.3}
                  strokeDasharray="4,3"
                  opacity={0.55}
                />
                {/* Live marker dot */}
                <circle
                  cx={curX}
                  cy={curY}
                  r={3.5}
                  fill={train.signalAspect === 'RED' ? '#ef4444' : color}
                  stroke="#020617"
                  strokeWidth={1.2}
                />
                <text
                  x={curX + 5}
                  y={curY + 3}
                  fontSize="7.5"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="bold"
                  fill="#e2e8f0"
                >
                  {train.train_id.replace('SECR_', '')}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
