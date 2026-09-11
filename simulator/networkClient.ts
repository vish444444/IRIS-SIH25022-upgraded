import { TrainState } from "./trainSimulator";
import { TrainType } from "./timetableLoader";

export interface ReceiverPayload {
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  type: TrainType;
  line_id: "csmt-kalyan" | "csmt-panvel";
  destination: string;
  timestamp: number;
  // Track allocation info
  trackType?: string; // e.g., "up_slow", "down_fast"
  trackVariant?: string; // e.g., "up_slow_1", "up_slow_2" for split tracks
  laneIndex?: number; // 0-based lane index
  laneCount?: number; // total lanes for the segment
  sectorId?: string; // active sector occupancy identifier
}

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";
const RECEIVER_ENDPOINT = `${API_BASE_URL}/api/receiver`;

/**
 * Converts TrainState to ReceiverPayload
 */
export function trainStateToPayload(state: TrainState, simTime?: number): ReceiverPayload {
  return {
    train_id: state.train_id,
    lat: state.lat,
    lng: state.lng,
    speed: Math.round(state.speed * 100) / 100, // Round to 2 decimal places
    type: state.type,
    line_id: "csmt-kalyan",
    destination: state.destination,
    timestamp: simTime || Date.now(),
    trackType: state.trackType,
    trackVariant: state.trackVariant,
    laneIndex: state.laneIndex,
    laneCount: state.laneCount,
    sectorId: state.sectorId,
  };
}

/**
 * Sends train data to the receiver API
 */
export async function sendTrainData(state: TrainState, simTime?: number): Promise<boolean> {
  const payload = trainStateToPayload(state, simTime);

  try {
    const response = await fetch(RECEIVER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[NetworkClient] Failed to send train ${state.train_id}: ${response.status} - ${errorText}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `[NetworkClient] Error sending train ${state.train_id}:`,
      error
    );
    return false;
  }
}

/**
 * Sends multiple train states to the receiver API
 * Returns the number of successful sends
 */
export async function sendAllTrainData(
  states: Map<string, TrainState>,
  simTime?: number
): Promise<{ success: number; failed: number }> {
  const promises: Promise<boolean>[] = [];

  for (const state of states.values()) {
    promises.push(sendTrainData(state, simTime));
  }

  const results = await Promise.all(promises);
  const success = results.filter((r) => r).length;
  const failed = results.filter((r) => !r).length;

  return { success, failed };
}

/**
 * Batch send train data with retry logic
 */
export async function sendBatchWithRetry(
  states: Map<string, TrainState>,
  simTime?: number,
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<{ success: number; failed: number }> {
  let attempt = 0;
  let lastResult = { success: 0, failed: 0 };

  while (attempt < maxRetries) {
    lastResult = await sendAllTrainData(states, simTime);

    if (lastResult.failed === 0) {
      return lastResult;
    }

    attempt++;
    if (attempt < maxRetries) {
      console.log(
        `[NetworkClient] Retry ${attempt}/${maxRetries} after ${lastResult.failed} failures`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return lastResult;
}

/**
 * Health check for the receiver API
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/receiver`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Returns the backend's current blocked-sector snapshot for the simulator. */
export async function getBlockedSectorIds(): Promise<Set<string>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status/sector-blockages`);
    if (!response.ok) return new Set();
    const data = (await response.json()) as { blockages?: Array<{ sector_id: string }> };
    return new Set((data.blockages || []).map((blockage) => blockage.sector_id));
  } catch {
    return new Set();
  }
}

export default {
  sendTrainData,
  sendAllTrainData,
  sendBatchWithRetry,
  checkApiHealth,
  getBlockedSectorIds,
  trainStateToPayload,
};
