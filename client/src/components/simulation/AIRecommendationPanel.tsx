import React, { useState } from 'react'
import {
  Brain,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import {
  AIRecommendation,
  ConflictTrainInput,
  getRecommendation,
  decideRecommendation,
} from '../../services/aiService'

interface Props {
  /** Optional preset conflict to run immediately (used by Demo Mode). */
  conflictTrains?: ConflictTrainInput[]
  automaticAnalysis?: {
    conflictTrains: ConflictTrainInput[]
    recommendations: AIRecommendation[]
    recommendationId?: string
    runtimeSec?: number
  } | null
  onDecision?: (decision: 'approved' | 'rejected', recommendation: AIRecommendation) => void
}

const severityColor = (safe: boolean) =>
  safe
    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
    : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'

export const AIRecommendationPanel: React.FC<Props> = ({ conflictTrains, automaticAnalysis, onDecision }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendationId, setRecommendationId] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [runtimeSec, setRuntimeSec] = useState<number | null>(null)
  const [expandedAlt, setExpandedAlt] = useState(false)
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null)

  const runRecommendation = async (trains: ConflictTrainInput[]) => {
    setLoading(true)
    setError(null)
    setDecided(null)
    try {
      const res = await getRecommendation(trains)
      setRecommendationId(res.saved_recommendation_id || res.recommendation_id)
      setRecommendations(res.recommendations)
      setRuntimeSec(res.runtime_sec)
    } catch (e: any) {
      setError(
        e?.response?.data?.error ||
          e?.message ||
          'AI service unavailable. Ensure ai-service is running on port 8001.'
      )
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (automaticAnalysis?.recommendations?.length) {
      setRecommendationId(automaticAnalysis.recommendationId || null)
      setRecommendations(automaticAnalysis.recommendations)
      setRuntimeSec(automaticAnalysis.runtimeSec ?? null)
      setError(null)
      return
    }
    if (conflictTrains && conflictTrains.length > 0) {
      runRecommendation(conflictTrains)
    }
  }, [automaticAnalysis, conflictTrains])

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!recommendationId) return
    try {
      await decideRecommendation(recommendationId, decision)
      setDecided(decision)
      if (onDecision && recommendations[0]) onDecision(decision, recommendations[0])
    } catch (e: any) {
      setError(e?.message || 'Failed to record decision')
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Running optimizer + safety validator...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-red-200 dark:border-red-700 p-3 text-xs text-red-600 dark:text-red-400">
        {error}
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          AI Traffic Recommendation
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No active conflict requiring a recommendation.
        </p>
      </div>
    )
  }

  const top = recommendations[0]
  const alternatives = recommendations.slice(1)

  return (
    <div className={`rounded border p-3 ${severityColor(top.safety_status === 'PASS')}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          AI TRAFFIC RECOMMENDATION
        </h3>
        {runtimeSec !== null && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            optimized in {runtimeSec.toFixed(2)}s
          </span>
        )}
      </div>

      <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
        <span className="font-medium">CONFLICT:</span>{' '}
        {top.trains_involved.join(' \u2194 ')}
      </div>

      {top.conflict?.location && (
        <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
          <span className="font-medium">LOCATION:</span> {top.conflict.location}
        </div>
      )}

      <div className="text-xs text-gray-700 dark:text-gray-300 mb-2">
        <span className="font-medium">RECOMMENDED ACTION:</span> {top.label}
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 italic">{top.why_this_recommendation}</div>

      <div className="mb-2 rounded bg-white/60 dark:bg-slate-900/30 p-2 text-xs">
        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">AI PREDICTION</div>
        <div className="text-gray-700 dark:text-gray-300">
          {Object.entries(top.predicted_delay_by_train).map(([trainId, delay]) => (
            <span key={trainId} className="mr-2">
              {trainId}: +{Number(delay).toFixed(1)} min
            </span>
          ))}
        </div>
      </div>

      <div className="mb-2 rounded bg-white/60 dark:bg-slate-900/30 p-2 text-xs">
        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400">DESTINATION IMPACT</div>
        <div className="text-gray-700 dark:text-gray-300 space-y-0.5">
          {Object.entries(top.expected_impact.per_train).map(([trainId, impact]) => (
            <div key={trainId}>
              {trainId}: +{Number(impact.predicted_destination_delay_min || 0).toFixed(1)} min predicted destination delay
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="bg-white/60 dark:bg-slate-900/30 rounded p-2">
          <div className="text-gray-500 dark:text-gray-400 text-[10px]">Weighted delay impact</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {top.expected_impact.total_weighted_delay_min.toFixed(1)} min
          </div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/30 rounded p-2">
          <div className="text-gray-500 dark:text-gray-400 text-[10px]">Recommendation score</div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {Math.round(top.recommendation_score * 100)}%
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs mb-3">
        {top.safety_status === 'PASS' ? (
          <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        )}
        <span
          className={
            top.safety_status === 'PASS'
              ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }
        >
          {top.safety_explanation}
        </span>
      </div>

      {alternatives.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setExpandedAlt(!expandedAlt)}
            className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1"
          >
            {expandedAlt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            View {alternatives.length} alternative{alternatives.length > 1 ? 's' : ''}
          </button>
          {expandedAlt && (
            <div className="mt-2 space-y-1.5">
              {alternatives.map((alt) => (
                <div
                  key={alt.rank}
                  className="text-[11px] bg-white/60 dark:bg-slate-900/30 rounded p-2 flex justify-between items-center"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {alt.rank}. {alt.label}
                  </span>
                  <span
                    className={
                      alt.safety_status === 'PASS'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {alt.expected_impact.total_weighted_delay_min.toFixed(1)}m /{' '}
                    {alt.safety_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {decided ? (
        <div
          className={`text-xs font-medium flex items-center gap-1.5 ${
            decided === 'approved'
              ? 'text-green-700 dark:text-green-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {decided === 'approved' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Controller {decided} this recommendation.
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handleDecision('approved')}
            disabled={top.safety_status !== 'PASS'}
            className="flex-1 text-xs font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded px-2 py-1.5 flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> APPROVE
          </button>
          <button
            onClick={() => handleDecision('rejected')}
            className="flex-1 text-xs font-medium bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded px-2 py-1.5 flex items-center justify-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" /> REJECT
          </button>
        </div>
      )}

      <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
        If rejected: {top.if_rejected}
      </div>
    </div>
  )
}
