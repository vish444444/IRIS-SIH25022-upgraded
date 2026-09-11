import React from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { Clock, AlertTriangle, AlertCircle, Info } from 'lucide-react'

export const AlertHistory: React.FC = () => {
  const { emergencyEvents, forecasts } = useSimulation()

  const allAlerts = React.useMemo(() => {
    const alerts: Array<{
      id: string
      type: 'emergency' | 'delay' | 'forecast'
      message: string
      timestamp: Date
      severity: 'high' | 'medium' | 'low'
    }> = []

    emergencyEvents.forEach((event) => {
      const label = (event as any).type
        ? (event as any).type.replace('_', ' ')
        : 'emergency'
      alerts.push({
        id: event.id,
        type: 'emergency',
        message: `Emergency (${label.toUpperCase()}): Train ${
          event.trainId
        } on ${event.pipelineId} - ${event.reason}`,
        timestamp: new Date(event.timestamp),
        severity: 'high',
      })
    })

    forecasts.forEach((forecast) => {
      forecast.affectedTrains.forEach((affected) => {
        if (affected.delay > 60) {
          alerts.push({
            id: `${forecast.trainId}-${affected.trainId}`,
            type: 'delay',
            message: `Delay Alert: Train ${
              affected.trainId
            } delayed by ${affected.delay.toFixed(0)}s`,
            timestamp: new Date(),
            severity: affected.delay > 180 ? 'high' : 'medium',
          })
        }
      })
    })

    return alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
  }, [emergencyEvents, forecasts])

  if (allAlerts.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Alerts
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          No recent alerts
        </p>
      </div>
    )
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <AlertTriangle className="w-3 h-3" />
      case 'delay':
        return <Clock className="w-3 h-3" />
      default:
        return <Info className="w-3 h-3" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-50/50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
      case 'medium':
        return 'bg-amber-50/50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
      default:
        return 'bg-blue-50/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" />
        Alerts
      </h3>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {allAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-2 rounded border text-xs ${getSeverityColor(
              alert.severity
            )}`}
          >
            <div className="flex items-start gap-1.5">
              <div className="mt-0.5">{getIcon(alert.type)}</div>
              <div className="flex-1">
                <div className="font-medium">{alert.message}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {alert.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
