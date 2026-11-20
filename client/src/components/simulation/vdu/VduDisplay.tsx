import React, { useState } from 'react'
import { useVduSnapshot } from '../../../hooks/useVduSnapshot'
import { PlatformStatusBoard } from './PlatformStatusBoard'
import { PointMachinePanel } from './PointMachinePanel'
import { AxleCounterGrid } from './AxleCounterGrid'
import { SignalAspectPanel } from './SignalAspectPanel'
import { StationInterlockingPanel } from './StationInterlockingPanel'
import { TrainUpdate } from '../../../types/simulation.types'
import {
  Monitor,
  Activity,
  GitBranch,
  ShieldAlert,
  Radio,
  Train,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

interface Props {
  corridor?: string
  liveTrains?: TrainUpdate[]
  onTrainClick?: (trainId: string) => void
  onOpenAiRecommendation?: () => void
}

export const VduDisplay: React.FC<Props> = ({
  corridor = 'secr-raipur',
  liveTrains = [],
  onTrainClick,
  onOpenAiRecommendation,
}) => {
  const { snapshot, loading, error } = useVduSnapshot(corridor, 2000)
  const [selectedStation, setSelectedStation] = useState<string>('Raipur Jn')
  const [activeSubView, setActiveSubView] = useState<'schematic' | 'platforms' | 'points' | 'axles' | 'signals'>('schematic')

  const stations = [
    { id: 'Raipur Jn', name: 'Raipur Jn (R)', badge: '★ DRM HQ (7 PFs)', color: 'text-amber-400' },
    { id: 'Durg', name: 'Durg Jn (DURG)', badge: '3 PFs / Shed', color: 'text-blue-400' },
    { id: 'Bhilai Power House', name: 'Bhilai (BPHB)', badge: 'Steel Yard', color: 'text-purple-400' },
    { id: 'Bilaspur Jn', name: 'Bilaspur (BSP)', badge: '4 PFs / Zonal HQ', color: 'text-emerald-400' },
  ]

  if (loading && !snapshot) {
    return (
      <div className="bg-[#050811] rounded-xl border border-slate-800 p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-300">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-3" />
        <h3 className="text-sm font-bold font-mono tracking-wider text-amber-400">
          INITIALIZING VDU INTERLOCKING CONTROLLER...
        </h3>
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Connecting to SECR DRM Raipur Relay Cabin Telemetry...
        </p>
      </div>
    )
  }

  const platforms = snapshot?.platforms || []
  const pointMachines = snapshot?.pointMachines || []
  const axleCounters = snapshot?.axleCounters || []
  const signals = snapshot?.signals || []

  // Station specific metrics
  const stationPlatforms = platforms.filter((p) => p.station === selectedStation)
  const stationOccPlatforms = stationPlatforms.filter((p) => p.state === 'occupied').length
  const stationPoints = pointMachines.filter((p) => p.station === selectedStation)
  const stationAxles = axleCounters.filter((ac) => ac.station === selectedStation)
  const stationSignals = signals.filter((s) => s.station === selectedStation)

  return (
    <div className="bg-[#04060d] text-slate-200 rounded-xl border border-slate-800/80 p-3 flex flex-col gap-3 shadow-2xl">
      {/* VDU Top Master Control Room Bar */}
      <div className="bg-[#090e1c] border border-slate-700/60 rounded-lg p-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white font-mono tracking-wider">
                DRM RAIPUR — VISUAL DISPLAY UNIT (VDU)
              </h2>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                SECR OPERATIONAL OCC
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Live Station Interlocking, Platform Berth Occupancy, Point Machines & Axle Counters
            </p>
          </div>
        </div>

        {/* Station Selector Buttons */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-700/60 flex-wrap gap-1">
          {stations.map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStation(st.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                selectedStation === st.id
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{st.name}</span>
              <span
                className={`text-[8px] px-1 py-0.2 rounded ${
                  selectedStation === st.id
                    ? 'bg-slate-950 text-amber-400 font-extrabold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {st.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Status Strip for the selected station */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Platform Occupancy */}
        <div className="bg-[#090e1c] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Platform Berths</span>
            <div className="text-base font-extrabold font-mono text-amber-400 mt-0.5">
              {stationOccPlatforms} / {stationPlatforms.length} <span className="text-[10px] text-slate-400 font-normal">OCCUPIED</span>
            </div>
          </div>
          <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20 text-amber-400">
            <Train className="w-4 h-4" />
          </div>
        </div>

        {/* Point Machines */}
        <div className="bg-[#090e1c] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Point Machines</span>
            <div className="text-base font-extrabold font-mono text-blue-400 mt-0.5">
              {stationPoints.length} <span className="text-[10px] text-emerald-400 font-bold">ALL LOCKED</span>
            </div>
          </div>
          <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20 text-blue-400">
            <GitBranch className="w-4 h-4" />
          </div>
        </div>

        {/* Axle Counters */}
        <div className="bg-[#090e1c] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Axle Circuits</span>
            <div className="text-base font-extrabold font-mono text-emerald-400 mt-0.5">
              {stationAxles.length} <span className="text-[10px] text-slate-300 font-normal">MONITORED</span>
            </div>
          </div>
          <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20 text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        {/* Signals */}
        <div className="bg-[#090e1c] border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Signals (MACLS)</span>
            <div className="text-base font-extrabold font-mono text-yellow-400 mt-0.5">
              {stationSignals.length} <span className="text-[10px] text-slate-400 font-normal">PROVED</span>
            </div>
          </div>
          <div className="p-2 bg-yellow-500/10 rounded border border-yellow-500/20 text-yellow-400">
            <Radio className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Schematic & Sub-view Switcher */}
      <div className="flex items-center justify-between bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-slate-400 uppercase">View Mode:</span>
          <button
            onClick={() => setActiveSubView('schematic')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              activeSubView === 'schematic' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Track Schematic (Interlocking)
          </button>
          <button
            onClick={() => setActiveSubView('platforms')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              activeSubView === 'platforms' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Platform Board ({stationPlatforms.length})
          </button>
          <button
            onClick={() => setActiveSubView('points')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              activeSubView === 'points' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Point Machines ({stationPoints.length})
          </button>
          <button
            onClick={() => setActiveSubView('axles')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              activeSubView === 'axles' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Axle Counters ({stationAxles.length})
          </button>
          <button
            onClick={() => setActiveSubView('signals')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors ${
              activeSubView === 'signals' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Signals ({stationSignals.length})
          </button>
        </div>

        {onOpenAiRecommendation && (
          <button
            onClick={onOpenAiRecommendation}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI SECR Dispatch Advisor
          </button>
        )}
      </div>

      {/* Primary Display Area */}
      {activeSubView === 'schematic' && (
        <StationInterlockingPanel
          platforms={stationPlatforms}
          pointMachines={stationPoints}
          axleCounters={stationAxles}
          signals={stationSignals}
          liveTrains={liveTrains}
          onTrainClick={onTrainClick}
        />
      )}

      {activeSubView === 'platforms' && (
        <PlatformStatusBoard platforms={platforms} station={selectedStation} />
      )}

      {activeSubView === 'points' && (
        <PointMachinePanel pointMachines={pointMachines} station={selectedStation} />
      )}

      {activeSubView === 'axles' && (
        <AxleCounterGrid axleCounters={axleCounters} station={selectedStation} />
      )}

      {activeSubView === 'signals' && (
        <SignalAspectPanel signals={signals} station={selectedStation} />
      )}

      {/* Multi-Panel Grid: Bottom overview of all assets simultaneously */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
        <PlatformStatusBoard platforms={platforms} station={selectedStation} />
        <PointMachinePanel pointMachines={pointMachines} station={selectedStation} />
        <AxleCounterGrid axleCounters={axleCounters} station={selectedStation} />
        <SignalAspectPanel signals={signals} station={selectedStation} />
      </div>
    </div>
  )
}
