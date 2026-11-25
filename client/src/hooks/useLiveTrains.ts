import { useState, useEffect, useCallback, useRef } from "react";
import axiosInstance from "../utility/axiosInterceptor";
import { LiveTrainData, LiveTrainResponse } from "../types/liveTrains.types";

interface UseLiveTrainsOptions {
  /** Polling interval in milliseconds (default: 2000ms) */
  pollInterval?: number;
  /** Whether to enable automatic polling (default: true) */
  enabled?: boolean;
}

interface UseLiveTrainsReturn {
  /** Array of live train data */
  trains: LiveTrainData[];
  /** Total number of trains */
  totalTrains: number;
  /** Counts by train type */
  countByType: Record<string, number>;
  /** Last time data was updated */
  lastUpdated: Date | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and poll live train data from the receiver endpoint
 */
export function useLiveTrains(options: UseLiveTrainsOptions = {}): UseLiveTrainsReturn {
  const { pollInterval = 1000, enabled = true } = options;

  const [trains, setTrains] = useState<LiveTrainData[]>([]);
  const [totalTrains, setTotalTrains] = useState(0);
  const [countByType, setCountByType] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrains = useCallback(async () => {
    try {
      const response = await axiosInstance.get<LiveTrainResponse>("/receiver");
      
      if (response.data.success) {
        setTrains(response.data.trains);
        setTotalTrains(response.data.totalTrains);
        setCountByType(response.data.countByType);
        setLastUpdated(new Date(response.data.lastUpdated));
        setError(null);
      }
    } catch (err) {
      // Don't set error on network issues during polling - just skip this cycle
      if (isLoading) {
        setError(err instanceof Error ? err.message : "Failed to fetch train data");
      }
      console.warn("Failed to fetch live train data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchTrains();

    // Start polling
    intervalRef.current = setInterval(fetchTrains, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollInterval, fetchTrains]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchTrains();
  }, [fetchTrains]);

  return {
    trains,
    totalTrains,
    countByType,
    lastUpdated,
    isLoading,
    error,
    refresh,
  };
}
