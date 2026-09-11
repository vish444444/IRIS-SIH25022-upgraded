import React, { useMemo, useState, useEffect } from 'react'
import { useSimulation } from '../../hooks/useSimulation'
import { TrainState } from '../../types/simulation.types'
import { TrendingUp, TrendingDown, Activity, Clock, Zap, Train, AlertTriangle } from 'lucide-react'
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

export const StatisticsDashboard: React.FC = () => {
  const { trains, emergencyEvents } = useSimulation()
  const [receiverStats, setReceiverStats] = useState<any>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const apiUrl = getApiBaseUrl()
        const response = await axios.get(`${apiUrl}/api/receiver`)
        if (response.data.success) {
          setReceiverStats(response.data)
        }
      } catch (error) {
        console.error('Failed to fetch receiver stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const stats = useMemo(() => {
    const trainList = Array.from(trains.values())

    // Calculate speeds in km/h from GPS data
    const speedsKmh = trainList.map((t) => t.gps?.speed || t.speed * 3.6 || 0)
    const avgSpeedKmh = speedsKmh.length > 0 
      ? speedsKmh.reduce((sum, s) => sum + s, 0) / speedsKmh.length 
      : 0
    const maxSpeedKmh = speedsKmh.length > 0 ? Math.max(...speedsKmh) : 0
    const minSpeedKmh = speedsKmh.length > 0 ? Math.min(...speedsKmh) : 0

    // Calculate total distance traveled (estimate from GPS positions)
    let totalDistanceKm = 0
    if (trainList.length > 0) {
      // Estimate distance from GPS coordinates (rough calculation)
      trainList.forEach((train) => {
        // Use a rough estimate: each train has traveled some distance
        // We can't calculate exact distance without position history, so use speed * time estimate
        const estimatedDistance = (train.gps?.speed || 0) * 0.5 / 60 // km (assuming 30 min average)
        totalDistanceKm += estimatedDistance
      })
    }

    // Get delay from timetable if available
    const delays = trainList.map((t) => t.delay || 0).filter(d => d > 0)
    const avgDelay = delays.length > 0 
      ? delays.reduce((sum, d) => sum + d, 0) / delays.length 
      : 0
    const onTimeTrains = trainList.filter((t) => (t.delay || 0) < 30).length
    const onTimePercentage =
      trainList.length > 0 ? (onTimeTrains / trainList.length) * 100 : 100

    const stateCounts = {
      scheduled: trainList.filter((t) => t.state === TrainState.SCHEDULED).length,
      cruising: trainList.filter((t) => t.state === TrainState.CRUISING).length,
      stopped: trainList.filter((t) => t.state === TrainState.STOPPED).length,
      accelerating: trainList.filter((t) => t.state === TrainState.ACCELERATING).length,
      braking: trainList.filter((t) => t.state === TrainState.BRAKING).length,
      emergency: trainList.filter((t) => t.state === TrainState.EMERGENCY).length,
    }

    // Count by train type
    const typeCounts = {
      slow: trainList.filter((t) => t.class === undefined || !t.class?.includes('Fast') && !t.class?.includes('AC') && !t.class?.includes('Ladies')).length,
      fast: trainList.filter((t) => t.class?.includes('Fast')).length,
      ac: trainList.filter((t) => t.class?.includes('AC')).length,
      womens: trainList.filter((t) => t.class?.includes('Ladies')).length,
    }

    // Moving vs stationary
    const movingTrains = trainList.filter((t) => (t.gps?.speed || t.speed * 3.6) > 0.5).length
    const stationaryTrains = trainList.length - movingTrains

    // Active emergencies
    const activeEmergencies = emergencyEvents.filter((e) => !e.resolved).length

    // Get receiver stats if available
    const countByType = receiverStats?.countByType || {}
    const totalTrainsFromReceiver = receiverStats?.totalTrains || trainList.length

    return {
      totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : 0,
      avgSpeedKmh,
      maxSpeedKmh,
      minSpeedKmh,
      avgSpeedMs: avgSpeedKmh / 3.6,
      maxSpeedMs: maxSpeedKmh / 3.6,
      avgDelay,
      onTimePercentage,
      stateCounts,
      typeCounts,
      movingTrains,
      stationaryTrains,
      activeEmergencies,
      totalTrains: trainList.length,
      totalTrainsFromReceiver,
      countByType,
    }
  }, [trains, emergencyEvents, receiverStats])

  const StatCard: React.FC<{
    title: string
    value: string | number
    icon: React.ReactNode
    trend?: 'up' | 'down' | 'neutral'
    trendValue?: string
    color?: string
  }> = ({ title, value, icon, trend, trendValue, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800',
      green:
        'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
      yellow:
        'bg-amber-50/50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
      red: 'bg-red-50/50 dark:bg-red-900/20 border-red-100 dark:border-red-800',
      purple:
        'bg-purple-50/50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800',
    }

    return (
      <div
        className={`rounded border p-2 ${
          colorClasses[color as keyof typeof colorClasses]
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <div className="text-gray-600 dark:text-gray-400">{icon}</div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {title}
            </span>
          </div>
          {trend && trendValue && (
            <div
              className={`flex items-center gap-0.5 text-xs ${
                trend === 'up'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : trend === 'down'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : null}
              <span className="font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {value}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
      <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" />
        Metrics
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          title="Total Trains"
          value={stats.totalTrainsFromReceiver || stats.totalTrains}
          icon={<Train className="w-3.5 h-3.5" />}
          color="blue"
        />
        <StatCard
          title="Avg Speed"
          value={stats.avgSpeedKmh > 0 ? `${stats.avgSpeedKmh.toFixed(1)} km/h` : '0 km/h'}
          icon={<Activity className="w-3.5 h-3.5" />}
          color="green"
        />
        <StatCard
          title="Max Speed"
          value={stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh.toFixed(1)} km/h` : '0 km/h'}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          color="purple"
        />
        <StatCard
          title="Moving"
          value={stats.movingTrains}
          icon={<Zap className="w-3.5 h-3.5" />}
          color="green"
        />
        <StatCard
          title="Stopped"
          value={stats.stationaryTrains}
          icon={<Clock className="w-3.5 h-3.5" />}
          color="yellow"
        />
        <StatCard
          title="Emergencies"
          value={stats.activeEmergencies}
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          color={stats.activeEmergencies > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Train States
        </h4>
        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Cruising:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {stats.stateCounts.cruising}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Stopped:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {stats.stateCounts.stopped}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Accel:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {stats.stateCounts.accelerating}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Braking:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {stats.stateCounts.braking}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Emergency:</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {stats.activeEmergencies}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Min Speed:</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {stats.minSpeedKmh.toFixed(1)} km/h
            </span>
          </div>
        </div>
      </div>

      {Object.keys(stats.countByType).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Train Types
          </h4>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Slow:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.countByType.slow || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Fast:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.countByType.fast || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">AC:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.countByType.ac || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Women's:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {stats.countByType.womens || 0}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
