import React from 'react'
import { AxleCounter } from '../../../services/vduService'
import { Activity, ShieldCheck, ShieldAlert, RotateCcw } from 'lucide-react'

interface Props {
  axleCounters: AxleCounter[]
  station?: string
}

export const AxleCounterGrid: React.FC<Props> = ({ axleCounters, station }) => {
  const filtered = station
    ? axleCounters.filter((ac) => ac.station === station)
    : axleCounters

  if (filtered.length === 0) return null

  const occupiedCount = filtered.filter((ac) => ac.state === 'occupied').length
  const clearCount = filtered.filter((ac) => ac.state === 'clear').length
  const resetCount = filtered.filter((ac) => ac.state === 'reset_required' || ac.state === 'failed').length

  return (
    <div className="bg-[#0a0e1a] border border-slate-700/60 rounded-xl overflow-hidden flex flex-col shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-400 tracking-widest uppercase">
            {station || 'All Sections'} — Axle Counters (MSDAC / Track Circuits)
          </span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-emerald-400 font-bold">{clearCount} CLR</span>
          <span className="text-slate-600">|</span>
          <span className="text-rose-400 font-bold">{occupiedCount} OCC</span>
          {resetCount > 0 && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-amber-400 font-bold">{resetCount} RST</span>
            </>
          )}
        </div>
      </div>

      {/* Grid of Axle Counters */}
      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-y-auto max-h-[280px]">
        {filtered.map((ac) => {
          const isOcc = ac.state === 'occupied'
          const isRst = ac.state === 'reset_required' || ac.state === 'failed'

          return (
            <div
              key={ac.id}
              className={`px-2.5 py-2 rounded border font-mono transition-all duration-300 ${
                isOcc
                  ? 'bg-rose-950/25 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.15)]'
                  : isRst
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-900/90 border-slate-700/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full ${isOcc ? 'bg-rose-500 animate-pulse' : isRst ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-bold text-slate-200 truncate">{ac.id}</span>
                </div>
                <span
                  className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    isOcc
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isRst
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isOcc ? 'OCCUPIED' : isRst ? 'RESET REQ' : 'CLEAR'}
                </span>
              </div>

              <div className="text-[9px] text-slate-400 mt-1 truncate">
                {ac.section_label}
              </div>

              {/* Status details: counts & train */}
              <div className="flex items-center justify-between text-[8px] text-slate-400 mt-1.5 pt-1 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <span>IN: <strong className="text-slate-200">{ac.count_in}</strong></span>
                  <span>OUT: <strong className="text-slate-200">{ac.count_out}</strong></span>
                </div>
                {ac.train_id && (
                  <span className="text-rose-400 font-bold truncate max-w-[120px]">
                    TRAIN: {ac.train_id}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
