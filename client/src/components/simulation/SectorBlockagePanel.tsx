import React, { useState, useEffect, useRef } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { AlertTriangle, X, Brain, ShieldCheck, Loader2 } from 'lucide-react'
import { SectorBlockage } from '../../types/simulation.types'
import { getRecommendation, type AIRecommendation } from '../../services/aiService'
import {
  reportSectorBlockage,
  getBlockedSectors,
  removeBlockage,
  getSectors,
  type SectorInfo,
  type SectorBlockageRequest,
} from '../../services/sectorBlockageService'

interface SectorBlockagePanelProps {
  onSectorClick?: (sectorId: string) => void
}

export const SectorBlockagePanel: React.FC<SectorBlockagePanelProps> = ({
  onSectorClick,
}) => {
  const { trains } = useSimulation()
  const [blockages, setBlockages] = useState<SectorBlockage[]>([])
  const [sectors, setSectors] = useState<SectorInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSectors, setLoadingSectors] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    sector_id: '',
    reason: '',
  })
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [analyses, setAnalyses] = useState<Record<string, AIRecommendation[]>>({})
  const [analysingSector, setAnalysingSector] = useState<string | null>(null)
  const automaticBlockageAnalyses = useRef(new Set<string>())

  useEffect(() => {
    fetchSectors()
    fetchBlockages()
    const interval = setInterval(fetchBlockages, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchSectors = async () => {
    try {
      setLoadingSectors(true)
      const data = await getSectors()
      setSectors(data || [])
    } catch (error) {
      console.error('Failed to fetch sectors:', error)
      setMessage({ text: 'Failed to load sector list', type: 'error' })
    } finally {
      setLoadingSectors(false)
    }
  }

  const fetchBlockages = async () => {
    try {
      const data = await getBlockedSectors()
      setBlockages(data || [])
    } catch (error) {
      console.error('Failed to fetch blockages:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const request: SectorBlockageRequest = {
        sector_id: formData.sector_id,
        status: 'blocked',
        reason: formData.reason.trim() || undefined,
      }

      await reportSectorBlockage(request)
      setMessage({ text: 'Sector blockage reported successfully', type: 'success' })
      setShowForm(false)
      setFormData({
        sector_id: '',
        reason: '',
      })
      fetchBlockages()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || 'Failed to report sector blockage',
        type: 'error',
      })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (sectorId: string) => {
    try {
      await removeBlockage(sectorId)
      fetchBlockages()
    } catch (error) {
      console.error('Failed to remove blockage:', error)
      setMessage({ text: 'Failed to remove blockage', type: 'error' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const getAffectedTrains = (sectorId: string) =>
    Array.from(trains.values()).filter(
      (train) => train.currentPipeline === sectorId || train.nextPipeline === sectorId
    )

  const analyseBlockage = async (sectorId: string) => {
    const affectedTrains = getAffectedTrains(sectorId)
    if (affectedTrains.length === 0) {
      setMessage({ text: 'No live trains are currently assigned to this sector', type: 'error' })
      return
    }

    setAnalysingSector(sectorId)
    try {
      const response = await getRecommendation(
        affectedTrains.map((train, index) => ({
          train_id: train.id,
          resource_id: sectorId,
          priority: index + 1,
          requested_entry_sec: index * 30,
          transit_seconds: 90,
          prediction: {
            current_delay_min: train.delay || 0,
            current_speed_kmh: train.gps?.speed || train.speed || 0,
            section_occupancy: 1,
            trains_ahead: index,
            disruption_active: true,
          },
        })),
        { blockedSectors: [sectorId] }
      )
      setAnalyses((previous) => ({ ...previous, [sectorId]: response.recommendations }))
    } catch (error) {
      console.error('Failed to analyse sector blockage:', error)
      setMessage({ text: 'Unable to run blockage analysis. Check the AI service.', type: 'error' })
    } finally {
      setAnalysingSector(null)
    }
  }

  useEffect(() => {
    blockages.forEach((blockage) => {
      const affectedTrains = getAffectedTrains(blockage.sector_id)
      if (
        affectedTrains.length > 0 &&
        !analyses[blockage.sector_id] &&
        !automaticBlockageAnalyses.current.has(blockage.sector_id)
      ) {
        automaticBlockageAnalyses.current.add(blockage.sector_id)
        void analyseBlockage(blockage.sector_id)
      }
    })
  // The guarded sector set prevents repeated recommendations while this panel polls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockages, trains])

  const filteredSectors = sectors.filter((sector) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      sector.sector_id.toLowerCase().includes(search) ||
      sector.from_station.toLowerCase().includes(search) ||
      sector.to_station.toLowerCase().includes(search) ||
      sector.track_type.toLowerCase().includes(search)
    )
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Sector Blockages
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Report'}
        </button>
      </div>

      {message && (
        <div
          className={`mb-3 p-2 rounded text-xs border ${
            message.type === 'error'
              ? 'bg-red-50/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-emerald-50/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-3 space-y-2 p-2 bg-gray-50 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search Sector
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by sector ID, station, or track type..."
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs mb-2"
            />
            <select
              value={formData.sector_id}
              onChange={(e) => setFormData({ ...formData, sector_id: e.target.value })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              required
              disabled={loadingSectors}
            >
              <option value="">
                {loadingSectors ? 'Loading sectors...' : 'Select sector'}
              </option>
              {filteredSectors.slice(0, 100).map((sector) => (
                <option key={sector.sector_id} value={sector.sector_id}>
                  {sector.sector_id} ({sector.from_station} → {sector.to_station}, {sector.track_type})
                </option>
              ))}
            </select>
            {filteredSectors.length > 100 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Showing first 100 results. Use search to narrow down.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason (optional)
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              placeholder="e.g., Maintenance work"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.sector_id}
            className="w-full px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {blockages.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No active sector blockages
          </div>
        ) : (
          blockages.map((blockage) => {
            const sectorInfo = sectors.find((s) => s.sector_id === blockage.sector_id)
            const affectedTrains = getAffectedTrains(blockage.sector_id)
            const recommendations = analyses[blockage.sector_id]
            const bestPlan = recommendations?.[0]
            return (
              <div
                key={blockage.id}
                className="bg-red-50 dark:bg-red-900/30 rounded p-2 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                onClick={() => {
                  if (onSectorClick) {
                    onSectorClick(blockage.sector_id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-red-800 dark:text-red-200 font-mono">
                        {blockage.sector_id}
                      </span>
                    </div>
                    <div className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                      {sectorInfo && (
                        <div>
                          {sectorInfo.from_station} → {sectorInfo.to_station} • {sectorInfo.track_type}
                        </div>
                      )}
                      {blockage.reason && (
                        <div className="text-red-600 dark:text-red-400 italic">
                          {blockage.reason}
                        </div>
                      )}
                      <div className="text-red-500 dark:text-red-500/70 text-[10px]">
                        {new Date(blockage.timestamp).toLocaleString()}
                      </div>
                      <div className="mt-2 border-t border-red-200 dark:border-red-800 pt-2 space-y-1.5">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                          <Brain className="w-3 h-3" /> IRIS Analysis
                        </div>
                        <div className="text-[11px] text-red-700 dark:text-red-300">
                          <span className="font-medium">Affected trains:</span>{' '}
                          {affectedTrains.length > 0
                            ? affectedTrains.map((train) => train.id).join(', ')
                            : 'None currently detected'}
                        </div>
                        <div className="text-[11px] text-red-700 dark:text-red-300">
                          <span className="font-medium">Estimated blockage:</span>{' '}
                          Active since {new Date(blockage.timestamp).toLocaleTimeString()}
                        </div>
                        {bestPlan ? (
                          <div className="rounded bg-white/70 dark:bg-slate-800/60 p-2 text-[11px] space-y-1">
                            <div className="font-semibold text-gray-800 dark:text-gray-100">Best plan</div>
                            <div className="text-gray-700 dark:text-gray-300">{bestPlan.label}</div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {recommendations.length} feasible plan{recommendations.length === 1 ? '' : 's'} evaluated
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              Weighted delay: {(bestPlan.expected_impact.total_weighted_delay_min || 0).toFixed(1)} min
                            </div>
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="w-3 h-3" /> Safety: {bestPlan.safety_status}
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => analyseBlockage(blockage.sector_id)}
                            disabled={analysingSector === blockage.sector_id || affectedTrains.length === 0}
                            className="inline-flex items-center gap-1 rounded bg-red-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {analysingSector === blockage.sector_id && <Loader2 className="w-3 h-3 animate-spin" />}
                            Analyse blockage
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(blockage.sector_id)
                    }}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                    title="Remove blockage"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

