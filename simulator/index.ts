import { loadTimetable, loadSecrTimetable, TrainEntry } from "./timetableLoader";
import { loadStations, loadSecrStations, buildTrackGraph, TrackGraph } from "./trackBuilder";
import { simulateAllTrains, TrainState } from "./trainSimulator";
import { sendAllTrainData, checkApiHealth, getBlockedSectorIds } from "./networkClient";

// Configuration
const SIMULATION_INTERVAL_MS = 1000; // 1s high-precision telemetry cycle
const API_URL = process.env.API_URL || "http://localhost:3000/api/receiver";

// Simulation state
let trains: TrainEntry[] = [];
let secrTrains: TrainEntry[] = [];
let trackGraph: TrackGraph;
let secrTrackGraph: TrackGraph;
let trainStates: Map<string, TrainState> = new Map();
let secrTrainStates: Map<string, TrainState> = new Map();
let simulationTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let tickCount = 0;

// Continuous integrated simulated clock (so dynamic speed changes never jump!)
let startHour = 6;
let startMinute = 15; // Start at 06:15 AM so both CR and SECR have dense active trains immediately
let simTimeMs = 0;
let lastRealTickMs = Date.now();
let simulationSpeedMultiplier = 5;
let lastResetGeneration = 0;
let blockedSectorIds: Set<string> = new Set();

function resetSimulationClock(hour: number = startHour, minute: number = startMinute): void {
  const baseDate = new Date();
  baseDate.setHours(hour, minute, 0, 0);
  simTimeMs = baseDate.getTime();
  lastRealTickMs = Date.now();

  const midnightBase = new Date();
  midnightBase.setHours(0, 0, 0, 0);
  trains = loadTimetable(midnightBase);
  try {
    secrTrains = loadSecrTimetable(midnightBase);
  } catch (err) {
    console.warn("[Reset] SECR timetable not loaded:", err);
  }
  trainStates = new Map();
  secrTrainStates = new Map();
}

function getSimulationTime(): Date {
  return new Date(simTimeMs);
}

interface ControlSnapshot {
  running: boolean;
  speedMultiplier?: number;
  resetGeneration?: number;
}

async function fetchControlState(): Promise<ControlSnapshot> {
  try {
    const response = await fetch(API_URL.replace("/receiver", "/receiver/control"));
    if (response.ok) {
      const data = (await response.json()) as any;
      return {
        running: data.running !== false,
        speedMultiplier: typeof data.speedMultiplier === "number" ? data.speedMultiplier : undefined,
        resetGeneration: typeof data.resetGeneration === "number" ? data.resetGeneration : undefined,
      };
    }
  } catch {
    // Default running if API briefly restarting
  }
  return { running: true };
}

async function initialize(): Promise<void> {
  console.log("=".repeat(60));
  console.log("IRIS Multi-Corridor Railway Traffic Simulator (CR + SECR)");
  console.log("=".repeat(60));

  console.log("[Init] Loading Central Railway stations...");
  const stationsData = loadStations();
  trackGraph = buildTrackGraph(stationsData);

  console.log("[Init] Loading SECR Raipur Division stations...");
  try {
    const secrStationsData = loadSecrStations();
    secrTrackGraph = buildTrackGraph(secrStationsData);
  } catch (err) {
    console.warn("[Init] SECR stations not loaded:", err);
  }

  resetSimulationClock(startHour, startMinute);
  console.log(`[Init] Start clock: ${getSimulationTime().toLocaleTimeString()} | Speed: ${simulationSpeedMultiplier}x`);

  const apiHealthy = await checkApiHealth();
  if (!apiHealthy) {
    console.warn(`[Init] API at ${API_URL} not responding yet; will retry on ticks.`);
  } else {
    console.log("[Init] ✓ API is healthy");
  }
}

async function tick(): Promise<void> {
  const nowRealMs = Date.now();
  const realDeltaSec = Math.max(0.1, Math.min(5, (nowRealMs - lastRealTickMs) / 1000));
  lastRealTickMs = nowRealMs;

  const control = await fetchControlState();
  if (typeof control.speedMultiplier === "number" && control.speedMultiplier !== simulationSpeedMultiplier) {
    simulationSpeedMultiplier = control.speedMultiplier;
    console.log(`[Control] Playback speed updated to ${simulationSpeedMultiplier}x`);
  }

  if (typeof control.resetGeneration === "number" && control.resetGeneration > lastResetGeneration) {
    lastResetGeneration = control.resetGeneration;
    resetSimulationClock(startHour, startMinute);
    console.log(`[Control] Simulation reset to ${getSimulationTime().toLocaleTimeString()}`);
  }

  if (!control.running) {
    if (tickCount % 15 === 0) {
      console.log("[Simulator] Paused via Control Panel");
    }
    return;
  }

  tickCount++;
  const simulatedDtSec = realDeltaSec * simulationSpeedMultiplier;
  simTimeMs += simulatedDtSec * 1000;
  const currentTime = getSimulationTime();

  blockedSectorIds = await getBlockedSectorIds();

  // Central Railway (CR)
  const newCrStates = simulateAllTrains(
    trains,
    currentTime,
    trackGraph,
    trainStates,
    simulatedDtSec,
    blockedSectorIds
  );
  trainStates = newCrStates;

  // South East Central Railway (SECR Raipur Division)
  const combinedStates = new Map<string, TrainState>(newCrStates);
  if (secrTrackGraph && secrTrains.length > 0) {
    const newSecrStates = simulateAllTrains(
      secrTrains,
      currentTime,
      secrTrackGraph,
      secrTrainStates,
      simulatedDtSec,
      blockedSectorsWithFallback(blockedSectorIds)
    );
    secrTrainStates = newSecrStates;
    for (const [id, st] of newSecrStates.entries()) {
      combinedStates.set(id, st);
    }
  }

  // Loop back seamlessly once morning rush completes (after 09:00 with no active trains)
  if (currentTime.getHours() >= 9 && combinedStates.size === 0) {
    console.log(`[Simulator] Morning traffic cycle complete. Looping smoothly to ${startHour}:${String(startMinute).padStart(2, '0')} AM...`);
    resetSimulationClock(startHour, startMinute);
    return;
  }

  if (tickCount % 20 === 0) {
    const movingCount = Array.from(combinedStates.values()).filter((s) => s.speed > 0).length;
    console.log(
      `[Tick ${tickCount}] ${currentTime.toLocaleTimeString()} (${simulationSpeedMultiplier}x) | Active: ${combinedStates.size} (CR:${trainStates.size}, SECR:${secrTrainStates.size}) | Moving: ${movingCount} | Blocked: ${blockedSectorIds.size}`
    );
  }

  if (combinedStates.size > 0) {
    await sendAllTrainData(combinedStates, simTimeMs);
  }
}

function blockedSectorsWithFallback(set: Set<string>): Set<string> {
  return set;
}

function start(): void {
  if (isRunning) return;
  isRunning = true;
  lastRealTickMs = Date.now();
  simulationTimer = setInterval(async () => {
    try {
      await tick();
    } catch (error) {
      console.error("[Simulator] Tick error:", error);
    }
  }, SIMULATION_INTERVAL_MS);
  console.log(`[Simulator] Running 1000ms telemetry loop at ${simulationSpeedMultiplier}x`);
}

function stop(): void {
  if (!isRunning) return;
  isRunning = false;
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n[Simulator] Received ${signal}, shutting down...`);
    stop();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith("--speed=")) {
      simulationSpeedMultiplier = parseFloat(arg.split("=")[1]) || 5;
    }
    if (arg.startsWith("--start-hour=")) {
      const hour = parseInt(arg.split("=")[1], 10);
      if (hour >= 0 && hour <= 23) startHour = hour;
    }
    if (arg.startsWith("--start-minute=")) {
      const minute = parseInt(arg.split("=")[1], 10);
      if (minute >= 0 && minute <= 59) startMinute = minute;
    }
  }

  setupGracefulShutdown();
  try {
    await initialize();
    start();
  } catch (error) {
    console.error("[Simulator] Fatal error during initialization:", error);
    process.exit(1);
  }
}

export { initialize, start, stop, tick, getSimulationTime, trainStates };
main();
