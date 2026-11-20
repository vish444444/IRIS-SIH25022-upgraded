import React, { useState } from 'react'
import { PointMachine } from '../../../services/vduService'
import { GitBranch, AlertTriangle, CheckCircle, Wrench } from 'lucide-react'

interface Props {
  pointMachines: PointMachine[]
  station?: string
}

export const PointMachinePanel: React.FC<Props> = ({ pointMachines, station }) => {
  const [filter, setFilter] = useState<'all' | 'normal' | 'reverse' | 'fault'>('all')

  const filteredByStation = station
    ? pointMachines.filter((pm) => pm.station === station)
    : pointMachines

  const displayed = filteredByStation.filter((pm) => {
    if (filter === 'normal') return pm.position === 'Normal' && pm.status === 'healthy'
    if (filter === 'reverse') return pm.position === 'Reverse' && pm.status === 'healthy'
    if (filter === 'fault') return pm.status === 'fault' || pm.status === 'under_maintenance'
    return true
  })

  const normalCount = filteredByStation.filter((p) => p.position === 'Normal' && p.status === 'healthy').length
  const reverseCount = filteredByStation.filter((p) => p.position === 'Reverse' && p.status === 'healthy').length
  const faultCount = filteredByStation.filter((p) => p.status === 'fault' || p.status === 'under_maintenance').length

  return (
    <div className="bg-[#0a0e1a] border border-slate-700/60 rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-bold text-blue-400 tracking-widest uppercase">
            {station || 'All Stations'} — Point Machines (Turnouts)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] font-mono">
          <button
            onClick={() => setFilter('all')}
            className={`px-1.5 py-0.5 rounded ${filter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            ALL ({filteredByStation.length})
          </button>
          <button
            onClick={() => setFilter('normal')}
            className={`px-1.5 py-0.5 rounded ${filter === 'normal' ? 'bg-blue-600/30 text-blue-300 font-bold' : 'text-slate-400 hover:text-blue-300'}`}
          >
            NORM ({normalCount})
          </button>
          <button
            onClick={() => setFilter('reverse')}
            className={`px-1.5 py-0.5 rounded ${filter === 'reverse' ? 'bg-amber-600/30 text-amber-300 font-bold' : 'text-slate-400 hover:text-amber-300'}`}
          >
            REV ({reverseCount})
          </button>
          {faultCount > 0 && (
            <button
              onClick={() => setFilter('fault')}
              className={`px-1.5 py-0.5 rounded ${filter === 'fault' ? 'bg-rose-600/30 text-rose-300 font-bold' : 'text-rose-400 hover:text-rose-200'}`}
            >
              FAULT ({faultCount})
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 overflow-y-auto max-h-[280px]">
        {displayed.map((pm) => {
          const isReverse = pm.position === 'Reverse'
          const isFault = pm.status === 'fault'
          const isMaint = pm.status === 'under_maintenance'

          return (
            <div
              key={pm.id}
              className={`px-2 py-1.5 rounded border text-[10px] font-mono flex items-center justify-between transition-all ${
                isFault
                  ? 'bg-rose-950/30 border-rose-600/60 text-rose-300'
                  : isMaint
                  ? 'bg-amber-950/20 border-amber-600/40 text-amber-300'
                  : isReverse
                  ? 'bg-slate-900 border-amber-500/40 text-slate-200'
                  : 'bg-slate-900 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white tracking-wider">{pm.id}</span>
                  <span className="text-[8px] text-slate-400 truncate max-w-[120px]">{pm.label.split('—')[1] || pm.label}</span>
                </div>
                <div className="text-[8px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>DETECTION:</span>
                  <span className={pm.detection === 'detected' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {pm.detection === 'detected' ? 'KR PROVED' : 'OUT OF CORR'}
                  </span>
                </div>
              </div>

              {/* Status and Position badge */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isMaint ? (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Wrench className="w-2.5 h-2.5" />
                    MAINT
                  </span>
                ) : isFault ? (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    FAULT
                  </span>
                ) : (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      isReverse
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                        : 'bg-blue-500/20 border-blue-400/50 text-blue-300'
                    }`}
                  >
                    {isReverse ? 'REV (R)' : 'NORM (N)'}
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
