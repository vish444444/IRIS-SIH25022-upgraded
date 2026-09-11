import React, { useState } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { EmergencyAlert } from './EmergencyAlert'
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Route,
  Eye,
  Minimize2,
  Maximize2,
} from 'lucide-react'
import axios from 'axios'

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SERVER_URL
  if (
    envUrl &&
    typeof envUrl === 'string' &&
    envUrl !== 'undefined' &&
    envUrl !== 'serverurl' &&
    envUrl.startsWith('http')
  ) {
    return envUrl
  }
  return 'http://localhost:3000'
}

type ResolutionStrategy =
  | 'immediate_resume'
  | 'hold_assess'
  | 'reroute'
  | 'slow_run'

interface StrategyOption {
  id: ResolutionStrategy
  name: string
  description: string
  icon: React.ReactNode
  color: string
}

const STRATEGIES: StrategyOption[] = [
  {
    id: 'immediate_resume',
    name: 'Immediate Resume',
    description:
      'Unfreeze pipeline and resume train immediately. Best for minor issues.',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    id: 'hold_assess',
    name: 'Hold & Assess',
    description:
      'Keep train stopped for safety check, then resume after 5 seconds.',
    icon: <Pause className="w-4 h-4" />,
    color: 'bg-amber-600 hover:bg-amber-700',
  },
  {
    id: 'reroute',
    name: 'Reroute Train',
    description:
      'Unfreeze pipeline and reroute train to alternative path if available.',
    icon: <Route className="w-4 h-4" />,
    color: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    id: 'slow_run',
    name: 'Slow Run',
    description:
      'Resume train under caution at reduced speed through affected section.',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-slate-800 hover:bg-slate-900',
  },
]

interface EmergencyHandlerProps {
  onFocusTrain?: (trainId: string, emergencyReason?: string | null) => void
  onEmergencyResolved?: (trainId: string) => void
}

export const EmergencyHandler: React.FC<EmergencyHandlerProps> = ({
  onFocusTrain,
  onEmergencyResolved,
}) => {
  const { emergencyEvents } = useSimulation()
  const [resolving, setResolving] = useState<Set<string>>(new Set())
  const [selectedStrategy, setSelectedStrategy] = useState<
    Map<string, ResolutionStrategy>
  >(new Map())
  const [isMinimized, setIsMinimized] = useState(false)

  const handleStrategySelect = (
    emergencyId: string,
    strategy: ResolutionStrategy
  ) => {
    setSelectedStrategy((prev) => new Map(prev).set(emergencyId, strategy))
  }

  const handleResolve = async (emergencyId: string, trainId: string) => {
    const strategy = selectedStrategy.get(emergencyId) || 'immediate_resume'
    setResolving((prev) => new Set(prev).add(emergencyId))
    try {
      const apiUrl = getApiBaseUrl()
      await axios.post(`${apiUrl}/api/receiver/emergency/resolve`, {
        emergencyId,
        trainId,
        strategy,
      })
      if (onEmergencyResolved) {
        onEmergencyResolved(trainId)
      }
      setSelectedStrategy((prev) => {
        const newMap = new Map(prev)
        newMap.delete(emergencyId)
        return newMap
      })
    } catch (error) {
      console.error('Failed to resolve emergency:', error)
      alert('Failed to resolve emergency. Please try again.')
    } finally {
      setResolving((prev) => {
        const newSet = new Set(prev)
        newSet.delete(emergencyId)
        return newSet
      })
    }
  }

  return (
    <>
      <EmergencyAlert onFocusTrain={onFocusTrain} />
      {emergencyEvents.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-lg z-40 shadow-xl">
          <div className={`flex items-center justify-between gap-3 ${isMinimized ? '' : 'mb-3'}`}>
            <h4 className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Active Emergencies
              <span className="text-xs font-normal text-red-500 dark:text-red-300">
                ({emergencyEvents.length})
              </span>
            </h4>
            <button
              type="button"
              onClick={() => setIsMinimized((previous) => !previous)}
              aria-expanded={!isMinimized}
              aria-label={isMinimized ? 'Expand active emergencies' : 'Minimize active emergencies'}
              title={isMinimized ? 'Expand active emergencies' : 'Minimize active emergencies'}
              className="p-1 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 rounded transition-colors"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
          </div>
          {!isMinimized && <div className="space-y-3 max-h-96 overflow-y-auto">
            {emergencyEvents.map((event) => {
              const currentStrategy = selectedStrategy.get(event.id)
              const isResolving = resolving.has(event.id)

              return (
                <div
                  key={event.id}
                  className="text-xs text-gray-900 dark:text-gray-100 bg-red-50/60 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 rounded-lg shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-red-700 dark:text-red-400">
                          {event.trainId}
                        </span>
                        <span className="text-[11px] font-mono text-red-600 dark:text-red-300 bg-red-100/70 dark:bg-red-900/50 px-1.5 py-0.5 rounded">
                          {event.pipelineId}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide bg-red-900/5 dark:bg-red-900/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700 px-1.5 py-0.5 rounded-full">
                          {(event as any).type?.replace('_', ' ') ||
                            'EMERGENCY'}
                        </span>
                      </div>
                      <div className="text-xs text-red-700 dark:text-red-300 mb-1.5 leading-snug">
                        {event.reason}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onFocusTrain?.(event.trainId, event.reason)
                      }
                      className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors text-[11px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>

                  <div className="mb-3 border-t border-red-100 dark:border-red-800 pt-2">
                    <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                      <span>Resolution strategy</span>
                      {currentStrategy && (
                        <span className="text-[10px] uppercase tracking-wide text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                          Selected: {currentStrategy.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {STRATEGIES.map((strategy) => (
                        <button
                          key={strategy.id}
                          onClick={() =>
                            handleStrategySelect(event.id, strategy.id)
                          }
                          disabled={isResolving}
                          className={`flex items-start gap-2 p-2 rounded border-2 transition-all text-left ${
                            currentStrategy === strategy.id
                              ? `${strategy.color} text-white border-transparent`
                              : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 text-gray-700 dark:text-gray-200'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <div className="mt-0.5">{strategy.icon}</div>
                          <div className="flex-1">
                            <div className="font-medium text-[11px] mb-0.5">
                              {strategy.name}
                            </div>
                            <div
                              className={`text-[11px] ${
                                currentStrategy === strategy.id
                                  ? 'text-white/90'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {strategy.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolve(event.id, event.trainId)}
                    disabled={isResolving || !currentStrategy}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 ${
                      currentStrategy
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    } text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isResolving ? (
                      <>
                        <XCircle className="w-4 h-4 animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        {currentStrategy
                          ? 'Apply Strategy'
                          : 'Select Strategy First'}
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>}
        </div>
      )}
    </>
  )
}
