import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import {
  reportSectorBlockage,
  removeBlockage,
  getBlockedSectors,
  type SectorBlockageRequest,
} from '../../services/sectorBlockageService'
import { SectorBlockage } from '../../types/simulation.types'

interface SectorBlockageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectorId: string
  sectorInfo?: {
    from_station: string
    to_station: string
    track_type: string
  }
  onSuccess?: () => void
}

export const SectorBlockageDialog: React.FC<SectorBlockageDialogProps> = ({
  open,
  onOpenChange,
  sectorId,
  sectorInfo,
  onSuccess,
}) => {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockageInfo, setBlockageInfo] = useState<SectorBlockage | null>(null)

  useEffect(() => {
    if (open) {
      checkBlockageStatus()
    }
  }, [open, sectorId])

  const checkBlockageStatus = async () => {
    try {
      const blockages = await getBlockedSectors()
      const blockage = blockages.find((b) => b.sector_id === sectorId)
      setIsBlocked(!!blockage)
      setBlockageInfo(blockage || null)
    } catch (error) {
      console.error('Failed to check blockage status:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const request: SectorBlockageRequest = {
        sector_id: sectorId,
        status: 'blocked',
        reason: reason.trim() || undefined,
      }

      await reportSectorBlockage(request)
      setReason('')
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to report sector blockage')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setLoading(true)
    setError(null)

    try {
      await removeBlockage(sectorId)
      setReason('')
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove sector blockage')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setReason('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isBlocked ? 'Remove Sector Blockage' : 'Report Sector Blockage'}
          </DialogTitle>
          <DialogDescription>
            {isBlocked ? (
              <>
                Sector <span className="font-mono text-xs">{sectorId}</span> is currently blocked
                {sectorInfo && (
                  <>
                    {' '}
                    ({sectorInfo.from_station} → {sectorInfo.to_station}, {sectorInfo.track_type})
                  </>
                )}
                {blockageInfo?.reason && (
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Reason: {blockageInfo.reason}
                  </div>
                )}
              </>
            ) : (
              <>
                Report that sector <span className="font-mono text-xs">{sectorId}</span> is blocked
                {sectorInfo && (
                  <>
                    {' '}
                    ({sectorInfo.from_station} → {sectorInfo.to_station}, {sectorInfo.track_type})
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {isBlocked ? (
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Click the button below to remove the blockage and reopen this sector.
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-500 rounded hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Removing...' : 'Remove Blockage'}
              </button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Reason (optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded text-sm resize-none"
                  rows={3}
                  placeholder="e.g., Maintenance work, Track repair, Signal failure..."
                />
              </div>
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-2 rounded border border-red-200 dark:border-red-800">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 dark:bg-red-500 rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Reporting...' : 'Report Blockage'}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

