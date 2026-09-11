import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'
import { Clock, Train, MapPin, Filter, Gauge, Navigation, Route, Users, Star, TrendingUp, Edit2 } from 'lucide-react'

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

interface TimetableEntry {
  trainId: string
  trainClass: string
  coaches: number
  priority: number
  scheduledArrival: string | Date
  scheduledDeparture: string | Date
  actualArrival: string | Date | null
  actualDeparture: string | Date | null
  arrivalDelay: number
  departureDelay: number
  delay: number
  platform: number | null
  station: string
  stationId: string | null
  state: string
  position: number
  speed: number
  speedKmh: number
  currentPipeline: string
  nextPipeline: string | null
  assignedPath: string[]
  pathLength: number
  gps: {
    latitude: number
    longitude: number
    speed: number
  }
  pipelineInfo: {
    id: string
    from: string
    to: string
    length: number
    maxSpeed: number
    maxSpeedMs: number
    defaultHeadway: number
    isOccupied: boolean
    isFrozen: boolean
    occupiedBy: string | null
    nextTrain: string | null
    nextNextTrain: string | null
  } | null
  nextPipelineInfo: {
    id: string
    from: string
    to: string
    length: number
    maxSpeed: number
    maxSpeedMs: number
    defaultHeadway: number
    isOccupied: boolean
    isFrozen: boolean
  } | null
  nextStation: string | null
  nextStationId: string | null
  totalKm: number
  totalKmRounded: number
  speedHistory: Array<{
    timestamp: string | Date
    speed: number
    speedKmh: number
  }>
  pipelineTimes: Array<{
    pipelineId: string
    timeSeconds: number
  }>
  pipelineTimesCount: number
  recommendedSpeed: number
  recommendedSpeedKmh: number
  positionPercent: number
  remainingDistance: number
  dwellTime: number | null
  scheduledDwellTime: number | null
}

interface TimetablePanelProps {
  onTrainClick?: (trainId: string) => void
}

export const TimetablePanel: React.FC<TimetablePanelProps> = ({ onTrainClick }) => {
  const { user } = useAuth()
  const [timetable, setTimetable] = useState<TimetableEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStation, setSelectedStation] = useState<string>('')
  const [stations, setStations] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'time' | 'delay' | 'train'>('time')

  const API_BASE_URL = getApiBaseUrl()

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/status/stations`)
      if (response.data.success) {
        const stationNames = response.data.stations.map((s: any) => s.name)
        setStations(['', ...stationNames])
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error)
    }
  }

  const fetchTimetable = async () => {
    try {
      const params: any = {}
      if (selectedStation) {
        params.station = selectedStation
      }
      const response = await axios.get(`${API_BASE_URL}/api/receiver/timetable`, { params })
      if (response.data.success) {
        setTimetable(response.data.timetable || [])
      }
    } catch (error) {
      console.error('Failed to fetch timetable:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStations()
  }, [])

  useEffect(() => {
    fetchTimetable()
    const interval = setInterval(() => {
      fetchTimetable()
    }, 1000)
    return () => clearInterval(interval)
  }, [selectedStation])

  const formatTime = (time: string | Date | null): string => {
    if (!time) return '—'
    const date = typeof time === 'string' ? new Date(time) : time
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDelay = (delay: number): string => {
    if (delay < 60) return `${delay.toFixed(0)}s`
    const minutes = Math.floor(delay / 60)
    const seconds = delay % 60
    return `${minutes}m ${seconds.toFixed(0)}s`
  }

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${meters.toFixed(0)}m`
    return `${(meters / 1000).toFixed(2)}km`
  }

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return '—'
    if (seconds < 60) return `${seconds.toFixed(0)}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}m ${secs.toFixed(0)}s`
  }

  const getDelayColor = (delay: number): string => {
    if (delay < 30) return 'text-emerald-600 dark:text-emerald-400'
    if (delay < 120) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const sortedTimetable = [...timetable].sort((a, b) => {
    switch (sortBy) {
      case 'delay':
        return b.delay - a.delay
      case 'train':
        return a.trainId.localeCompare(b.trainId)
      case 'time':
      default:
        const timeA = a.scheduledArrival ? new Date(a.scheduledArrival).getTime() : 0
        const timeB = b.scheduledArrival ? new Date(b.scheduledArrival).getTime() : 0
        return timeA - timeB
    }
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Timetable
          <span className="ml-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Live</span>
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {user?.role === 'system_admin' && (
            <Link
              to="/admin/timetable"
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
              title="Edit train timetable schedule"
            >
              <Edit2 className="w-3 h-3" />
              Edit Schedule
            </Link>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'time' | 'delay' | 'train')}
            className="text-xs px-2 py-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-gray-900 dark:text-gray-100"
          >
            <option value="time">Sort by Time</option>
            <option value="delay">Sort by Delay</option>
            <option value="train">Sort by Train</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          <label className="text-xs text-gray-700 dark:text-gray-300">Filter by Station:</label>
        </div>
        <select
          value={selectedStation}
          onChange={(e) => setSelectedStation(e.target.value)}
          className="w-full px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-xs text-gray-900 dark:text-gray-100"
        >
          {stations.map((station) => (
            <option key={station} value={station}>
              {station || 'All Stations'}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          Loading timetable...
        </div>
      ) : sortedTimetable.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          No trains in timetable
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
          {sortedTimetable.map((entry) => {
            const hasDelay = entry.delay > 0
            const isDelayed = entry.delay > 30

            return (
              <div
                key={entry.trainId}
                onClick={() => onTrainClick?.(entry.trainId)}
                className={`bg-gray-50 dark:bg-slate-700 rounded p-3 border ${
                  isDelayed
                    ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/30'
                    : 'border-gray-200 dark:border-slate-600'
                } ${onTrainClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Train className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {entry.trainId}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({entry.trainClass})
                    </span>
                    {entry.coaches > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                        <Users className="w-3 h-3" />
                        {entry.coaches}
                      </span>
                    )}
                    {entry.priority > 1 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <Star className="w-3 h-3" />
                        P{entry.priority}
                      </span>
                    )}
                  </div>
                  {hasDelay && (
                    <span className={`text-xs font-medium ${getDelayColor(entry.delay)}`}>
                      +{formatDelay(entry.delay)}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Scheduled Arrival
                      </div>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatTime(entry.scheduledArrival)}
                      </div>
                      {entry.actualArrival && (
                        <div className={`text-xs mt-0.5 ${hasDelay ? getDelayColor(entry.delay) : 'text-gray-600 dark:text-gray-400'}`}>
                          Actual: {formatTime(entry.actualArrival)}
                          {entry.arrivalDelay > 0 && (
                            <span className="ml-1">(+{formatDelay(entry.arrivalDelay)})</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Scheduled Departure
                      </div>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatTime(entry.scheduledDeparture)}
                      </div>
                      {entry.actualDeparture && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Actual: {formatTime(entry.actualDeparture)}
                          {entry.departureDelay > 0 && (
                            <span className="ml-1 text-amber-600 dark:text-amber-400">
                              (+{formatDelay(entry.departureDelay)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5">Dwell Time</div>
                      <div className="text-gray-900 dark:text-gray-100">
                        Scheduled: {formatDuration(entry.scheduledDwellTime)}
                      </div>
                      {entry.dwellTime !== null && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Actual: {formatDuration(entry.dwellTime)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Location
                      </div>
                      <div className="text-gray-900 dark:text-gray-100">
                        {entry.station}
                        {entry.platform && (
                          <span className="text-gray-500 dark:text-gray-400 ml-1">
                            • P{entry.platform}
                          </span>
                        )}
                      </div>
                      {entry.nextStation && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          Next: {entry.nextStation}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Speed
                      </div>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {entry.speedKmh.toFixed(1)} km/h
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {entry.speed.toFixed(2)} m/s
                      </div>
                      {entry.recommendedSpeedKmh > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Max: {entry.recommendedSpeedKmh.toFixed(0)} km/h
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        Position
                      </div>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatDistance(entry.position)}
                      </div>
                      {entry.pipelineInfo && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {entry.positionPercent.toFixed(1)}% of {formatDistance(entry.pipelineInfo.length)}
                        </div>
                      )}
                      {entry.remainingDistance > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Remaining: {formatDistance(entry.remainingDistance)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div className="text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                      <Route className="w-3 h-3" />
                      Pipeline Info
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Current:</span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {entry.currentPipeline}
                        </span>
                      </div>
                      {entry.pipelineInfo && (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Status:</span>
                            <span className={`font-medium ${
                              entry.pipelineInfo.isFrozen
                                ? 'text-red-600 dark:text-red-400'
                                : entry.pipelineInfo.isOccupied
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {entry.pipelineInfo.isFrozen
                                ? 'Frozen'
                                : entry.pipelineInfo.isOccupied
                                ? 'Occupied'
                                : 'Free'}
                            </span>
                          </div>
                          {entry.pipelineInfo.occupiedBy && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500 dark:text-gray-400">Occupied by:</span>
                              <span className="text-gray-900 dark:text-gray-100">{entry.pipelineInfo.occupiedBy}</span>
                            </div>
                          )}
                          {entry.pipelineInfo.nextTrain && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500 dark:text-gray-400">Next train:</span>
                              <span className="text-gray-900 dark:text-gray-100">{entry.pipelineInfo.nextTrain}</span>
                            </div>
                          )}
                        </>
                      )}
                      {entry.nextPipeline && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-600 dark:text-gray-400">Next:</span>
                          <span className="text-gray-900 dark:text-gray-100 font-medium">
                            {entry.nextPipeline}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Route
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.pathLength} segments
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                      {entry.assignedPath.slice(0, 5).join(' → ')}
                      {entry.assignedPath.length > 5 && ' → ...'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5">Total Distance</div>
                      <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {entry.totalKmRounded.toFixed(2)} km
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-0.5">GPS</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {entry.gps.latitude.toFixed(6)}, {entry.gps.longitude.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        entry.state === 'emergency'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                          : entry.state === 'stopped'
                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                          : entry.state === 'cruising'
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : entry.state === 'accelerating'
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : entry.state === 'braking'
                          ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                          : 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {entry.state}
                    </span>
                    {entry.pipelineTimesCount > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.pipelineTimesCount} pipeline records
                      </span>
                    )}
                    {entry.speedHistory.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.speedHistory.length} speed points
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

