import React from 'react'
import { SignalAspect } from '../../../services/vduService'
import { Radio } from 'lucide-react'

interface Props {
  signals: SignalAspect[]
  station?: string
}

export const SignalAspectPanel: React.FC<Props> = ({ signals, station }) => {
  const filtered = station ? signals.filter((s) => s.station === station) : signals

  if (filtered.length === 0) return null

  return (
    <div className="bg-[#0a0e1a] border border-slate-700/60 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-[11px] font-bold text-yellow-400 tracking-widest uppercase">
            {station || 'All Signals'} — Colour Light Signals (MACLS)
          </span>
        </div>
        <div className="text-[9px] font-mono text-slate-400">
          AUTO NX INTERLOCKING
        </div>
      </div>

      {/* Grid of signals */}
      <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 overflow-y-auto max-h-[280px]">
        {filtered.map((sig) => {
          const isGreen = sig.aspect === 'green'
          const isYellow = sig.aspect === 'yellow'
          const isDblYellow = sig.aspect === 'double_yellow'
          const isRed = sig.aspect === 'red'

          return (
            <div
              key={sig.id}
              className="bg-slate-900/90 border border-slate-700/60 rounded p-2 flex flex-col justify-between font-mono hover:border-slate-500 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white tracking-wider">{sig.id}</span>
                <span className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded border border-slate-700">
                  {sig.direction.toUpperCase()}
                </span>
              </div>

              <div className="text-[8px] text-slate-400 truncate mt-0.5" title={sig.label}>
                {sig.label.split('(')[0] || sig.label}
              </div>

              {/* Physical Signal Head Representation */}
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800">
                {/* 3 or 4 aspect lens post */}
                <div className="bg-black/90 p-1 rounded-full flex gap-1 border border-slate-700 shadow-inner">
                  {/* Green lens */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isGreen
                        ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                        : 'bg-emerald-950/60 opacity-30'
                    }`}
                  />
                  {/* Yellow lens */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isYellow || isDblYellow
                        ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                        : 'bg-amber-950/60 opacity-30'
                    }`}
                  />
                  {/* Red lens */}
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isRed
                        ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                        : 'bg-rose-950/60 opacity-30'
                    }`}
                  />
                </div>

                {/* Aspect Text */}
                <div className="text-right">
                  <div
                    className={`text-[9px] font-extrabold uppercase ${
                      isGreen
                        ? 'text-emerald-400'
                        : isYellow || isDblYellow
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {sig.aspect}
                  </div>
                  {sig.speed_kmh ? (
                    <div className="text-[8px] text-slate-400">{sig.speed_kmh} km/h</div>
                  ) : (
                    <div className="text-[8px] text-rose-500/80 font-bold">STOP</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
