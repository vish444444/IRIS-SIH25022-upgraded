import React from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { Clock, TrendingUp } from 'lucide-react'

export const ForecastPanel: React.FC = () => {
  const { forecasts } = useSimulation()

  if (forecasts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-xs font-semibold mb-2 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Forecast
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No active delay forecasts. Forecasts are generated when emergencies or delays occur.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />
        Forecast
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {forecasts.map((forecast) => (
          <div
            key={forecast.trainId}
            className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded p-2"
          >
            <div className="font-medium text-gray-900 dark:text-gray-100 text-xs mb-2">
              Source: {forecast.trainId}
            </div>
            {forecast.affectedTrains.map((affected) => (
              <div
                key={affected.trainId}
                className="text-xs text-gray-700 dark:text-gray-300 ml-2 mt-1.5 border-l-2 border-amber-400 dark:border-amber-500 pl-2"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {affected.trainId}
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(affected.originalArrival).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-amber-700 dark:text-amber-300">
                      {new Date(affected.forecastArrival).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-amber-700 dark:text-amber-300 font-medium mt-0.5">
                    +{affected.delay.toFixed(0)}s
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
