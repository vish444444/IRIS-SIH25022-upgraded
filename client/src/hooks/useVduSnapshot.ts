import { useState, useEffect, useRef } from 'react'
import { fetchVduSnapshot, VduSnapshot } from '../services/vduService'

export function useVduSnapshot(corridor: string, intervalMs = 2000) {
  const [snapshot, setSnapshot] = useState<VduSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      try {
        const data = await fetchVduSnapshot(corridor)
        if (isMounted.current) {
          setSnapshot(data)
          setError(null)
          setLoading(false)
        }
      } catch (e: any) {
        if (isMounted.current) {
          setError(e?.message || 'VDU fetch error')
          setLoading(false)
        }
      }
      if (isMounted.current) {
        timer = setTimeout(poll, intervalMs)
      }
    }

    poll()
    return () => {
      isMounted.current = false
      clearTimeout(timer)
    }
  }, [corridor, intervalMs])

  return { snapshot, loading, error }
}
