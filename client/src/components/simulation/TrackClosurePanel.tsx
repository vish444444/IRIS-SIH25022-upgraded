import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { AlertTriangle, X } from 'lucide-react'
import { TrackClosure } from '../../types/simulation.types'

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

const API_BASE_URL = getApiBaseUrl()

interface Station {
  name: string
  id: string
  lat: number
  lng: number
  availableTracks: Array<{
    key: string
    direction: 'up' | 'down'
    trackType: 'slow' | 'fast' | 'unknown'
    next: string[]
  }>
}

export const TrackClosurePanel: React.FC = () => {
  const [closures, setClosures] = useState<TrackClosure[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStations, setLoadingStations] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    station_from: '',
    station_to: '',
    track_type: 'slow' as 'slow' | 'fast',
    direction: 'up' as 'up' | 'down',
    status: 'closed' as 'closed' | 'open',
    description: '',
  })
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchStations()
    fetchClosures()
    const interval = setInterval(fetchClosures, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchStations = async () => {
    try {
      setLoadingStations(true)
      const response = await axios.get(`${API_BASE_URL}/api/status/stations`)
      if (response.data.success) {
        setStations(response.data.stations || [])
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error)
      setMessage({ text: 'Failed to load station list', type: 'error' })
    } finally {
      setLoadingStations(false)
    }
  }

  const fetchClosures = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status/track-closures`)
      if (response.data.success) {
        setClosures(response.data.closures || [])
      }
    } catch (error) {
      console.error('Failed to fetch track closures:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      await axios.post(`${API_BASE_URL}/api/status/track-closure`, formData)
      setMessage({ text: 'Track closure status updated successfully', type: 'success' })
      setShowForm(false)
      setFormData({
        station_from: '',
        station_to: '',
        track_type: 'slow',
        direction: 'up',
        status: 'closed',
        description: '',
      })
      fetchClosures()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      setMessage({
        text: error.response?.data?.error || 'Failed to update track closure',
        type: 'error',
      })
      setTimeout(() => setMessage(null), 5000)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      const closure = closures.find((c) => c.id === id)
      if (closure) {
        await axios.post(`${API_BASE_URL}/api/status/track-closure`, {
          ...closure,
          status: 'open',
        })
        fetchClosures()
      }
    } catch (error) {
      console.error('Failed to remove closure:', error)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Track Closures
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
              From Station
            </label>
            <select
              value={formData.station_from}
              onChange={(e) => setFormData({ ...formData, station_from: e.target.value })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              required
              disabled={loadingStations}
            >
              <option value="">{loadingStations ? 'Loading stations...' : 'Select station'}</option>
              {stations.map((station) => (
                <option key={station.name} value={station.name}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Station
            </label>
            <select
              value={formData.station_to}
              onChange={(e) => setFormData({ ...formData, station_to: e.target.value })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              required
              disabled={loadingStations}
            >
              <option value="">{loadingStations ? 'Loading stations...' : 'Select station'}</option>
              {stations.map((station) => (
                <option key={station.name} value={station.name}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Track Type
              </label>
              <select
                value={formData.track_type}
                onChange={(e) => setFormData({ ...formData, track_type: e.target.value as 'slow' | 'fast' })}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              >
                <option value="slow">Slow</option>
                <option value="fast">Fast</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Direction
              </label>
              <select
                value={formData.direction}
                onChange={(e) => setFormData({ ...formData, direction: e.target.value as 'up' | 'down' })}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              >
                <option value="up">Up</option>
                <option value="down">Down</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'closed' | 'open' })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-xs"
              placeholder="e.g., Maintenance work"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !formData.station_from || !formData.station_to}
            className="w-full px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {closures.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No active track closures
          </div>
        ) : (
          closures.map((closure) => (
            <div
              key={closure.id}
              className="bg-red-50 dark:bg-red-900/30 rounded p-2 border border-red-200 dark:border-red-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-red-800 dark:text-red-200">
                      {closure.station_from} → {closure.station_to}
                    </span>
                  </div>
                  <div className="text-xs text-red-700 dark:text-red-300 space-y-0.5">
                    <div>
                      {closure.track_type.toUpperCase()} track • {closure.direction.toUpperCase()}
                    </div>
                    {closure.description && (
                      <div className="text-red-600 dark:text-red-400 italic">
                        {closure.description}
                      </div>
                    )}
                    <div className="text-red-500 dark:text-red-500/70 text-[10px]">
                      {new Date(closure.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(closure.id)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
                  title="Remove closure"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

