import React, { useState } from 'react'
import { PlatformState, PointMachine, AxleCounter, SignalAspect } from '../../../services/vduService'
import { TrainUpdate } from '../../../types/simulation.types'
import { Activity, ShieldAlert, Cpu, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'

interface Props {
  platforms: PlatformState[]
  pointMachines: PointMachine[]
  axleCounters: AxleCounter[]
  signals: SignalAspect[]
  liveTrains?: TrainUpdate[]
  onTrainClick?: (trainId: string) => void
}

export const StationInterlockingPanel: React.FC<Props> = ({
  platforms,
  pointMachines,
  axleCounters,
  signals,
  liveTrains = [],
  onTrainClick,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1)
  const [selectedElement, setSelectedElement] = useState<string | null>(null)

  // Quick lookup maps
  const platformMap = new Map(platforms.map((p) => [p.number, p]))
  const pointMap = new Map(pointMachines.map((p) => [p.id, p]))
  const signalMap = new Map(signals.map((s) => [s.id, s]))

  // Helper to determine train on platform
  const getTrainOnPlatform = (pfNum: number) => {
    const pf = platformMap.get(pfNum)
    if (!pf) return null
    if (pf.occupied_by) {
      return liveTrains.find((t) => t.id === pf.occupied_by) || { id: pf.occupied_by }
    }
    return null
  }

  return (
    <div className="bg-[#050811] border border-slate-700/80 rounded-xl overflow-hidden flex flex-col shadow-2xl">
      {/* VDU Control Room Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-950 via-[#0c1222] to-slate-950 border-b border-slate-700/70">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-400 font-mono text-[10px] font-extrabold uppercase tracking-widest">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            VDU INTERLOCKING DISPLAY UNIT
          </div>
          <span className="text-white font-bold text-xs tracking-wider font-mono">
            RAIPUR JUNCTION (R) — CENTRAL CABIN (SECR)
          </span>
          <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
            EI CLASS-II (NX TYPE)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-mono"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-mono"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(1)}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-mono"
            title="Reset Zoom"
          >
            <RefreshCw className="w-3 h-3" />
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-700 text-[10px] font-mono">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              AUTO ROUTE ON
            </span>
          </div>
        </div>
      </div>

      {/* Main Track Schematic SVG Area */}
      <div className="relative overflow-x-auto overflow-y-hidden p-4 bg-[#04060c] min-h-[380px] flex items-center justify-center select-none">
        <svg
          viewBox="0 0 1200 420"
          className="w-full h-auto transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          <defs>
            {/* Luminous filter for track circuit occupancy */}
            <filter id="red-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="green-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="yellow-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines for CAD style background */}
          <g stroke="#10192e" strokeWidth="0.5" strokeDasharray="3,3">
            {[...Array(20)].map((_, i) => (
              <line key={`v-${i}`} x1={i * 60} y1="0" x2={i * 60} y2="420" />
            ))}
            {[...Array(8)].map((_, i) => (
              <line key={`h-${i}`} x1="0" y1={i * 55} x2="1200" y2={i * 55} />
            ))}
          </g>

          {/* Directional markers */}
          <g fill="#475569" fontSize="10" fontFamily="monospace">
            <text x="30" y="30">◄ UP LINE (TOWARDS BHILAI / DURG)</text>
            <text x="960" y="30">DOWN LINE (TOWARDS BILASPUR) ►</text>
          </g>

          {/* ============================================================== */}
          {/* TRACK LINES (PLATFORMS 1 TO 7) */}
          {/* ============================================================== */}
          {/* Platform 1 (Main Up) */}
          {renderPlatformTrack(1, 90, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 2 (Main Down) */}
          {renderPlatformTrack(2, 135, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 3 (Loop Line 1) */}
          {renderPlatformTrack(3, 180, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 4 (Loop Line 2) */}
          {renderPlatformTrack(4, 225, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 5 (Loop Line 3) */}
          {renderPlatformTrack(5, 270, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 6 (Goods Yard Line) */}
          {renderPlatformTrack(6, 315, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* Platform 7 (Coaching / Reserve) */}
          {renderPlatformTrack(7, 360, platformMap, getTrainOnPlatform, onTrainClick)}

          {/* ============================================================== */}
          {/* APPROACH & DEPARTURE FEED TRACKS (UP & DOWN MAINS) */}
          {/* ============================================================== */}
          {/* Up Approach Main Line from Durg/Bhilai */}
          <line x1="20" y1="90" x2="280" y2="90" stroke="#38bdf8" strokeWidth="3" />
          <text x="40" y="82" fill="#38bdf8" fontSize="9" fontFamily="monospace">UP MAIN (201T)</text>

          {/* Down Approach Main Line to Bilaspur */}
          <line x1="900" y1="135" x2="1180" y2="135" stroke="#38bdf8" strokeWidth="3" />
          <text x="1040" y="127" fill="#38bdf8" fontSize="9" fontFamily="monospace">DN MAIN (202T)</text>

          {/* Down Approach from Bilaspur to Station */}
          <line x1="20" y1="135" x2="280" y2="135" stroke="#94a3b8" strokeWidth="2.5" />
          <line x1="900" y1="90" x2="1180" y2="90" stroke="#94a3b8" strokeWidth="2.5" />

          {/* ============================================================== */}
          {/* TURNOUTS / CROSSOVERS (POINT MACHINES) */}
          {/* ============================================================== */}
          {/* Pt 1A / 1B: Crossover Up Main to Loop Entry */}
          {renderTurnout('R-PM-1A', 220, 90, 280, 180, pointMap, 'Pt 1A')}
          {renderTurnout('R-PM-1B', 250, 90, 290, 135, pointMap, 'Pt 1B')}

          {/* Pt 3A: Up Main to Pf1/2 Split */}
          {renderTurnout('R-PM-3A', 200, 90, 240, 135, pointMap, 'Pt 3A')}

          {/* Pt 5A & 5B: Entry to Pf3 & Pf4 Loops */}
          {renderTurnout('R-PM-5A', 280, 180, 340, 225, pointMap, 'Pt 5A')}
          {renderTurnout('R-PM-5B', 300, 225, 360, 270, pointMap, 'Pt 5B')}

          {/* Pt 7A: Entry to Pf5 Loop and Yard */}
          {renderTurnout('R-PM-7A', 320, 270, 380, 315, pointMap, 'Pt 7A')}
          {renderTurnout('R-PM-12A', 340, 315, 400, 360, pointMap, 'Pt 12A')}

          {/* Down end exits crossovers */}
          {renderTurnout('R-PM-10A', 820, 180, 880, 135, pointMap, 'Pt 10A')}
          {renderTurnout('R-PM-10B', 800, 225, 860, 135, pointMap, 'Pt 10B')}
          {renderTurnout('R-PM-15A', 780, 315, 840, 135, pointMap, 'Pt 15A')}

          {/* ============================================================== */}
          {/* SIGNALS (HOME, STARTER, ADVANCED STARTER) */}
          {/* ============================================================== */}
          {/* Up Home (UH) before station entry */}
          {renderSignal('R-UH', 140, 90, 'up', signalMap, 'UH')}
          {/* Up Distant (UD) */}
          {renderSignal('R-UDIST', 60, 90, 'up', signalMap, 'UD')}

          {/* Starters at Platform 1 & 2 */}
          {renderSignal('R-US-1', 770, 90, 'up', signalMap, 'US1')}
          {renderSignal('R-US-2', 770, 135, 'up', signalMap, 'US2')}

          {/* Down Starters */}
          {renderSignal('R-DS-1', 410, 90, 'down', signalMap, 'DS1')}
          {renderSignal('R-DS-2', 410, 135, 'down', signalMap, 'DS2')}

          {/* Advanced Starters (UAS / DAS) */}
          {renderSignal('R-UAS', 980, 90, 'up', signalMap, 'UAS')}
          {renderSignal('R-DAS', 1060, 135, 'down', signalMap, 'DAS')}

          {/* Central Station Passenger Cabin Building */}
          <rect
            x="540"
            y="48"
            width="120"
            height="24"
            fill="#0f172a"
            stroke="#f59e0b"
            strokeWidth="1.5"
            rx="4"
          />
          <text
            x="600"
            y="64"
            fill="#f59e0b"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            ★ DRM RAIPUR HQ
          </text>
        </svg>
      </div>

      {/* Footer VDU Interlocking Legend & Status */}
      <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 text-[10px] font-mono flex items-center justify-between flex-wrap gap-2 text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#38bdf8] inline-block" />
            Clear Track
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-rose-500 shadow-[0_0_6px_#f43f5e] inline-block" />
            Berth Occupied (Red)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-amber-400 inline-block" />
            Route Locked (Amber)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] inline-block" />
            Signal Proceed
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>INTERLOCKING: <strong>STATIONARY NX SAFE</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-amber-400">7 PLATFORMS ACTIVE</span>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------
// SVG Rendering Helpers
// ----------------------------------------------------------------------

function renderPlatformTrack(
  pfNum: number,
  y: number,
  platformMap: Map<number, PlatformState>,
  getTrainOnPlatform: (pfNum: number) => any,
  onTrainClick?: (id: string) => void
) {
  const pf = platformMap.get(pfNum)
  const isOccupied = pf?.state === 'occupied'
  const isReserved = pf?.state === 'reserved'
  const train = getTrainOnPlatform(pfNum)

  const strokeColor = isOccupied ? '#f43f5e' : isReserved ? '#fbbf24' : '#38bdf8'
  const strokeWidth = isOccupied ? 4 : 2.5

  return (
    <g key={`pf-${pfNum}`}>
      {/* Platform Name on Left */}
      <text x="360" y={y - 7} fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
        PF-{pfNum} ({pf?.line_type?.toUpperCase() || 'MAIN'})
      </text>

      {/* Berth Line */}
      <line
        x1="420"
        y1={y}
        x2="760"
        y2={y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        filter={isOccupied ? 'url(#red-glow)' : undefined}
      />

      {/* Platform coping (physical platform representation) */}
      <rect
        x="420"
        y={y + 3}
        width="340"
        height="5"
        fill="#334155"
        stroke="#475569"
        strokeWidth="0.5"
        rx="1"
      />

      {/* Train describer box if occupied */}
      {isOccupied && train && (
        <g
          className="cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onTrainClick && onTrainClick(train.id)}
        >
          <rect
            x="510"
            y={y - 14}
            width="160"
            height="18"
            fill="#0b0f19"
            stroke="#f43f5e"
            strokeWidth="1.5"
            rx="3"
            filter="url(#red-glow)"
          />
          <text
            x="590"
            y={y - 2}
            fill="#ffffff"
            fontSize="10"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            ● {train.id}
          </text>
        </g>
      )}

      {/* Reserved Indicator if empty but booked */}
      {isReserved && !isOccupied && (
        <g>
          <rect
            x="540"
            y={y - 12}
            width="100"
            height="14"
            fill="#0f172a"
            stroke="#fbbf24"
            strokeWidth="1"
            rx="2"
          />
          <text
            x="590"
            y={y - 2}
            fill="#fbbf24"
            fontSize="8"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
          >
            RSVD: {pf?.reserved_for || 'INCOMING'}
          </text>
        </g>
      )}
    </g>
  )
}

function renderTurnout(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pointMap: Map<string, PointMachine>,
  label: string
) {
  const pm = pointMap.get(id)
  const isReverse = pm?.position === 'Reverse'
  const isFault = pm?.status === 'fault'

  const strokeColor = isFault ? '#f43f5e' : isReverse ? '#fbbf24' : '#64748b'

  return (
    <g key={id}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={isReverse ? 3 : 1.5}
        strokeDasharray={isReverse ? undefined : '4,3'}
      />
      {/* Switch point number circle */}
      <circle
        cx={(x1 + x2) / 2}
        cy={(y1 + y2) / 2}
        r="6"
        fill="#0a0f1d"
        stroke={strokeColor}
        strokeWidth="1"
      />
      <text
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 + 3}
        fill={strokeColor}
        fontSize="6"
        fontWeight="bold"
        fontFamily="monospace"
        textAnchor="middle"
      >
        {label.replace('Pt ', '')}
      </text>
    </g>
  )
}

function renderSignal(
  id: string,
  x: number,
  y: number,
  dir: 'up' | 'down',
  signalMap: Map<string, SignalAspect>,
  label: string
) {
  const sig = signalMap.get(id)
  const aspect = sig?.aspect || 'red'

  const fillColor =
    aspect === 'green'
      ? '#22c55e'
      : aspect === 'yellow' || aspect === 'double_yellow'
      ? '#f59e0b'
      : '#ef4444'

  return (
    <g key={id}>
      {/* Signal Post */}
      <line x1={x} y1={y} x2={x} y2={y - 18} stroke="#94a3b8" strokeWidth="2" />
      {/* Signal Head */}
      <circle
        cx={x}
        cy={y - 18}
        r="5"
        fill={fillColor}
        stroke="#0f172a"
        strokeWidth="1.5"
        filter={aspect === 'green' ? 'url(#green-glow)' : aspect === 'red' ? 'url(#red-glow)' : 'url(#yellow-glow)'}
      />
      {/* Signal Name Label */}
      <text
        x={x}
        y={y - 25}
        fill="#cbd5e1"
        fontSize="7"
        fontWeight="bold"
        fontFamily="monospace"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}
