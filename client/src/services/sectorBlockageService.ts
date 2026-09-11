import axios from 'axios'
import { SectorBlockage } from '../types/simulation.types'

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

export interface SectorInfo {
  sector_id: string
  track_type: string
  from_station: string
  to_station: string
  next_station?: string
  index: number
  lengthMeters: number
}

export interface SectorBlockageRequest {
  sector_id: string
  status: 'blocked' | 'open'
  reason?: string
  reported_by?: string
}

export const reportSectorBlockage = async (
  request: SectorBlockageRequest
): Promise<SectorBlockage> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/status/sector-blockage`,
    request
  )
  return response.data.blockage
}

export const getBlockedSectors = async (): Promise<SectorBlockage[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/status/sector-blockages`)
  return response.data.blockages || []
}

export const removeBlockage = async (sectorId: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/api/status/sector-blockage/${sectorId}`)
}

export const getSectors = async (): Promise<SectorInfo[]> => {
  const response = await axios.get(`${API_BASE_URL}/api/status/sectors`)
  return response.data.sectors || []
}



