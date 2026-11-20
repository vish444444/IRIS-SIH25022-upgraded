import React from 'react'
import { PlatformState } from '../../../services/vduService'
import { Train, Clock } from 'lucide-react'

interface Props {
  platforms: PlatformState[]
  station?: string
}

const stateConfig = {
  clear:    { bg: 'bg-emerald-500/10 border-emerald-500/40', dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'CLEAR' },
  occupied: { bg: 'bg-rose-500/15 border-rose-500/50',       dot: 'bg-rose-400 animate-pulse', text: 'text-rose-400', label: 'OCC' },
  reserved: { bg: 'bg-amber-500/10 border-amber-500/40',     dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'RSVD' },
  blocked:  { bg: 'bg-red-900/20 border-red-700/50',         dot: 'bg-red-600', text: 'text-red-500', label: 'BLK' },
}

const lineTypeColor = {
  main:  'text-blue-400',
  loop:  'text-amber-400',
  goods: 'text-orange-400',
}

export const PlatformStatusBoard: React.FC<Props> = ({ platforms, station }) => {
  const filtered = station ? platforms.filter((p) => p.station === station) : platforms

  if (filtered.length === 0) return null

  const occupiedCount = filtered.filter((p) => p.state === 'occupied').length

  return (
    <div className="bg-[#0a0e1a] border border-slate-700/60 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Train className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-amber-400 tracking-widest uppercase">
            {station || 'All Platforms'} — Platform Status
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
            {occupiedCount}/{filtered.length} Occupied
          </span>
          <span className="text-[8px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono">
            ⚠ SIMULATED
          </span>
        </div>
      </div>

      {/* Platform rows */}
      <div className="divide-y divide-slate-800/60">
        {filtered.map((pf) => {
          const cfg = stateConfig[pf.state]
          return (
            <div
              key={pf.id}
              className={`flex items-center gap-3 px-3 py-2 ${cfg.bg} border-l-2 ${pf.state === 'occupied' ? 'border-l-rose-500' : pf.state === 'reserved' ? 'border-l-amber-500' : 'border-l-transparent'} transition-all duration-500`}
            >
              {/* Platform number badge */}
              <div className="flex-shrink-0 w-7 h-7 rounded bg-slate-800 border border-slate-600 flex items-center justify-center">
                <span className="text-[11px] font-extrabold font-mono text-slate-200">
                  {pf.number}
                </span>
              </div>

              {/* Platform info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold ${lineTypeColor[pf.line_type]}`}>
                    {pf.name}
                  </span>
                  <span className="text-[8px] text-slate-500 font-mono">{pf.length_m}m</span>
                </div>
                {pf.occupied_by && (
                  <div className="text-[11px] font-mono font-bold text-rose-300 mt-0.5">
                    ▶ {pf.occupied_by}
                  </div>
                )}
                {pf.reserved_for && pf.state === 'reserved' && (
                  <div className="text-[10px] font-mono text-amber-300/80 mt-0.5">
                    <Clock className="inline w-2.5 h-2.5 mr-0.5" />
                    Reserved: {pf.reserved_for}
                    {pf.eta_min && ` (ETA ${pf.eta_min}min)`}
                  </div>
                )}
              </div>

              {/* State indicator */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className={`text-[9px] font-bold font-mono tracking-wider ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
