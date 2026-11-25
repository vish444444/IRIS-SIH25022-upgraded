import axios from 'axios'

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

const API_BASE_URL = getApiBaseUrl()

export interface ConflictTrainInput {
  train_id: string
  resource_id: string
  priority: number
  requested_entry_sec: number
  transit_seconds: number
  max_hold_seconds?: number
  reroute_available?: boolean
  reroute_extra_seconds?: number
  prediction?: DelayPredictionInput
  current_delay_min?: number
  scheduled_destination_arrival_sec?: number
}

export interface DelayPredictionInput {
  current_delay_min?: number
  train_type?: string
  priority?: number
  current_speed_kmh?: number
  previous_speed_kmh?: number
  dwell_time_sec?: number
  distance_to_next_km?: number
  section_occupancy?: number
  trains_ahead?: number
  platform_available?: boolean
  disruption_active?: boolean
  scheduled_headway_sec?: number
}

export interface RecommendationImpact {
  total_weighted_delay_sec: number
  total_weighted_delay_min: number
  travel_time_penalty_sec: number
  per_train: Record<string, { entry_sec: number; hold_sec: number; rerouted: boolean; predicted_delay_min?: number; predicted_destination_delay_min?: number; destination_eta_sec?: number }>
}

export interface AIRecommendation {
  rank: number
  label: string
  what_happened: string
  conflict: any
  trains_involved: string[]
  held_trains: string[]
  proceeding_trains: string[]
  why_this_recommendation: string
  expected_impact: RecommendationImpact
  safety_status: 'PASS' | 'FAIL'
  safety_explanation: string
  if_rejected: string
  recommendation_score: number
  predicted_delay_by_train: Record<string, number>
}

export interface AIStatus {
  success: boolean
  service: string
  status: string
  model_loaded: boolean
  model_metrics: Record<string, any> | null
  components: Record<string, string>
  recommendations_logged: number
  optimization_runs_logged: number
}

const authHeaders = () => {
  const token = localStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const getAIStatus = async (): Promise<AIStatus> => {
  const res = await axios.get(`${API_BASE_URL}/api/ai/status`)
  return res.data
}

export const getRecommendation = async (
  conflictTrains: ConflictTrainInput[],
  options: {
    blockedSectors?: string[]
    singleLineSections?: string[]
    sectionSpeedLimits?: Record<string, number>
  } = {}
): Promise<{ recommendation_id: string; saved_recommendation_id?: string; runtime_sec: number; recommendations: AIRecommendation[] }> => {
  const res = await axios.post(
    `${API_BASE_URL}/api/ai/recommend`,
    {
      conflict_trains: conflictTrains,
      blocked_sectors: options.blockedSectors || [],
      single_line_sections: options.singleLineSections || [],
      section_speed_limits: options.sectionSpeedLimits || {},
    },
    { headers: authHeaders() }
  )
  return res.data
}

export const decideRecommendation = async (
  id: string,
  decision: 'approved' | 'rejected'
): Promise<any> => {
  const res = await axios.post(
    `${API_BASE_URL}/api/ai/recommendations/${id}/decide`,
    { decision },
    { headers: authHeaders() }
  )
  return res.data
}

export const requestOverride = async (payload: {
  plans: any[]
  blocked_sectors?: string[]
  single_line_sections?: string[]
  section_speed_limits?: Record<string, number>
  reason?: string
  original_recommendation_id?: string
}): Promise<{ override_allowed: boolean; reasons: string[] }> => {
  const res = await axios.post(`${API_BASE_URL}/api/ai/override`, payload, {
    headers: authHeaders(),
    validateStatus: (status) => (status >= 200 && status < 300) || status === 409,
  })
  return res.data
}

export interface WhatIfTrainInput {
  train_id: string
  resource_id: string
  priority: number
  requested_entry_sec: number
  transit_seconds: number
  prediction?: DelayPredictionInput
}

export const runWhatIf = async (
  scenarioName: string,
  trains: WhatIfTrainInput[]
): Promise<any> => {
  const res = await axios.post(
    `${API_BASE_URL}/api/ai/what-if`,
    { scenario_name: scenarioName, trains },
    { headers: authHeaders() }
  )
  return res.data
}

export const getRecommendationsHistory = async (limit = 20): Promise<any> => {
  const res = await axios.get(`${API_BASE_URL}/api/ai/recommendations?limit=${limit}`, {
    headers: authHeaders(),
  })
  return res.data
}

export const getOptimizationRunsHistory = async (limit = 20): Promise<any> => {
  const res = await axios.get(`${API_BASE_URL}/api/ai/optimization-runs?limit=${limit}`, {
    headers: authHeaders(),
  })
  return res.data
}

export const createDisruption = async (payload: {
  disruption_type: string
  resource_id?: string
  description?: string
}): Promise<any> => {
  const res = await axios.post(`${API_BASE_URL}/api/ai/disruptions`, payload, {
    headers: authHeaders(),
  })
  return res.data
}
