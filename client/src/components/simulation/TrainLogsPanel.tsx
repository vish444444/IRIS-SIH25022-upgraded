import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FileText, Train, Filter, X } from 'lucide-react'

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL
  if (
    envUrl &&
    envUrl !== 'undefined' &&
    envUrl !== 'serverurl' &&
    envUrl.startsWith('http')
  ) {
    return envUrl
  }
  return 'http://localhost:3000'
}

interface TrainLogEntry {
  id: string
  trainId: string
  eventType: string
  timestamp: string | Date
  description: string
  metadata?: {
    [key: string]: any
  }
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  state_change: 'State Change',
  emergency_detected: 'Emergency Detected',
  emergency_resolved: 'Emergency Resolved',
  arrival: 'Arrival',
  departure: 'Departure',
  platform_assigned: 'Platform Assigned',
  route_changed: 'Route Changed',
  delay_recorded: 'Delay Recorded',
  sector_blocked: 'Sector Blocked',
  sector_unblocked: 'Sector Unblocked',
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  state_change: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  emergency_detected: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  emergency_resolved: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  arrival: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  departure: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  platform_assigned: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300',
  route_changed: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  delay_recorded: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  sector_blocked: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  sector_unblocked: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
}

export const TrainLogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<TrainLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTrainId, setSelectedTrainId] = useState<string>('')
  const [selectedEventType, setSelectedEventType] = useState<string>('')
  const [trainIds, setTrainIds] = useState<string[]>([])
  const [limit, setLimit] = useState<number>(50)

  const API_BASE_URL = getApiBaseUrl()

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 3000)
    return () => clearInterval(interval)
  }, [selectedTrainId, selectedEventType, limit])

  useEffect(() => {
    fetchTrainIds()
    // Refresh train IDs periodically to catch new trains
    const interval = setInterval(fetchTrainIds, 10000)
    return () => clearInterval(interval)
  }, [])

  const fetchTrainIds = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/receiver`)
      if (response.data.success && response.data.trains) {
        const ids: string[] = response.data.trains
          .map((t: any) => t.train_id || t.id)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
        // Remove duplicates and sort
        const uniqueIds: string[] = Array.from(new Set(ids)).sort()
        setTrainIds(['', ...uniqueIds])
      }
    } catch (error) {
      console.error('Failed to fetch train IDs:', error)
    }
  }

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params: any = { limit }
      if (selectedTrainId) {
        params.trainId = selectedTrainId
      }
      if (selectedEventType) {
        params.eventType = selectedEventType
      }
      const response = await axios.get(`${API_BASE_URL}/api/receiver/logs`, { params })
      if (response.data.success) {
        setLogs(response.data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time: string | Date): string => {
    const date = typeof time === 'string' ? new Date(time) : time
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const eventTypes = Object.keys(EVENT_TYPE_LABELS)

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          Train Logs
        </h3>
        <div className="flex items-center gap-1">
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="text-xs px-2 py-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-900 dark:text-gray-100"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Filter className="w-3 h-3 text-gray-500 dark:text-gray-400" />
            <label className="text-xs text-gray-700 dark:text-gray-300">Train:</label>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedTrainId}
              onChange={(e) => setSelectedTrainId(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-gray-100"
            >
              {trainIds.map((id) => (
                <option key={id} value={id}>
                  {id || 'All Trains'}
                </option>
              ))}
            </select>
            {selectedTrainId && (
              <button
                onClick={() => setSelectedTrainId('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-700 dark:text-gray-300 mb-1 block">
            Event Type:
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-gray-100"
            >
              <option value="">All Events</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            {selectedEventType && (
              <button
                onClick={() => setSelectedEventType('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          Loading logs...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          No logs found
        </div>
      ) : (
        <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600 break-words"
            >
              <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                  <Train className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 break-words min-w-0">
                    {log.trainId}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      EVENT_TYPE_COLORS[log.eventType] ||
                      'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {EVENT_TYPE_LABELS[log.eventType] || log.eventType}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatTime(log.timestamp)}
                </span>
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 break-words">
                {log.description}
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-slate-600">
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                    {Object.entries(log.metadata)
                      .filter(([key, value]) => value !== null && value !== undefined)
                      .map(([key, value]) => {
                        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value)
                        return (
                          <div key={key} className="flex gap-1 break-words">
                            <span className="font-medium flex-shrink-0">{key}:</span>
                            <span className="break-words min-w-0">{valueStr}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

