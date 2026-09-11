import React, { useState, useEffect } from 'react'
import { AlertTriangle, MapPin } from 'lucide-react'
import { SectorBlockage } from '../../types/simulation.types'
import { getBlockedSectors, getSectors, type SectorInfo } from '../../services/sectorBlockageService'

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

interface BlockedSectorsListProps {
  onSectorClick?: (sectorId: string) => void
}

export const BlockedSectorsList: React.FC<BlockedSectorsListProps> = ({
  onSectorClick,
}) => {
  const [blockages, setBlockages] = useState<SectorBlockage[]>([])
  const [sectors, setSectors] = useState<SectorInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSectors()
    fetchBlockages()
    const interval = setInterval(fetchBlockages, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchSectors = async () => {
    try {
      const data = await getSectors()
      setSectors(data || [])
    } catch (error) {
      console.error('Failed to fetch sectors:', error)
    }
  }

  const fetchBlockages = async () => {
    try {
      const data = await getBlockedSectors()
      setBlockages(data || [])
    } catch (error) {
      console.error('Failed to fetch blockages:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
          Blocked Sectors ({blockages.length})
        </h3>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
          Loading...
        </div>
      ) : blockages.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <div>No blocked sectors</div>
          <div className="text-[10px] mt-1">All sectors are operational</div>
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
          {blockages.map((blockage) => {
            const sectorInfo = sectors.find((s) => s.sector_id === blockage.sector_id)
            return (
              <div
                key={blockage.id}
                className="bg-red-50 dark:bg-red-900/30 rounded p-2.5 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                onClick={() => {
                  if (onSectorClick) {
                    onSectorClick(blockage.sector_id)
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-semibold text-red-800 dark:text-red-200 font-mono break-words">
                        {blockage.sector_id}
                      </span>
                    </div>
                    {sectorInfo && (
                      <div className="text-xs text-red-700 dark:text-red-300 mb-1">
                        <div className="font-medium">
                          {sectorInfo.from_station} → {sectorInfo.to_station}
                        </div>
                        <div className="text-red-600 dark:text-red-400">
                          {sectorInfo.track_type} • {sectorInfo.lengthMeters.toFixed(0)}m
                        </div>
                      </div>
                    )}
                    {blockage.reason && (
                      <div className="text-xs text-red-600 dark:text-red-400 italic mt-1 break-words">
                        {blockage.reason}
                      </div>
                    )}
                    <div className="text-[10px] text-red-500 dark:text-red-500/70 mt-1.5">
                      Blocked: {new Date(blockage.timestamp).toLocaleString()}
                    </div>
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



