import React, { useState } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import axios from 'axios'
import { Radio, AlertCircle } from 'lucide-react'

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

export const ControllerPanel: React.FC = () => {
  const { trains, isConnected } = useSimulation()
  const [selectedTrain, setSelectedTrain] = useState<string>('')
  const [action, setAction] = useState<
    'route_change' | 'hold' | 'accelerate' | 'slow_run'
  >('hold')
  const [routePreset, setRoutePreset] = useState<
    'up_local' | 'up_express' | 'down_local' | 'down_express'
  >('up_local')
  const [loading, setLoading] = useState(false)
  const [lastAction, setLastAction] = useState<string>('')

  const trainList = Array.from(trains.values())

  const handleOverride = async () => {
    if (!selectedTrain) return

    setLoading(true)
    try {
      const routePresets: Record<typeof routePreset, string[]> = {
        up_local: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'],
        up_express: ['P11', 'P12', 'P13'],
        down_local: [
          'P31',
          'P32',
          'P33',
          'P34',
          'P35',
          'P36',
          'P37',
          'P38',
          'P39',
          'P40',
        ],
        down_express: ['P51', 'P52', 'P53'],
      }

      await axios.post(`${API_BASE_URL}/api/simulation/override`, {
        trainId: selectedTrain,
        action,
        value:
          action === 'route_change' ? routePresets[routePreset] : undefined,
      })
      setLastAction(`Override applied: ${action} on ${selectedTrain}`)
      setTimeout(() => setLastAction(''), 3000)
    } catch (error) {
      console.error('Failed to apply override:', error)
      setLastAction('Failed to apply override')
      setTimeout(() => setLastAction(''), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5" />
        Override
      </h3>

      {lastAction && (
        <div
          className={`mb-3 p-2 rounded text-xs border ${
            lastAction.includes('Failed')
              ? 'bg-red-50/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-emerald-50/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}
        >
          {lastAction}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Train
          </label>
          <select
            value={selectedTrain}
            onChange={(e) => setSelectedTrain(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-gray-900 dark:focus:border-gray-400"
            disabled={trainList.length === 0}
          >
            <option value="">
              {trainList.length === 0
                ? isConnected
                  ? 'Waiting for trains...'
                  : 'Not connected'
                : 'Select train'}
            </option>
            {trainList.map((train) => (
              <option key={train.id} value={train.id}>
                {train.id} {train.class ? `(${train.class})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Action
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as any)}
            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-400 focus:border-gray-900 dark:focus:border-gray-400"
          >
            <option value="hold">Hold</option>
            <option value="accelerate">Accelerate</option>
            <option value="slow_run">Slow Run (caution)</option>
            <option value="route_change">Change Route</option>
          </select>
        </div>

        {action === 'route_change' && (
          <div className="bg-amber-50/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded p-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  Route change preset
                </div>
                <select
                  value={routePreset}
                  onChange={(e) =>
                    setRoutePreset(e.target.value as typeof routePreset)
                  }
                  className="w-full px-2 py-1 bg-white dark:bg-slate-700 border border-amber-300 dark:border-amber-700 rounded text-xs text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-600"
                >
                  <option value="up_local">Up Local (CSMT → Thane slow)</option>
                  <option value="up_express">
                    Up Express (CSMT → Thane fast)
                  </option>
                  <option value="down_local">
                    Down Local (Thane → CSMT slow)
                  </option>
                  <option value="down_express">
                    Down Express (Thane → CSMT fast)
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleOverride}
          disabled={!selectedTrain || loading}
          className="w-full px-3 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Applying...' : 'Execute'}
        </button>
      </div>
    </div>
  )
}
