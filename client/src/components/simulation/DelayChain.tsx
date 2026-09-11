import React from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { ArrowRight, AlertTriangle } from 'lucide-react'

export const DelayChain: React.FC = () => {
  const { forecasts, trains } = useSimulation()

  if (forecasts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Delay Chain
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No delay chains detected. Chains appear when one train's delay affects others.
        </p>
      </div>
    )
  }

  const getDelaySeverity = (delay: number): string => {
    if (delay < 60) return 'text-amber-600 dark:text-amber-400'
    if (delay < 180) return 'text-amber-700 dark:text-amber-300'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Delay Chain
      </h3>
      <div className="space-y-2">
        {forecasts.map((forecast) => {
          const sourceTrain = trains.get(forecast.trainId)
          return (
            <div
              key={forecast.trainId}
              className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100 text-xs mb-2 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                {forecast.trainId}
                {sourceTrain && (
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    ({sourceTrain.currentPipeline})
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {forecast.affectedTrains.map((affected) => {
                  const train = trains.get(affected.trainId)
                  return (
                    <div
                      key={`${forecast.trainId}-${affected.trainId}`}
                      className="flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-900 dark:text-gray-100 font-medium">
                            {affected.trainId}
                          </span>
                          {train && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({train.currentPipeline})
                            </span>
                          )}
                          <span
                            className={`text-xs font-medium ${getDelaySeverity(
                              affected.delay
                            )}`}
                          >
                            +{affected.delay.toFixed(0)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
