import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SimulationProvider, useSimulation } from '../context/SimulationContext'
import { JsonCorridorMap } from '../components/simulation/JsonCorridorMap'
import { TrainInfoPanel } from '../components/simulation/TrainInfoPanel'
import { EmergencyHandler } from '../components/simulation/EmergencyHandler'
import { ForecastPanel } from '../components/simulation/ForecastPanel'
import { DelayChain } from '../components/simulation/DelayChain'
import { DemoMode } from '../components/simulation/DemoMode'
import { AIRecommendationPanel } from '../components/simulation/AIRecommendationPanel'
import { KPIDashboard } from '../components/simulation/KPIDashboard'
import { StatisticsDashboard } from '../components/simulation/StatisticsDashboard'
import { AlertHistory } from '../components/simulation/AlertHistory'
import { TrackClosurePanel } from '../components/simulation/TrackClosurePanel'
import { SectorBlockagePanel } from '../components/simulation/SectorBlockagePanel'
import { TimetablePanel } from '../components/simulation/TimetablePanel'
import { TrainLogsPanel } from '../components/simulation/TrainLogsPanel'
import { TrainUpdate, TrainState } from '../types/simulation.types'
import { ModeToggle } from '../components/ModeToggle'
import axios from 'axios'
import { toast } from 'sonner'
import {
  Activity,
  Train,
  MapPin,
  Clock,
  FileText,
  Settings,
  AlertTriangle,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp,
  Zap,
  LayoutDashboard,
  Brain
} from 'lucide-react'

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

const SimulationContent: React.FC = () => {
  const { trains, isConnected, update, emergencyEvents, automaticAnalysis } = useSimulation()
  const [selectedTrain, setSelectedTrain] = useState<TrainUpdate | null>(null)
  const [focusedTrainId, setFocusedTrainId] = useState<string | null>(null)
  const [focusedSectorId, setFocusedSectorId] = useState<string | null>(null)
  const [selectedEmergencyReason, setSelectedEmergencyReason] = useState<
    string | null
  >(null)
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'trains' | 'timetable' | 'logs' | 'controls' | 'ai'>('overview')
  const [receiverStats, setReceiverStats] = useState<any>(null)
  const [mapFullView, setMapFullView] = useState(false)

  // Check if simulator is running by checking if receiver has train data and control state
  useEffect(() => {
    const apiUrl = getApiBaseUrl()
    if (!apiUrl || typeof apiUrl !== 'string' || !apiUrl.startsWith('http')) {
      console.error('Invalid API URL:', apiUrl)
      return
    }

    const checkStatus = async () => {
      try {
        const [receiverRes, controlRes] = await Promise.all([
          axios.get(`${apiUrl}/api/receiver`),
          axios.get(`${apiUrl}/api/receiver/control`)
        ])
        setSimulationRunning(controlRes.data.running)
        setReceiverStats(receiverRes.data)
      } catch (error) {
        console.error('Failed to check receiver status:', error)
        setSimulationRunning(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-500" />
      case 'positive':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20'
      case 'warning':
        return 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
      case 'positive':
        return 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'performance':
        return <TrendingUp className="w-4 h-4" />
      case 'safety':
        return <AlertTriangle className="w-4 h-4" />
      case 'efficiency':
        return <Zap className="w-4 h-4" />
      case 'infrastructure':
        return <Activity className="w-4 h-4" />
      case 'operations':
        return <Train className="w-4 h-4" />
      default:
        return <Info className="w-4 h-4" />
    }
  }

  const handleStart = async () => {
    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/receiver/control`, { running: true })
      if (response.data.success) {
        setSimulationRunning(true)
        toast.success("Simulation started successfully. Timetable will resume.")
      }
    } catch (error) {
      console.error('Failed to start simulation:', error)
      toast.error("Failed to start simulation")
    }
  }

  const handleStop = async () => {
    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/receiver/control`, { running: false })
      if (response.data.success) {
        setSimulationRunning(false)
        toast.success("Simulation stopped. Trains cleared.")
      }
    } catch (error) {
      console.error('Failed to stop simulation:', error)
      toast.error("Failed to stop simulation")
    }
  }

  const handleTrainClick = (
    trainId: string,
    emergencyReason?: string | null
  ) => {
    const train = trains.get(trainId)
    setSelectedTrain(train || null)
    // Always set focusedTrainId so map can find train in liveTrains even if not in trains Map
    setFocusedTrainId(trainId)
    setSelectedEmergencyReason(emergencyReason || null)
  }

  // Only render trains that are STOPPED (stationary) or CRUISING (moving)
  // SCHEDULED trains (not yet departed) should not be rendered
  const activeTrains = Array.from(trains.values()).filter(
    (t) => t.state !== TrainState.STOPPED && t.state !== TrainState.SCHEDULED && (t.gps?.speed || t.speed * 3.6 || 0) > 0.5
  )
  const stoppedTrains = Array.from(trains.values()).filter(
    (t) => (t.state === TrainState.STOPPED || (t.gps?.speed || t.speed * 3.6 || 0) <= 0.5) && t.state !== TrainState.SCHEDULED
  )
  const activeEmergencies = emergencyEvents.filter((e) => !e.resolved).length

  // Calculate average speed from all trains
  const speeds = Array.from(trains.values()).map((t) => t.gps?.speed || t.speed * 3.6 || 0)
  const avgSpeed = speeds.length > 0 ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      <EmergencyHandler
        onFocusTrain={handleTrainClick}
        onEmergencyResolved={(trainId) => {
          // Emergency resolved - refresh data
          console.log('Emergency resolved for train:', trainId);
        }}
      />

      <div className="h-screen flex flex-col">
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gray-900 dark:bg-slate-100 rounded flex items-center justify-center">
              <Train className="w-5 h-5 text-white dark:text-slate-900" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                IRIS
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Indian Railway Intelligence System
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            {/* Live Operations clock */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest hidden md:inline">Sim Time:</span>
              <div className="text-xs font-semibold font-mono bg-slate-950 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded shadow-[0_0_8px_rgba(52,211,153,0.1)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                {update?.currentTime
                  ? new Date(update.currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '06:00:00 AM'}
              </div>
            </div>

            {/* Network status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-slate-700 border border-gray-200/50 dark:border-slate-600/50 rounded text-[11px] font-medium">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <span className="text-gray-600 dark:text-gray-300">
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            <button
              onClick={simulationRunning ? handleStop : handleStart}
              className={`px-4 py-1.5 rounded text-xs font-semibold shadow-sm transition-all duration-300 ${
                simulationRunning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {simulationRunning ? 'Stop Simulator' : 'Start Simulator'}
            </button>

            <ModeToggle />
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Top Operational Statistics Banner */}
          {!mapFullView && (
            <div className="px-3 pt-3 grid grid-cols-4 gap-3 flex-shrink-0">
              {/* Total Scheduled Trains */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Total Schedules</span>
                  <h3 className="text-lg font-extrabold mt-1 text-slate-800 dark:text-slate-100">{trains.size}</h3>
                </div>
                <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg text-blue-500 dark:text-blue-400">
                  <Train className="w-4 h-4" />
                </div>
              </div>

              {/* Active Running Trains */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Active Traffic</span>
                  <h3 className="text-lg font-extrabold mt-1 text-emerald-600 dark:text-emerald-400">{activeTrains.length}</h3>
                </div>
                <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-lg text-emerald-500 dark:text-emerald-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              {/* Stopped/Station Trains */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Dwell Status</span>
                  <h3 className="text-lg font-extrabold mt-1 text-amber-500">{stoppedTrains.length}</h3>
                </div>
                <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg text-amber-500">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>

              {/* Active Network Emergencies */}
              <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all duration-300 ${
                activeEmergencies > 0
                  ? 'bg-rose-500/10 border-rose-500/50 animate-pulse text-rose-500'
                  : 'bg-white dark:bg-slate-800 border-gray-200/80 dark:border-slate-700/80'
              }`}>
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Emergencies</span>
                  <h3 className={`text-lg font-extrabold mt-1 ${activeEmergencies > 0 ? 'text-rose-500' : 'text-slate-800 dark:text-slate-100'}`}>{activeEmergencies}</h3>
                </div>
                <div className={`p-2 rounded-lg ${activeEmergencies > 0 ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-500/10 text-gray-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className={`flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0 ${mapFullView ? 'grid-cols-1' : ''}`}>
            {/* Center - Maps */}
            <div className={`${mapFullView ? 'col-span-12' : 'col-span-9'} flex flex-col gap-3 min-h-0 overflow-y-auto`}>
              {/* Central Railway Corridor Map */}
              <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 flex flex-col flex-1 min-h-[400px]">
                <div className="flex-shrink-0 px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-200 dark:border-slate-700">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Central Railway - CSMT to Kalyan Corridor
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMapFullView(!mapFullView)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                      title={mapFullView ? 'Exit full view' : 'View full screen'}
                    >
                      {mapFullView ? (
                        <Minimize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative min-h-[350px]">
                  <JsonCorridorMap
                    onTrainClick={handleTrainClick}
                    focusedTrainId={focusedTrainId}
                    focusedSectorId={focusedSectorId}
                    onSectorBlockageUpdate={() => {
                      // Refresh can be handled by the component itself
                    }}
                  />
                </div>
              </div>
            </div>


            {/* Right Sidebar - Tabbed Interface */}
            {!mapFullView && (
            <div className="col-span-3 flex flex-col gap-3 overflow-hidden min-h-0">
              {/* Tab Navigation */}
              <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-1 flex gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'overview'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('trains')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'trains'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <Train className="w-3.5 h-3.5" />
                  Trains
                </button>
                <button
                  onClick={() => setActiveTab('timetable')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'timetable'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Timetable
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'logs'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Logs
                </button>
                <button
                  onClick={() => setActiveTab('controls')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'controls'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Controls
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'ai'
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  AI
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-3">
              <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Status
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Active
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {activeTrains.length}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Stopped
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {stoppedTrains.length}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Avg Speed
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {avgSpeed.toFixed(1)} km/h
                    </div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                      Emergencies
                    </div>
                    <div className={`text-lg font-semibold ${activeEmergencies > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {activeEmergencies}
                    </div>
                  </div>
                </div>
                {receiverStats && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {new Date(receiverStats.lastUpdated).toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
                    <StatisticsDashboard />
                    <ForecastPanel />
                    <DelayChain />
                    <AlertHistory />
                  </div>
                )}

                {activeTab === 'trains' && (
                  <div className="h-full flex flex-col">
              <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3 flex-1 min-h-0 flex flex-col">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-1.5">
                  <Train className="w-3.5 h-3.5" />
                  Trains
                </h3>
                <div className="space-y-1.5 overflow-y-auto flex-1">
                  {Array.from(trains.values()).map((train) => (
                    <div
                      key={train.id}
                      onClick={() => handleTrainClick(train.id)}
                      className="bg-gray-50 dark:bg-slate-700 rounded p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors border border-gray-200 dark:border-slate-600"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {train.id}
                        </span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${train.state === TrainState.EMERGENCY
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                              : train.state === TrainState.CRUISING
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                : train.state === TrainState.STOPPED
                                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                  : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            }`}
                        >
                          {train.state}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {train.currentPipeline} • {(train.speed * 3.6).toFixed(1)} km/h
                      </div>
                      {train.delay > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          Delay: {train.delay.toFixed(0)}s
                        </div>
                      )}
                    </div>
                  ))}
                  {trains.size === 0 && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                      No trains available
                    </div>
                  )}
                </div>
              </div>
                  </div>
                )}

                {activeTab === 'timetable' && (
                  <div className="h-full">
                    <TimetablePanel onTrainClick={handleTrainClick} />
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="h-full">
                    <TrainLogsPanel />
                  </div>
                )}

                {activeTab === 'controls' && (
                  <div className="flex flex-col gap-3">
                    <TrackClosurePanel />
                    <SectorBlockagePanel
                      onSectorClick={(sectorId) => {
                        setFocusedSectorId(sectorId)
                        setFocusedTrainId(null)
                      }}
                    />
                    {/* Controller panel removed - overrides not available from simulator */}
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="flex flex-col gap-3">
                    <AIRecommendationPanel automaticAnalysis={automaticAnalysis} />
                    <DemoMode />
                    <KPIDashboard />
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {selectedTrain && (
        <TrainInfoPanel
          train={selectedTrain}
          emergencyReason={selectedEmergencyReason}
          onClose={() => {
            setSelectedTrain(null)
            setFocusedTrainId(null)
            setSelectedEmergencyReason(null)
          }}
        />
      )}
    </div>
  )
}

export const Simulation: React.FC = () => {
  const getServerUrl = (): string => {
    try {
      const envUrl = import.meta.env.VITE_SERVER_URL
      console.log('Raw VITE_SERVER_URL:', envUrl, 'Type:', typeof envUrl)

      if (!envUrl || typeof envUrl !== 'string') {
        console.log('VITE_SERVER_URL is not a valid string, using default')
        return 'http://localhost:3000'
      }

      const trimmed = envUrl.trim()
      if (
        trimmed === '' ||
        trimmed === 'undefined' ||
        trimmed === 'serverurl' ||
        trimmed === 'null'
      ) {
        console.log('VITE_SERVER_URL has invalid value, using default')
        return 'http://localhost:3000'
      }

      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        console.log('Using VITE_SERVER_URL:', trimmed)
        return trimmed
      }

      console.log("VITE_SERVER_URL doesn't start with http, using default")
      return 'http://localhost:3000'
    } catch (error) {
      console.error('Error getting server URL:', error)
      return 'http://localhost:3000'
    }
  }

  const serverUrl = getServerUrl()
  console.log('Final Simulation server URL:', serverUrl)

  return (
    <SimulationProvider serverUrl={serverUrl}>
      <SimulationContent />
    </SimulationProvider>
  )
}

