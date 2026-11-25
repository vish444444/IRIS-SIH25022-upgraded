import { TrainState, SignalAspect } from "./trainSimulator";
import { TrainType } from "./timetableLoader";

export interface ReceiverPayload {
  train_id: string;
  lat: number;
  lng: number;
  speed: number;
  type: TrainType;
  line_id: "csmt-kalyan" | "csmt-panvel" | "secr-raipur";
  destination: string;
  timestamp: number;
  trackType?: string;
  trackVariant?: string;
  laneIndex?: number;
  laneCount?: number;
  sectorId?: string;
  delaySeconds?: number;
  signalAspect?: SignalAspect;
  currentStation?: string;
  nextStation?: string;
  progress?: number;
  stateReason?: string;
}

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";
const RECEIVER_ENDPOINT = `${API_BASE_URL}/api/receiver`;

export function trainStateToPayload(state: TrainState, simTime?: number): ReceiverPayload {
  return {
    train_id: state.train_id,
    lat: state.lat,
    lng: state.lng,
    speed: Math.round(state.speed * 100) / 100,
    type: state.type,
    line_id: (state.line_id || (state.train_id.startsWith("SECR") ? "secr-raipur" : "csmt-kalyan")) as any,
    destination: state.destination,
    timestamp: simTime || Date.now(),
    trackType: state.trackType,
    trackVariant: state.trackVariant,
    laneIndex: state.laneIndex,
    laneCount: state.laneCount,
    sectorId: state.sectorId,
    delaySeconds: state.delaySeconds ?? 0,
    signalAspect: state.signalAspect ?? "GREEN",
    currentStation: state.currentStation,
    nextStation: state.nextStation,
    progress: state.progress,
    stateReason: state.stateReason,
  };
}

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
    console.error(`[NetworkClient] Error sending train ${state.train_id}:`, error);
    return false;
  }
}

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

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/receiver`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

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
  checkApiHealth,
  getBlockedSectorIds,
};
