import React from 'react'
import { TrainUpdate, TrainState } from '../../types/simulation.types'
import {
  X,
  Train,
  MapPin,
  Gauge,
  Clock,
  Navigation,
  AlertTriangle,
} from 'lucide-react'
import axios from 'axios'

interface TrainInfoPanelProps {
  train: TrainUpdate | null
  onClose: () => void
}

interface ExtendedTrainInfoPanelProps extends TrainInfoPanelProps {
  emergencyReason?: string | null
}

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

export const TrainInfoPanel: React.FC<ExtendedTrainInfoPanelProps> = ({
  train: initialTrain,
  onClose,
  emergencyReason,
}) => {
  const [liveTrain] = React.useState<TrainUpdate | null>(initialTrain)
  const [isLoading, setIsLoading] = React.useState(false)

  // Fetch live data when panel opens and poll for updates
  React.useEffect(() => {
    if (!initialTrain) return

    const fetchLiveTrainData = async () => {
      try {
        setIsLoading(true)
        const apiUrl = getApiBaseUrl()
        
        // Fetch train data and timetable
        const [trainResponse, timetableResponse] = await Promise.all([
          axios.get(`${apiUrl}/api/receiver/${initialTrain.id}`).catch(() => null),
          axios.get(`${apiUrl}/api/receiver/timetable`).catch(() => null),
        ])
        
        if (trainResponse?.data.success && trainResponse.data.train) {
          const trainData = trainResponse.data.train
          const speedKmh = trainData.speed || 0
          const speedMs = speedKmh / 3.6
          const isMoving = trainData.isMoving !== undefined ? trainData.isMoving : speedKmh > 0.5
          
          let state: TrainState = TrainState.STOPPED
          if (isMoving && speedKmh > 5) {
            state = TrainState.CRUISING
          } else if (isMoving && speedKmh > 0.5) {
            state = TrainState.ACCELERATING
          } else if (speedKmh === 0) {
            state = TrainState.STOPPED
          }

          // Try to get station info from timetable
          let currentStation = ''
          let nextStation: string | null = null
          let delay = 0
          let scheduledArrival: Date | string | undefined
          let scheduledDeparture: Date | string | undefined
          let platform: number | null = null

          if (timetableResponse?.data.success && timetableResponse.data.timetable) {
            const timetableEntry = timetableResponse.data.timetable.find(
              (entry: any) => entry.trainId === trainData.train_id
            )
            if (timetableEntry) {
              currentStation = timetableEntry.station || ''
              nextStation = timetableEntry.nextStation || null
              delay = timetableEntry.delay || 0
              scheduledArrival = timetableEntry.scheduledArrival
              scheduledDeparture = timetableEntry.scheduledDeparture
              platform = timetableEntry.platform
            }
          }

          /* const updatedTrain: TrainUpdate = {
            id: trainData.train_id,
            position: 0,
            speed: speedMs,
            currentPipeline: currentStation || trainData.destination || '',
            nextPipeline: nextStation,
            state,
            gps: {
              latitude: trainData.lat,
              longitude: trainData.lng,
              speed: speedKmh,
            },
            delay,
            recommendedSpeed: 0,
            class: trainData.type === 'ac' ? TrainClass.AC_LOCAL : trainData.type === 'womens' ? TrainClass.LADIES_SPECIAL : trainData.type === 'fast' ? TrainClass.FAST_LOCAL : undefined,
            scheduledArrival,
            scheduledDeparture,
            platform,
          }
          
          // setLiveTrain(updatedTrain) */
        }
      } catch (error) {
        console.error('Failed to fetch live train data:', error)
        // Keep using initial train data if fetch fails
      } finally {
        setIsLoading(false)
      }
    }

    // Fetch immediately
    fetchLiveTrainData()

    // Poll every 1 second for updates
    const interval = setInterval(fetchLiveTrainData, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [initialTrain?.id])

  const train = liveTrain || initialTrain
  if (!train) return null

  const [pos, setPos] = React.useState<{ x: number; y: number }>({
    x: 0,
    y: 80,
  })
  const [dragging, setDragging] = React.useState(false)
  const dragOffsetRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true)
    // Calculate offset between cursor and panel position
    const panel = e.currentTarget.parentElement as HTMLDivElement
    const rect = panel.getBoundingClientRect()
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    // Prevent text selection while dragging
    e.preventDefault()
  }

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!dragging) return
      const nextX = e.clientX - dragOffsetRef.current.x
      const nextY = e.clientY - dragOffsetRef.current.y
      setPos({ x: Math.max(0, nextX), y: Math.max(0, nextY) })
    },
    [dragging]
  )

  const handleMouseUp = React.useCallback(() => {
    setDragging(false)
  }, [])

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // Position panel initially on the right side of the screen
  React.useEffect(() => {
    const PANEL_WIDTH = 360 // approx min width + padding
    const margin = 16
    const x = Math.max(0, window.innerWidth - PANEL_WIDTH - margin)
    setPos((prev) => ({ x: prev.x === 0 ? x : prev.x, y: prev.y }))
  }, [])

  const getStateColor = (state: TrainState): string => {
    switch (state) {
      case TrainState.SCHEDULED:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700'
      case TrainState.EMERGENCY:
        return 'text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
      case TrainState.STOPPED:
        return 'text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800'
      case TrainState.CRUISING:
        return 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
      default:
        return 'text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    }
  }

  return (
    <div
      className="fixed bg-white dark:bg-slate-800 border border-black dark:border-slate-600 rounded shadow-lg min-w-[320px] z-50"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className={`bg-gray-50 dark:bg-slate-700 px-3 py-2.5 flex justify-between items-center border-b border-gray-200 dark:border-slate-600 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <Train className="w-4 h-4" />
          {train.id}
          {isLoading && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(updating...)</span>
          )}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div
          className={`px-2.5 py-1.5 rounded border text-xs ${getStateColor(
            train.state
          )}`}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
            Status
          </div>
          <div className="font-semibold">{train.state}</div>
        </div>

        {emergencyReason && (
          <div className="bg-red-50/50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded p-2">
            <div className="text-xs text-red-700 dark:text-red-300 mb-0.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Emergency Reason
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">
              {emergencyReason}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
              <Gauge className="w-3 h-3" />
              Current Speed
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {(train.speed * 3.6).toFixed(1)} km/h
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              ({train.speed.toFixed(2)} m/s)
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Position
            </div>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {train.position.toFixed(0)} m
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            Pipeline
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Current:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {train.currentPipeline}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Next:</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {train.nextPipeline || '—'}
              </span>
            </div>
          </div>
        </div>

        {train.delay > 0 && (
          <div className="bg-amber-50/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded p-2">
            <div className="text-xs text-amber-700 dark:text-amber-300 mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Delay
            </div>
            <div className="text-base font-semibold text-amber-700 dark:text-amber-300">
              {train.delay.toFixed(0)}s
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
            Recommended Speed
          </div>
          <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {(train.recommendedSpeed * 3.6).toFixed(1)} km/h
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            GPS
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
            {train.gps.latitude.toFixed(6)}, {train.gps.longitude.toFixed(6)}
          </div>
        </div>

        {train.scheduledArrival && (
          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Scheduled Arrival
            </div>
            <div className="text-xs text-gray-900 dark:text-gray-100">
              {new Date(train.scheduledArrival).toLocaleTimeString()}
            </div>
          </div>
        )}

        {train.actualArrival && (
          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Actual Arrival
            </div>
            <div className="text-xs text-gray-900 dark:text-gray-100">
              {new Date(train.actualArrival).toLocaleTimeString()}
            </div>
          </div>
        )}

        {train.platform !== null && train.platform !== undefined && (
          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Platform
            </div>
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              Platform {train.platform}
            </div>
          </div>
        )}

        {train.class && (
          <div className="bg-gray-50 dark:bg-slate-700 rounded p-2 border border-gray-200 dark:border-slate-600">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
              Class
            </div>
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {train.class}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
