import React from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { TrainUpdate, TrainState } from '../../types/simulation.types'
import {
  X,
  Train,
  MapPin,
  Gauge,
  Clock,
  Navigation,
  AlertTriangle,
  Radio,
  ArrowRight,
} from 'lucide-react'

interface TrainInfoPanelProps {
  train: TrainUpdate | null
  onClose: () => void
  emergencyReason?: string | null
}

export const TrainInfoPanel: React.FC<TrainInfoPanelProps> = ({
  train: initialTrain,
  onClose,
  emergencyReason,
}) => {
  const { trains } = useSimulation()
  const train = (initialTrain ? trains.get(initialTrain.id) : null) || initialTrain

  const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 80 })
  const [dragging, setDragging] = React.useState(false)
  const dragOffsetRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    const panel = e.currentTarget.parentElement as HTMLDivElement
    const rect = panel.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    e.preventDefault()
  }

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!dragging) return
      const nextX = e.clientX - dragOffsetRef.current.x
      const nextY = e.clientY - dragOffsetRef.current.y
      setPos({ x: Math.max(0, nextX), y: Math.max(0, nextY) })
    },
    [dragging]
  )

  const handleMouseUp = React.useCallback(() => {
    setDragging(false)
  }, [])

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  React.useEffect(() => {
    const PANEL_WIDTH = 360
    const margin = 16
    const x = Math.max(0, window.innerWidth - PANEL_WIDTH - margin)
    setPos((prev) => ({ x: prev.x === 0 ? x : prev.x, y: prev.y }))
  }, [])

  if (!train) return null

  const getStateColor = (state: TrainState): string => {
    switch (state) {
      case TrainState.SCHEDULED:
        return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
      case TrainState.EMERGENCY:
        return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
      case TrainState.STOPPED:
        return 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
      case TrainState.CRUISING:
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
      default:
        return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    }
  }

  const aspectBadgeColor =
    train.signalAspect === 'RED'
      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40'
      : train.signalAspect === 'YELLOW' || train.signalAspect === 'DOUBLE_YELLOW'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40'
      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40'

  const speedKmh = train.gps?.speed ?? train.speed * 3.6
  const speedPts = train.speedHistory || []
  const maxHistSpeed = Math.max(100, ...speedPts.map((s) => s.speed))
  const lastHist = speedPts.length >= 2 ? speedPts[speedPts.length - 1].speed : speedKmh
  const prevHist = speedPts.length >= 2 ? speedPts[speedPts.length - 2].speed : speedKmh
  const accelDelta = lastHist - prevHist
  const dynamicsLabel =
    train.signalAspect === 'RED' && speedKmh < 1
      ? 'SIG HOLD'
      : accelDelta > 1.2
      ? 'ACCEL ▲'
      : accelDelta < -1.2
      ? 'BRAKING ▼'
      : speedKmh > 1
      ? 'CRUISE ●'
      : 'DWELL'

  return (
    <div
      className="fixed backdrop-blur-xl bg-white/95 dark:bg-[#0b1120]/95 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl w-[340px] z-50 overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className={`bg-slate-100/90 dark:bg-slate-900/90 px-4 py-2.5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Train className="w-4 h-4 text-emerald-500" />
          <div>
            <h3 className="text-sm font-extrabold font-mono text-slate-900 dark:text-white leading-none">
              {train.id}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {train.lineId === 'secr-raipur' ? 'SECR Raipur Div' : 'CR CSMT-Kalyan'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5 space-y-2.5 text-xs">
        {/* Live Status & Signal Aspect */}
        <div className={`px-3 py-2 rounded-xl border flex items-center justify-between ${getStateColor(train.state)}`}>
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-75">Operational Status</div>
            <div className="font-bold uppercase">{train.state}</div>
            {train.stateReason && (
              <div className="text-[10px] opacity-85 mt-0.5">{train.stateReason}</div>
            )}
          </div>
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${aspectBadgeColor}`}>
            <Radio className="w-3 h-3" />
            {train.signalAspect || 'GREEN'}
          </div>
        </div>

        {emergencyReason && (
          <div className="bg-red-50/50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-2.5">
            <div className="text-[10px] font-bold text-red-700 dark:text-red-300 mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Emergency Alert
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">{emergencyReason}</div>
          </div>
        )}

        {/* Speed & Delay */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700/70">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-500" /> Live Speed
            </div>
            <div className="text-lg font-extrabold font-mono text-slate-900 dark:text-white">
              {speedKmh.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700/70">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" /> Physics Delay
            </div>
            <div className={`text-lg font-extrabold font-mono ${train.delay > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {train.delay > 0 ? `+${train.delay.toFixed(0)}s` : 'ON TIME'}
            </div>
          </div>
        </div>

        {/* Speed Telemetry Sparkline */}
        {speedPts.length > 1 && (
          <div className="bg-slate-100/90 dark:bg-slate-950/90 rounded-xl p-2 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex justify-between items-center">
              <span>Speed Profile (Telemetry)</span>
              <span className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">{dynamicsLabel}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.round(speedKmh)} kph</span>
              </span>
            </div>
            <svg viewBox="0 0 260 36" className="w-full h-9">
              {(() => {
                const coords = speedPts.map((pt, idx) => ({
                  x: (idx / Math.max(1, speedPts.length - 1)) * 252 + 4,
                  y: 32 - (Math.min(pt.speed, maxHistSpeed) / maxHistSpeed) * 28,
                }))
                const lineStr = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
                const areaStr = `4,34 ${lineStr} ${coords[coords.length - 1].x.toFixed(1)},34`
                const tail = coords[coords.length - 1]
                return (
                  <>
                    <polygon points={areaStr} fill="#10b981" fillOpacity="0.14" />
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={lineStr}
                    />
                    <circle cx={tail.x} cy={tail.y} r="2.8" fill="#10b981" />
                  </>
                )
              })()}
            </svg>
          </div>
        )}

        {/* Section & Sector Info */}
        <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 border border-slate-200 dark:border-slate-700/70 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Section:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1">
              {train.currentStation || '—'}
              <ArrowRight className="w-3 h-3 text-slate-400" />
              {train.nextStation || train.destination || '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400">Sector ID:</span>
            <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 truncate max-w-[180px]">
              {train.currentSection || train.currentPipeline || 'In Transit'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Navigation className="w-3 h-3" /> GPS:
            </span>
            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
              {train.gps.latitude.toFixed(5)}, {train.gps.longitude.toFixed(5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
