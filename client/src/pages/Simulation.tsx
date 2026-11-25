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
import { LineId } from '../types/liveTrains.types'
import { ModeToggle } from '../components/ModeToggle'
import { useAuth, getUserRole, getLandingRouteForRole } from '../context/AuthContext'
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
  Brain,
  LogOut,
  User as UserIcon,
  Sparkles,
  Shield,
  Home,
  RotateCcw,
  Gauge
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
  const { trains, isConnected, update, emergencyEvents, automaticAnalysis, setPreferredLineId } = useSimulation()
  const { user, logout } = useAuth()
  const [selectedTrain, setSelectedTrain] = useState<TrainUpdate | null>(null)
  const [focusedTrainId, setFocusedTrainId] = useState<string | null>(null)
  const [focusedSectorId, setFocusedSectorId] = useState<string | null>(null)
  const [selectedEmergencyReason, setSelectedEmergencyReason] = useState<
    string | null
  >(null)
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [selectedLineId, setSelectedLineId] = useState<LineId>('secr-raipur')
  const [activeTab, setActiveTab] = useState<'overview' | 'trains' | 'timetable' | 'logs' | 'controls' | 'ai'>('overview')
  const [receiverStats, setReceiverStats] = useState<any>(null)
  const [mapFullView, setMapFullView] = useState(false)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(5)

  // Check if simulator is running and sync speed multiplier
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
        if (typeof controlRes.data.speedMultiplier === 'number') {
          setSpeedMultiplier(controlRes.data.speedMultiplier)
        }
        setReceiverStats(receiverRes.data)
      } catch (error) {
        console.error('Failed to check receiver status:', error)
        setSimulationRunning(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000)
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
        toast.success("Simulation paused — trains held in position for inspection")
      }
    } catch (error) {
      console.error('Failed to pause simulation:', error)
      toast.error("Failed to pause simulation")
    }
  }

  const handleSpeedChange = async (mult: number) => {
    try {
      setSpeedMultiplier(mult)
      const response = await axios.post(`${getApiBaseUrl()}/api/receiver/control`, { speedMultiplier: mult })
      if (response.data.success) {
        toast.success(`Simulation speed set to ${mult}x`)
      }
    } catch (error) {
      toast.error("Failed to update speed multiplier")
    }
  }

  const handleReset = async () => {
    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/receiver/control`, { reset: true })
      if (response.data.success) {
        setSimulationRunning(true)
        toast.success("Simulation reset to 06:15 AM peak rush cycle")
      }
    } catch (error) {
      toast.error("Failed to reset simulation")
    }
  }

  // Sync preferred corridor with AI conflict detector
  useEffect(() => {
    setPreferredLineId(selectedLineId)
  }, [selectedLineId, setPreferredLineId])

  // Operations keyboard shortcuts: Space (Play/Pause), 1-4 (1x/5x/10x/20x)
  useEffect(() => {
    const speedByKey: Record<string, number> = { '1': 1, '2': 5, '3': 10, '4': 20 }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (simulationRunning) handleStop()
        else handleStart()
      } else if (speedByKey[e.key]) {
        handleSpeedChange(speedByKey[e.key])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [simulationRunning])

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

  // Corridor-scoped + overall telemetry metrics
  const allTrainList = Array.from(trains.values())
  const corridorTrains = allTrainList.filter((t) => !t.lineId || t.lineId === selectedLineId)
  const activeTrains = corridorTrains.filter(
    (t) => t.state !== TrainState.STOPPED && t.state !== TrainState.SCHEDULED && (t.gps?.speed || t.speed * 3.6 || 0) > 0.5
  )
  const stoppedTrains = corridorTrains.filter(
    (t) => (t.state === TrainState.STOPPED || (t.gps?.speed || t.speed * 3.6 || 0) <= 0.5) && t.state !== TrainState.SCHEDULED
  )
  const activeEmergencies = emergencyEvents.filter((e) => !e.resolved).length
  const onTimeCount = corridorTrains.filter((t) => (t.delay || 0) <= 30).length
  const punctualityPct = corridorTrains.length > 0 ? Math.round((onTimeCount / corridorTrains.length) * 100) : 100

  // Calculate average speed across active corridor trains
  const speeds = corridorTrains.map((t) => t.gps?.speed || t.speed * 3.6 || 0)
  const avgSpeed = speeds.length > 0 ? speeds.reduce((sum, s) => sum + s, 0) / speeds.length : 0

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 overflow-hidden relative flex flex-col font-sans">
      {/* Subtle Dot Pattern matching Landing Page */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #38bdf8 1.25px, transparent 1.25px)',
          backgroundSize: '20px 20px',
        }}
      />

      <EmergencyHandler
        onFocusTrain={handleTrainClick}
        onEmergencyResolved={(trainId) => {
          // Emergency resolved - refresh data
          console.log('Emergency resolved for train:', trainId);
        }}
      />

      <div className="h-screen flex flex-col relative z-10">
        <header className="backdrop-blur-xl transition-colors duration-300 bg-white/85 dark:bg-[#0b101d]/85 border-b border-slate-200/80 dark:border-slate-800/80 px-6 py-2.5 flex items-center justify-between z-20 shadow-sm flex-shrink-0">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-700/80 flex items-center justify-center shadow-inner">
              <Train className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  IRIS
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider">
                  v2.4 SECR
                </span>
              </div>
              <p className="text-[11px] font-medium leading-none mt-0.5">
                <span className="text-orange-500 font-semibold">Indian</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">Railway</span>{' '}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Intelligence System</span>
              </p>
            </div>
          </Link>

          {/* Center Navigation Shortcuts matching Landing */}
          <nav className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Link
              to="/"
              className="flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              Overview
            </Link>
            <Link
              to="/dashboard/controller"
              className="flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Controller Desk
            </Link>
            <Link
              to="/admin/timetable"
              className="flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Timetable
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {/* Live Operations clock */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-widest hidden md:inline">Sim Time:</span>
              <div className="text-xs font-semibold font-mono transition-colors duration-300 bg-emerald-50 dark:bg-slate-950/90 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-1 rounded-full shadow-sm dark:shadow-[0_0_12px_rgba(16,185,129,0.15)] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {update?.currentTime
                  ? new Date(update.currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '06:15:00 AM'}
              </div>
            </div>

            {/* Network status */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-full text-[11px] font-medium">
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500 animate-pulse'}`} />
              <span className="text-slate-600 dark:text-slate-300">
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Speed Multiplier Control (1x / 5x / 10x / 20x) */}
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <Gauge className="w-3.5 h-3.5 text-cyan-500 mx-1.5" />
              {[1, 5, 10, 20].map((mult) => (
                <button
                  key={mult}
                  onClick={() => handleSpeedChange(mult)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all ${
                    speedMultiplier === mult
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mult}x
                </button>
              ))}
            </div>

            {/* Start/Stop Button matching Landing CTA */}
            <button
              onClick={simulationRunning ? handleStop : handleStart}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md hover:scale-[1.02] transition-all duration-200 flex items-center gap-1.5 ${
                simulationRunning
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {simulationRunning ? 'Pause' : 'Start'}
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
              title="Reset Simulation Cycle to 06:15 AM"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* User Profile Badge */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-xs">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 leading-none">
                    {user.name || user.email.split('@')[0]}
                  </div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                    {user.role?.replace('_', ' ')}
                  </div>
                </div>
              </div>
            )}

            {user && (
              <button
                onClick={logout}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            <ModeToggle />
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Top Operational Statistics Banner matching Landing Page */}
          {!mapFullView && (
            <div className="px-4 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
              {/* Total Scheduled Trains */}
              <div className="backdrop-blur-md bg-white/70 dark:bg-[#0c1322]/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-sm hover:border-blue-500/40 transition-all">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Schedules</span>
                  <h3 className="text-xl font-extrabold mt-1 text-slate-900 dark:text-white font-mono">{trains.size}</h3>
                </div>
                <div className="p-2.5 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-500 dark:text-blue-400 shadow-sm">
                  <Train className="w-4 h-4" />
                </div>
              </div>

              {/* Active Running Trains */}
              <div className="backdrop-blur-md bg-white/70 dark:bg-[#0c1322]/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-sm hover:border-emerald-500/40 transition-all">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Traffic</span>
                  <h3 className="text-xl font-extrabold mt-1 text-emerald-600 dark:text-emerald-400 font-mono">{activeTrains.length}</h3>
                </div>
                <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-500 dark:text-emerald-400 shadow-sm">
                  <Activity className="w-4 h-4" />
                </div>
              </div>

              {/* Stopped/Station Trains */}
              <div className="backdrop-blur-md bg-white/70 dark:bg-[#0c1322]/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-sm hover:border-amber-500/40 transition-all">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dwell Status</span>
                  <h3 className="text-xl font-extrabold mt-1 text-amber-500 font-mono">{stoppedTrains.length}</h3>
                </div>
                <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-500 shadow-sm">
                  <MapPin className="w-4 h-4" />
                </div>
              </div>

              {/* Active Network Emergencies */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-sm transition-all duration-300 ${
                activeEmergencies > 0
                  ? 'bg-rose-500/10 border-rose-500/50 animate-pulse text-rose-500 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
                  : 'backdrop-blur-md bg-white/70 dark:bg-[#0c1322]/70 border-slate-200/80 dark:border-slate-800/80 hover:border-rose-500/30'
              }`}>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Emergencies</span>
                  <h3 className={`text-xl font-extrabold mt-1 font-mono ${activeEmergencies > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>{activeEmergencies}</h3>
                </div>
                <div className={`p-2.5 rounded-xl border ${activeEmergencies > 0 ? 'bg-rose-500/20 border-rose-500/30 text-rose-500' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className={`flex-1 grid grid-cols-12 gap-3 p-4 overflow-hidden min-h-0 ${mapFullView ? 'grid-cols-1' : ''}`}>
            {/* Center - Maps / VDU */}
            <div className={`${mapFullView ? 'col-span-12' : 'col-span-9'} flex flex-col gap-3 min-h-0 overflow-y-auto`}>
              {/* Railway Corridor Map / VDU Card */}
              <div className="backdrop-blur-md bg-white/80 dark:bg-[#0a0f1d]/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col flex-1 min-h-[400px] shadow-lg overflow-hidden">
                <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 flex-wrap gap-2.5 bg-gradient-to-r from-transparent via-slate-500/[0.02] to-transparent">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${selectedLineId === 'secr-raipur' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-blue-500/10 border-blue-500/30 text-blue-500'}`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                          {selectedLineId === 'secr-raipur'
                            ? 'South East Central Railway (SECR)'
                            : 'Central Railway (CR)'}
                        </h2>
                        {selectedLineId === 'secr-raipur' && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider shadow-sm">
                            ★ DRM Raipur Division HQ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedLineId === 'secr-raipur'
                          ? 'Durg Jn — Bhilai Power House — Raipur Junction (Main Part) — Tilda — Bhatapara — Bilaspur Jn'
                          : 'CSMT — Dadar — Kurla — Thane — Dombivli — Kalyan Corridor'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Corridor Selector */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => setSelectedLineId('secr-raipur')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedLineId === 'secr-raipur'
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400 border border-slate-950" />
                        SECR Raipur (DRM)
                      </button>
                      <button
                        onClick={() => setSelectedLineId('csmt-kalyan')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                          selectedLineId === 'csmt-kalyan'
                            ? 'bg-blue-600 text-white font-extrabold shadow-[0_0_12px_rgba(37,99,235,0.35)]'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-300 border border-slate-950" />
                        CR (CSMT-Kalyan)
                      </button>
                    </div>

                    <button
                      onClick={() => setMapFullView(!mapFullView)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200/60 dark:border-slate-800"
                      title={mapFullView ? 'Exit full view' : 'View full screen'}
                    >
                      {mapFullView ? (
                        <Minimize2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative min-h-[350px]">
                  <JsonCorridorMap
                    onTrainClick={handleTrainClick}
                    focusedTrainId={focusedTrainId}
                    focusedSectorId={focusedSectorId}
                    lineId={selectedLineId}
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
              <div className="backdrop-blur-md bg-white/80 dark:bg-[#0a0f1d]/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-1 flex gap-1 shadow-md overflow-x-auto flex-shrink-0">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'overview'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('trains')}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'trains'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <Train className="w-3.5 h-3.5" />
                  Trains
                </button>
                <button
                  onClick={() => setActiveTab('timetable')}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'timetable'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Timetable
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'logs'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Logs
                </button>
                <button
                  onClick={() => setActiveTab('controls')}
                  className={`flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'controls'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  Controls
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`relative flex-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ai'
                      ? 'bg-emerald-600 text-white font-bold shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                >
                  <Brain className="w-3.5 h-3.5 text-emerald-400" />
                  AI
                  {automaticAnalysis?.recommendations?.length ? (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  ) : null}
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-3">
              <div className="backdrop-blur-md bg-white/80 dark:bg-[#0c1322]/85 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  Live Section Metrics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Moving
                    </div>
                    <div className="text-lg font-extrabold font-mono text-emerald-500">
                      {activeTrains.length}
                    </div>
                  </div>
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                      Held / Dwell
                    </div>
                    <div className="text-lg font-extrabold font-mono text-amber-500">
                      {stoppedTrains.length}
                    </div>
                  </div>
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl transition-colors duration-300">
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                      Corridor Avg
                    </div>
                    <div className="text-lg font-extrabold font-mono text-slate-900 dark:text-white">
                      {avgSpeed.toFixed(1)} <span className="text-[10px] text-slate-400">kph</span>
                    </div>
                  </div>
                  <div className="text-center p-2.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-xl transition-colors duration-300">
                    <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                      Punctuality
                    </div>
                    <div className={`text-lg font-extrabold font-mono ${punctualityPct < 80 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {punctualityPct}%
                    </div>
                  </div>
                </div>
                {receiverStats && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
                    <span>Telemetry Sync</span>
                    <span>{new Date(receiverStats.lastUpdated).toLocaleTimeString()}</span>
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

