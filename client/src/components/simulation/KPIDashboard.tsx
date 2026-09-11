import React, { useEffect, useState } from 'react'
import { Activity, Gauge, ListChecks, Cpu } from 'lucide-react'
import { getAIStatus, AIStatus } from '../../services/aiService'

/**
 * KPI Dashboard. Every number here is either:
 *  - read live from the AI service's /ai/status (recommendations_logged,
 *    optimization_runs_logged, model_metrics), or
 *  - passed in from a completed /ai/what-if run (see DemoMode.tsx)
 * Nothing here is a fabricated/hardcoded metric.
 */
interface Props {
  lastWhatIf?: {
    scenario_name: string
    baseline: {
      total_delay_sec: number
      average_delay_sec: number
      total_weighted_delay_sec: number
      conflicts: number
      affected_trains: number
      recovery_time_sec: number
      throughput_trains_per_hour: number
    }
    ai_optimized: {
      total_delay_sec: number
      average_delay_sec: number
      total_weighted_delay_sec: number
      conflicts: number
      affected_trains: number
      recovery_time_sec: number
      optimization_runtime_sec: number
      throughput_trains_per_hour: number
    }
    weighted_delay_improvement_pct: number
  } | null
}

export const KPIDashboard: React.FC<Props> = ({ lastWhatIf }) => {
  const [status, setStatus] = useState<AIStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const s = await getAIStatus()
        if (!cancelled) {
          setStatus(s)
          setError(null)
        }
      } catch (e: any) {
        if (!cancelled) setError('AI service offline')
      }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <Gauge className="w-3.5 h-3.5" />
        AI / KPI Dashboard
      </h3>

      {error && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px]">
            <ListChecks className="w-3 h-3" /> Recommendations issued
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {status?.recommendations_logged ?? '—'}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded p-2">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-[10px]">
            <Cpu className="w-3 h-3" /> Optimization runs
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {status?.optimization_runs_logged ?? '—'}
          </div>
        </div>
      </div>

      {status?.model_metrics && (
        <div className="mb-3">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
            Delay model ({status.model_metrics.model_type}) — trained on SYNTHETIC data
          </div>
          <div className="flex gap-2 text-[11px]">
            <span className="bg-gray-50 dark:bg-slate-700 rounded px-2 py-1">
              MAE {status.model_metrics.MAE_minutes}m
            </span>
            <span className="bg-gray-50 dark:bg-slate-700 rounded px-2 py-1">
              RMSE {status.model_metrics.RMSE_minutes}m
            </span>
            <span className="bg-gray-50 dark:bg-slate-700 rounded px-2 py-1">
              R² {status.model_metrics.R2}
            </span>
          </div>
        </div>
      )}

      {lastWhatIf && (
        <div className="border-t border-gray-200 dark:border-slate-700 pt-2">
          <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Last scenario: {lastWhatIf.scenario_name}
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-gray-400 dark:text-gray-500">
                <th className="text-left font-normal"></th>
                <th className="text-right font-normal">Total delay</th>
                <th className="text-right font-normal">Weighted delay</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-gray-600 dark:text-gray-300">Baseline (FCFS)</td>
                <td className="text-right text-gray-900 dark:text-gray-100">
                  {(lastWhatIf.baseline.total_delay_sec / 60).toFixed(1)}m
                </td>
                <td className="text-right text-gray-900 dark:text-gray-100">
                  {(lastWhatIf.baseline.total_weighted_delay_sec / 60).toFixed(1)}m
                </td>
              </tr>
              <tr>
                <td className="text-gray-600 dark:text-gray-300">AI Optimized</td>
                <td className="text-right text-green-700 dark:text-green-400 font-medium">
                  {(lastWhatIf.ai_optimized.total_delay_sec / 60).toFixed(1)}m
                </td>
                <td className="text-right text-green-700 dark:text-green-400 font-medium">
                  {(lastWhatIf.ai_optimized.total_weighted_delay_sec / 60).toFixed(1)}m
                </td>
              </tr>
            </tbody>
          </table>
          <div className="text-[11px] text-green-700 dark:text-green-400 font-medium mt-1">
            {lastWhatIf.weighted_delay_improvement_pct}% weighted-delay improvement vs baseline
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Conflicts: {lastWhatIf.ai_optimized.conflicts}</span>
            <span>Affected trains: {lastWhatIf.ai_optimized.affected_trains}</span>
            <span>Recovery: {(lastWhatIf.ai_optimized.recovery_time_sec / 60).toFixed(1)}m</span>
            <span>Optimizer: {lastWhatIf.ai_optimized.optimization_runtime_sec.toFixed(2)}s</span>
          </div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            Throughput: {lastWhatIf.ai_optimized.throughput_trains_per_hour}/hr (fixed cohort; delay changed, train count did not)
          </div>
        </div>
      )}
    </div>
  )
}
