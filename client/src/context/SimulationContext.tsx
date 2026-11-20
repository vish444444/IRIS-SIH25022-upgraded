import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SimulationUpdate, TrainUpdate, PipelineUpdate, EmergencyEvent, Forecast, TrackClosure, TrainState } from "../types/simulation.types";
import { ConflictTrainInput, getRecommendation, AIRecommendation } from "../services/aiService";
import axios from "axios";
// pushAllTrainsToReceiver removed: frontend should not POST to receiver

interface SimulationContextType {
  update: SimulationUpdate | null;
  trains: Map<string, TrainUpdate>;
  pipelines: Map<string, PipelineUpdate>;
  emergencyEvents: EmergencyEvent[];
  forecasts: Forecast[];
  trackClosures: TrackClosure[];
  isConnected: boolean;
  automaticAnalysis: {
    conflictTrains: ConflictTrainInput[];
    recommendations: AIRecommendation[];
    recommendationId?: string;
    runtimeSec?: number;
    updatedAt: Date;
  } | null;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within SimulationProvider");
  }
  return context;
};

interface SimulationProviderProps {
  children: ReactNode;
  serverUrl: string;
}

const getApiBaseUrl = (serverUrl: string | undefined | null): string => {
  if (!serverUrl || typeof serverUrl !== "string") {
    return "http://localhost:3000";
  }
  const trimmed = serverUrl.trim();
  if (trimmed === "" || trimmed === "undefined" || trimmed === "serverurl" || trimmed === "null") {
    return "http://localhost:3000";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return "http://localhost:3000";
};

export const SimulationProvider: React.FC<SimulationProviderProps> = ({ children, serverUrl }) => {
  const [update, setUpdate] = useState<SimulationUpdate | null>(null);
  const [trains, setTrains] = useState<Map<string, TrainUpdate>>(new Map());
  const [pipelines, setPipelines] = useState<Map<string, PipelineUpdate>>(new Map());
  const [emergencyEvents, setEmergencyEvents] = useState<EmergencyEvent[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [trackClosures, setTrackClosures] = useState<TrackClosure[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [automaticAnalysis, setAutomaticAnalysis] = useState<SimulationContextType['automaticAnalysis']>(null);
  const analysisCooldown = React.useRef(new Map<string, number>());

  useEffect(() => {
    console.log("SimulationProvider useEffect - serverUrl:", serverUrl, "type:", typeof serverUrl);
    const apiUrl = getApiBaseUrl(serverUrl);
    console.log("SimulationProvider - apiUrl after getApiBaseUrl:", apiUrl);
    
    // Validate URL before making requests
    if (!apiUrl || typeof apiUrl !== "string" || (!apiUrl.startsWith("http://") && !apiUrl.startsWith("https://"))) {
      console.error("Invalid API URL constructed:", apiUrl, "from serverUrl:", serverUrl);
      setIsConnected(false);
      return;
    }

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const fetchSimulationState = async () => {
      try {
        // Ensure apiUrl doesn't end with a slash to avoid double slashes
        const cleanApiUrl = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
        const fullUrl = `${cleanApiUrl}/api/receiver`;
        console.log("Fetching train data from:", fullUrl);
        
        // Final validation using URL constructor
        try {
          const urlObj = new URL(fullUrl);
          console.log("URL validation passed:", urlObj.href);
        } catch (urlError) {
          console.error("URL validation failed:", urlError);
          console.error("Invalid URL constructed:", fullUrl, "from apiUrl:", cleanApiUrl, "serverUrl:", serverUrl);
          if (isMounted) {
            setIsConnected(false);
          }
          return;
        }
        
        const response = await axios.get(fullUrl);
        
        if (!isMounted) return;

        const receiverData = response.data;
        const receiverTrains = receiverData.trains || [];
        
        // Convert receiver train data to TrainUpdate format
        const trains: TrainUpdate[] = receiverTrains.map((train: any) => {
          // Determine state based on speed - if speed is 0 or very low, train is stopped
          const speedKmh = train.speed || 0;
          const speedMs = speedKmh / 3.6;
          const isMoving = train.isMoving !== undefined ? train.isMoving : speedKmh > 0.5;
          
          // Map to TrainState enum
          let state: TrainState = TrainState.STOPPED;
          if (isMoving && speedKmh > 5) {
            state = TrainState.CRUISING;
          } else if (isMoving && speedKmh > 0.5) {
            state = TrainState.ACCELERATING;
          } else if (speedKmh === 0) {
            state = TrainState.STOPPED;
          }
          
          return {
            id: train.train_id,
            position: 0, // Not available from receiver
            speed: speedMs,
            currentPipeline: train.sectorId || '',
            nextPipeline: null,
            state,
            gps: {
              latitude: train.lat,
              longitude: train.lng,
              speed: speedKmh,
            },
            delay: 0, // Can be calculated from timetable if needed
            recommendedSpeed: 0,
            trainType: train.type,
            destination: train.destination,
            currentSection: train.sectorId || '',
            nextSection: null,
            currentPosition: { latitude: train.lat, longitude: train.lng },
            previousSpeed: train.speedHistory?.length > 1
              ? train.speedHistory[train.speedHistory.length - 2].speed
              : speedKmh,
            disruptionActive: false,
            class: train.type === 'ac' ? 'AC Local' : train.type === 'womens' ? 'Ladies Special' : train.type === 'fast' ? 'Fast Local' : undefined,
          };
        });
        
        const maxTimestamp = receiverTrains.length > 0
          ? Math.max(...receiverTrains.map((t: any) => t.timestamp || 0))
          : 0;

        const simulationTime = maxTimestamp > 0
          ? new Date(maxTimestamp)
          : (() => {
              const d = new Date();
              d.setHours(6, 0, 0, 0);
              return d;
            })();

        const simulationUpdate: SimulationUpdate = {
          trains,
          pipelines: [], // Not available from receiver
          emergencyEvents: [], // Not available from receiver
          forecasts: [], // Not available from receiver
          trackClosures: [], // Not available from receiver
          currentTime: simulationTime,
        };

        setUpdate(simulationUpdate);
        setIsConnected(true);

        const trainsMap = new Map<string, TrainUpdate>();
        trains.forEach((train) => {
          trainsMap.set(train.id, train);
        });
        setTrains(trainsMap);

        const contenders = Array.from(trainsMap.values()).filter(
          (train) => (train.currentSection || train.currentPipeline) && train.state !== TrainState.SCHEDULED
        );
        const bySection = new Map<string, TrainUpdate[]>();
        contenders.forEach((train) => {
          const key = train.currentSection || train.currentPipeline?.split('_')[0] || 'MAIN';
          const group = bySection.get(key) || [];
          group.push(train);
          bySection.set(key, group);
        });
        const conflictGroup = Array.from(bySection.values()).find((group) => group.length > 1);
        if (conflictGroup) {
          const getPriority = (id: string, trainClass?: string): number => {
            const upper = id.toUpperCase();
            if (upper.includes('VB') || upper.includes('VANDE')) return 1;
            if (upper.includes('EXP') || upper.includes('INT') || trainClass === 'Fast Local') return 2;
            if (upper.includes('MEMU') || trainClass === 'Slow Local') return 3;
            if (upper.includes('COAL') || upper.includes('STEEL') || upper.includes('FREIGHT')) return 4;
            return 3;
          };

          const conflictTrains: ConflictTrainInput[] = conflictGroup.map((train, index) => ({
            train_id: train.id,
            resource_id: train.currentSection || train.currentPipeline?.split('_')[0] || 'JUNCTION',
            priority: getPriority(train.id, train.class),
            requested_entry_sec: index * 30,
            transit_seconds: 90,
            prediction: {
              current_delay_min: train.delay || 0,
              current_speed_kmh: train.gps?.speed || train.speed * 3.6 || 0,
              previous_speed_kmh: train.previousSpeed || train.gps?.speed || 0,
              section_occupancy: 1,
              trains_ahead: index,
              disruption_active: train.disruptionActive || false,
            },
            current_delay_min: train.delay || 0,
          }));
          const signature = conflictTrains.map((train) => `${train.train_id}:${train.resource_id}`).sort().join('|');
          const lastRun = analysisCooldown.current.get(signature) || 0;
          if (Date.now() - lastRun > 30000) {
            analysisCooldown.current.set(signature, Date.now());
            getRecommendation(conflictTrains)
              .then((result) => {
                if (isMounted) {
                  setAutomaticAnalysis({
                    conflictTrains,
                    recommendations: result.recommendations,
                    recommendationId: result.saved_recommendation_id || result.recommendation_id,
                    runtimeSec: result.runtime_sec,
                    updatedAt: new Date(),
                  });
                }
              })
              .catch((error) => console.error('Automatic traffic analysis failed:', error));
          }
        }

        // Pipelines, forecasts not available from receiver
        setPipelines(new Map());
        setForecasts([]);
        setTrackClosures([]);
        
        // Fetch emergency events from logs
        try {
          // Fetch emergency events from logs - fetch all logs and filter
          const logsResponse = await axios.get(`${cleanApiUrl}/api/receiver/logs`, {
            params: {
              limit: 200, // Get more logs to find emergencies
            },
          });
          
          if (logsResponse.data.success && logsResponse.data.logs) {
            // Filter for emergency_detected events
            const emergencyLogs = logsResponse.data.logs.filter((log: any) => {
              return log.eventType === 'emergency_detected';
            });
            
            // Check for resolved emergencies
            const resolvedResponse = await axios.get(`${cleanApiUrl}/api/receiver/logs`, {
              params: {
                eventType: 'emergency_resolved',
                limit: 100,
              },
            });
            
            const resolvedIds = new Set<string>();
            if (resolvedResponse.data.success && resolvedResponse.data.logs) {
              resolvedResponse.data.logs.forEach((log: any) => {
                // Extract emergency ID from metadata or description
                if (log.metadata?.emergencyId) {
                  resolvedIds.add(log.metadata.emergencyId);
                }
              });
            }
            
            // Convert logs to EmergencyEvent format
            const emergencies: EmergencyEvent[] = emergencyLogs
              .filter((log: any) => {
                // Filter out resolved emergencies
                const emergencyId = log.metadata?.emergencyId || log.id;
                return !resolvedIds.has(emergencyId);
              })
              .map((log: any) => {
                const emergencyId = log.metadata?.emergencyId || log.id;
                const emergencyType = log.metadata?.type || 'unknown';
                const pipelineId = log.metadata?.pipelineId || log.metadata?.destination || '';
                
                return {
                  id: emergencyId,
                  trainId: log.trainId,
                  pipelineId: pipelineId,
                  timestamp: new Date(log.timestamp),
                  reason: log.description || log.metadata?.reason || 'Emergency detected',
                  type: emergencyType as EmergencyEvent['type'],
                  resolved: false,
                };
              });
            
            if (isMounted) {
              setEmergencyEvents(emergencies);
              if (emergencies.length > 0) {
                console.log(`[Emergency] Found ${emergencies.length} active emergencies:`, emergencies);
              }
            }
          } else {
            if (isMounted) {
              setEmergencyEvents([]);
            }
          }
        } catch (error) {
          console.error('Failed to fetch emergency events:', error);
          if (isMounted) {
            setEmergencyEvents([]);
          }
        }
      } catch (error) {
        if (isMounted) {
          setIsConnected(false);
          console.error("Failed to fetch train data:", error);
        }
      }
    };

    fetchSimulationState();
    pollInterval = setInterval(fetchSimulationState, 1000);

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [serverUrl]);

  return (
    <SimulationContext.Provider
      value={{
        update,
        trains,
        pipelines,
        emergencyEvents,
        forecasts,
        trackClosures,
        isConnected,
        automaticAnalysis,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};
