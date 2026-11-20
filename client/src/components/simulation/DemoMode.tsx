import React, { useState } from 'react'
import { PlayCircle, AlertTriangle, TrainFront, Ban } from 'lucide-react'
import { ConflictTrainInput, WhatIfTrainInput, runWhatIf, requestOverride } from '../../services/aiService'
import { AIRecommendationPanel } from './AIRecommendationPanel'
import { KPIDashboard } from './KPIDashboard'

/**
 * "Hackathon Demo Mode" (SIH25022 requirement, section 35).
 * Each button loads a pre-built, documented scenario (SIMULATED train
 * requests, not live telemetry) and runs it through the real AI
 * pipeline: /ai/recommend (conflict -> optimize -> safety -> rank) and
 * /ai/what-if (baseline vs optimizer comparison with real numbers).
 */

interface Scenario {
  id: string
  label: string
  icon: React.ReactNode
  conflictTrains: ConflictTrainInput[]
  whatIfTrains: WhatIfTrainInput[]
}

const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    label: 'Normal Traffic',
    icon: <TrainFront className="w-4 h-4" />,
    conflictTrains: [
      { train_id: 'T101', resource_id: 'DADAR-JN', priority: 3, requested_entry_sec: 60, transit_seconds: 90 },
    ],
    whatIfTrains: [
      { train_id: 'T101', resource_id: 'DADAR-JN', priority: 3, requested_entry_sec: 60, transit_seconds: 90 },
    ],
  },
  {
    id: 'express_delay',
    label: 'Express Delayed 10 min',
    icon: <TrainFront className="w-4 h-4" />,
    conflictTrains: [
      {
        train_id: 'T102', resource_id: 'DADAR-JN', priority: 1, requested_entry_sec: 60, transit_seconds: 90,
        prediction: {
          current_delay_min: 10,
          train_type: 'fast',
          current_speed_kmh: 18,
          previous_speed_kmh: 42,
          section_occupancy: 0.8,
          trains_ahead: 3,
          disruption_active: true,
        },
      },
      { train_id: 'T205', resource_id: 'DADAR-JN', priority: 3, requested_entry_sec: 90, transit_seconds: 90 },
    ],
    whatIfTrains: [
      { train_id: 'T102', resource_id: 'DADAR-JN', priority: 1, requested_entry_sec: 60, transit_seconds: 90 },
      { train_id: 'T205', resource_id: 'DADAR-JN', priority: 3, requested_entry_sec: 90, transit_seconds: 90 },
    ],
  },
  {
    id: 'junction_conflict',
    label: 'Two Trains, Same Junction',
    icon: <AlertTriangle className="w-4 h-4" />,
    conflictTrains: [
      {
        train_id: 'T102', resource_id: 'KURLA-JN', priority: 1, requested_entry_sec: 30, transit_seconds: 100,
        prediction: {
          current_delay_min: 7,
          train_type: 'fast',
          current_speed_kmh: 24,
          previous_speed_kmh: 48,
          section_occupancy: 0.65,
          trains_ahead: 2,
          disruption_active: true,
        },
      },
      { train_id: 'T310', resource_id: 'KURLA-JN', priority: 2, requested_entry_sec: 60, transit_seconds: 100 },
    ],
    whatIfTrains: [
      { train_id: 'T102', resource_id: 'KURLA-JN', priority: 1, requested_entry_sec: 30, transit_seconds: 100 },
      { train_id: 'T310', resource_id: 'KURLA-JN', priority: 2, requested_entry_sec: 60, transit_seconds: 100 },
    ],
  },
  {
    id: 'congestion',
    label: 'Heavy Congestion (4 trains)',
    icon: <AlertTriangle className="w-4 h-4" />,
    conflictTrains: [
      { train_id: 'T401', resource_id: 'THANE-JN', priority: 2, requested_entry_sec: 0, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'T402', resource_id: 'THANE-JN', priority: 4, requested_entry_sec: 20, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'T403', resource_id: 'THANE-JN', priority: 1, requested_entry_sec: 40, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'T404', resource_id: 'THANE-JN', priority: 5, requested_entry_sec: 60, transit_seconds: 90, max_hold_seconds: 1200 },
    ],
    whatIfTrains: [
      { train_id: 'T401', resource_id: 'THANE-JN', priority: 2, requested_entry_sec: 0, transit_seconds: 90 },
      { train_id: 'T402', resource_id: 'THANE-JN', priority: 4, requested_entry_sec: 20, transit_seconds: 90 },
      { train_id: 'T403', resource_id: 'THANE-JN', priority: 1, requested_entry_sec: 40, transit_seconds: 90 },
      { train_id: 'T404', resource_id: 'THANE-JN', priority: 5, requested_entry_sec: 60, transit_seconds: 90 },
    ],
  },
  {
    id: 'secr_raipur_vande_bharat',
    label: 'SECR: VB vs Freight (Raipur Jn)',
    icon: <TrainFront className="w-4 h-4 text-amber-500" />,
    conflictTrains: [
      {
        train_id: 'SECR_VB_20825', resource_id: 'RAIPUR-JN', priority: 1, requested_entry_sec: 45, transit_seconds: 90,
        prediction: {
          current_delay_min: 8,
          train_type: 'fast',
          current_speed_kmh: 75,
          previous_speed_kmh: 110,
          section_occupancy: 0.7,
          trains_ahead: 1,
          disruption_active: true,
        },
      },
      { train_id: 'SECR_COAL_501', resource_id: 'RAIPUR-JN', priority: 4, requested_entry_sec: 60, transit_seconds: 120 },
    ],
    whatIfTrains: [
      { train_id: 'SECR_VB_20825', resource_id: 'RAIPUR-JN', priority: 1, requested_entry_sec: 45, transit_seconds: 90 },
      { train_id: 'SECR_COAL_501', resource_id: 'RAIPUR-JN', priority: 4, requested_entry_sec: 60, transit_seconds: 120 },
    ],
  },
  {
    id: 'secr_bhilai_congestion',
    label: 'SECR: Bhilai Steel Congestion (4 trains)',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    conflictTrains: [
      { train_id: 'SECR_VB_20825', resource_id: 'BPHB-JN', priority: 1, requested_entry_sec: 0, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'SECR_INT_12855', resource_id: 'BPHB-JN', priority: 2, requested_entry_sec: 30, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'SECR_MEMU_08701', resource_id: 'BPHB-JN', priority: 3, requested_entry_sec: 50, transit_seconds: 90, max_hold_seconds: 1200 },
      { train_id: 'SECR_STEEL_BFNS', resource_id: 'BPHB-JN', priority: 5, requested_entry_sec: 75, transit_seconds: 120, max_hold_seconds: 1200 },
    ],
    whatIfTrains: [
      { train_id: 'SECR_VB_20825', resource_id: 'BPHB-JN', priority: 1, requested_entry_sec: 0, transit_seconds: 90 },
      { train_id: 'SECR_INT_12855', resource_id: 'BPHB-JN', priority: 2, requested_entry_sec: 30, transit_seconds: 90 },
      { train_id: 'SECR_MEMU_08701', resource_id: 'BPHB-JN', priority: 3, requested_entry_sec: 50, transit_seconds: 90 },
      { train_id: 'SECR_STEEL_BFNS', resource_id: 'BPHB-JN', priority: 5, requested_entry_sec: 75, transit_seconds: 120 },
    ],
  },
]

export const DemoMode: React.FC = () => {
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null)
  const [whatIfResult, setWhatIfResult] = useState<any>(null)
  const [unsafeDemo, setUnsafeDemo] = useState<{ allowed: boolean; reasons: string[] } | null>(null)

  const runScenario = async (scenario: Scenario) => {
    setActiveScenario(scenario)
    setWhatIfResult(null)
    setUnsafeDemo(null)
    try {
      const wi = await runWhatIf(
        scenario.id,
        scenario.whatIfTrains.map((train) => ({
          ...train,
          prediction: scenario.conflictTrains.find(
            (conflictTrain) => conflictTrain.train_id === train.train_id
          )?.prediction,
        }))
      )
      setWhatIfResult(wi)
    } catch (e) {
      // Recommendation panel will surface the AI-service-offline error separately.
    }
  }

  const runUnsafeOverrideDemo = async (targetStation: 'Dadar' | 'Raipur' = 'Dadar') => {
    setActiveScenario(null)
    const isRaipur = targetStation === 'Raipur'
    const result = await requestOverride({
      plans: [
        {
          train_id: isRaipur ? 'SECR_VB_20825' : 'T099',
          section_id: isRaipur ? 'RAIPUR_P1' : 'S18',
          enters_at_sec: 0,
          exits_at_sec: 200,
          planned_speed_kmh: 60,
          direction: 'up',
        },
        {
          train_id: isRaipur ? 'SECR_COAL_501' : 'T205',
          section_id: isRaipur ? 'RAIPUR_P1' : 'S18',
          enters_at_sec: 20,
          exits_at_sec: 220,
          planned_speed_kmh: 60,
          direction: 'up',
        },
      ],
      reason: isRaipur
        ? 'Demo: controller attempts to force Coal Rake into occupied Platform 1 of Raipur Junction'
        : 'Demo: controller manually forces T205 into an occupied sector',
    })
    setUnsafeDemo({ allowed: result.override_allowed, reasons: result.reasons })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3 space-y-3">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <PlayCircle className="w-3.5 h-3.5" />
        Hackathon Demo Mode
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => runScenario(s)}
            className={`text-[11px] flex items-center gap-1.5 rounded px-2 py-1.5 border transition-colors ${
              activeScenario?.id === s.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600'
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => runUnsafeOverrideDemo('Raipur')}
          className="text-[11px] flex items-center justify-center gap-1.5 rounded px-2 py-1.5 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <Ban className="w-3.5 h-3.5 text-amber-600" /> Unsafe Override: Raipur Jn (P1)
        </button>
        <button
          onClick={() => runUnsafeOverrideDemo('Dadar')}
          className="text-[11px] flex items-center justify-center gap-1.5 rounded px-2 py-1.5 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40"
        >
          <Ban className="w-3.5 h-3.5" /> Unsafe Override: Dadar (S18)
        </button>
      </div>

      {unsafeDemo && (
        <div className="text-[11px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2 text-red-700 dark:text-red-400">
          <div className="font-semibold mb-1">
            Override {unsafeDemo.allowed ? 'ALLOWED' : 'BLOCKED'} by safety validator
          </div>
          {unsafeDemo.reasons.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>
      )}

      {activeScenario && (
        <div className="space-y-3">
          <AIRecommendationPanel conflictTrains={activeScenario.conflictTrains} />
          <KPIDashboard lastWhatIf={whatIfResult} />
        </div>
      )}
    </div>
  )
}
