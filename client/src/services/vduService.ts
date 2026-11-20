import axios from 'axios'

const getApiBase = () => {
  const env = import.meta.env.VITE_SERVER_URL
  if (env && typeof env === 'string' && env.startsWith('http')) return env
  return 'http://localhost:3000'
}

export interface PlatformState {
  id: string
  station: string
  number: number
  name: string
  length_m: number
  line_type: 'main' | 'loop' | 'goods'
  occupied_by: string | null
  state: 'clear' | 'occupied' | 'reserved' | 'blocked'
  reserved_for?: string
  eta_min?: number
}

export interface PointMachine {
  id: string
  station: string
  label: string
  position: 'Normal' | 'Reverse'
  detection: 'detected' | 'not_detected'
  status: 'healthy' | 'fault' | 'under_maintenance'
  operated_at?: string
}

export interface AxleCounter {
  id: string
  station: string
  section_label: string
  state: 'clear' | 'occupied' | 'reset_required' | 'failed'
  train_id: string | null
  count_in: number
  count_out: number
}

export interface SignalAspect {
  id: string
  station: string
  label: string
  type: 'home' | 'starter' | 'advanced_starter' | 'distant' | 'shunt'
  aspect: 'green' | 'yellow' | 'double_yellow' | 'red' | 'shunt_clear'
  speed_kmh: number | null
  direction: 'up' | 'down'
  platform?: number
}

export interface VduSnapshot {
  timestamp: string
  simulated: true
  corridor: string
  platforms: PlatformState[]
  pointMachines: PointMachine[]
  axleCounters: AxleCounter[]
  signals: SignalAspect[]
  activePlatformCount: number
  faultCount: number
  occupiedAxleCount: number
}

export async function fetchVduSnapshot(corridor: string): Promise<VduSnapshot> {
  const res = await axios.get(`${getApiBase()}/api/status/vdu-snapshot`, {
    params: { corridor },
  })
  return res.data as VduSnapshot
}
