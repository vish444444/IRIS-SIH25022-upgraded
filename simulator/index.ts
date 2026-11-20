import { loadTimetable, loadSecrTimetable, TrainEntry } from "./timetableLoader";
import { loadStations, loadSecrStations, buildTrackGraph, TrackGraph } from "./trackBuilder";
import { simulateAllTrains, TrainState } from "./trainSimulator";
import { sendAllTrainData, checkApiHealth, getBlockedSectorIds } from "./networkClient";

// Configuration
const SIMULATION_INTERVAL_MS = 2000; // 2 seconds
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

// Base date for simulation - we'll adjust this to simulate the timetable
let simulationBaseDate: Date;
let simulationStartRealTime: number;
let simulationSpeedMultiplier = 1; // 1 = real-time, 2 = 2x speed, etc.
let blockedSectorIds: Set<string> = new Set();

/**
 * Gets the current simulation time
 * The simulation time advances at the speed multiplier rate
 */
function getSimulationTime(): Date {
  const realElapsed = Date.now() - simulationStartRealTime;
  const simulatedElapsed = realElapsed * simulationSpeedMultiplier;
  return new Date(simulationBaseDate.getTime() + simulatedElapsed);
}

/**
 * Initializes the simulator
 */
async function initialize(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Mumbai Local Train Simulator");
  console.log("CSMT - Kalyan Line");
  console.log("=".repeat(60));

  // Set simulation start time
  // We'll start at 06:00 to match the timetable
  simulationBaseDate = new Date();
  simulationBaseDate.setHours(6, 0, 0, 0);
  simulationStartRealTime = Date.now();

  console.log(`[Init] Simulation start time: ${simulationBaseDate.toLocaleTimeString()}`);
  console.log(`[Init] Speed multiplier: ${simulationSpeedMultiplier}x`);

  // Load stations and build track graph
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

  // Load timetables
  console.log("[Init] Loading Central Railway timetable...");
  trains = loadTimetable(simulationBaseDate);

  console.log("[Init] Loading SECR Raipur Division timetable...");
  try {
    secrTrains = loadSecrTimetable(simulationBaseDate);
  } catch (err) {
    console.warn("[Init] SECR timetable not loaded:", err);
  }

  // Check API health
  console.log("[Init] Checking API health...");
  const apiHealthy = await checkApiHealth();
  if (!apiHealthy) {
    console.warn("[Init] ⚠️  API is not responding. Simulator will still run but data won't be sent.");
    console.warn(`[Init] Make sure the API is running at ${API_URL}`);
  } else {
    console.log("[Init] ✓ API is healthy");
  }

  // Skip seed trains - let simulator handle everything based on timetable departure times
  console.log("[Init] Skipping seed trains - trains will appear when they depart");

  console.log("[Init] Initialization complete");
  console.log("=".repeat(60));
}

/**
 * Sends seed trains to populate the frontend initially
 */
async function sendSeedTrains(): Promise<void> {
  const seedModule = require("./seed.js");
  await seedModule.sendSeedTrains(API_URL);
}

/**
 * Checks if the simulation control state is running on the backend
 */
async function checkSimulationRunning(): Promise<boolean> {
  try {
    const response = await fetch(API_URL.replace("/receiver", "/receiver/control"));
    if (response.ok) {
      const data = (await response.json()) as any;
      return data.running !== false;
    }
  } catch (error) {
    // Default to true on connection errors so offline mode still runs
  }
  return true;
}

/**
 * Main simulation tick
 */
async function tick(): Promise<void> {
  // Check if simulation is running from the control API
  const isControlRunning = await checkSimulationRunning();
  if (!isControlRunning) {
    if (tickCount % 10 === 0) {
      console.log("[Simulator] Simulation suspended (paused via Control Panel)");
    }
    return;
  }

  tickCount++;
  const currentTime = getSimulationTime();
  blockedSectorIds = await getBlockedSectorIds();

  // Simulate all trains (Central Railway)
  const newStates = simulateAllTrains(
    trains,
    currentTime,
    trackGraph,
    trainStates,
    SIMULATION_INTERVAL_MS / 1000,
    blockedSectorIds
  );

  // Simulate all trains (SECR Raipur Division)
  if (secrTrackGraph && secrTrains.length > 0) {
    const newSecrStates = simulateAllTrains(
      secrTrains,
      currentTime,
      secrTrackGraph,
      secrTrainStates,
      SIMULATION_INTERVAL_MS / 1000,
      blockedSectorIds
    );
    secrTrainStates = newSecrStates;
    for (const [id, state] of newSecrStates.entries()) {
      newStates.set(id, state);
    }
  }

  trainStates = newStates;

  // Log status every 10 ticks (20 seconds)
  if (tickCount % 10 === 0) {
    const activeCount = trainStates.size;
    const movingCount = Array.from(trainStates.values()).filter(s => s.speed > 0).length;
    console.log(
      `[Tick ${tickCount}] Time: ${currentTime.toLocaleTimeString()} | ` +
      `Active trains: ${activeCount} | Moving: ${movingCount} | ` +
      `Blocked sectors: ${blockedSectorIds.size}`
    );
  }

  // Send data to API with the simulated timestamp
  if (trainStates.size > 0) {
    const result = await sendAllTrainData(trainStates, currentTime.getTime());
    
    if (tickCount % 30 === 0) { // Log every minute
      console.log(
        `[Network] Sent: ${result.success} | Failed: ${result.failed}`
      );
    }
  }
}

/**
 * Starts the simulation loop
 */
function start(): void {
  if (isRunning) {
    console.log("[Simulator] Already running");
    return;
  }

  isRunning = true;
  console.log("[Simulator] Starting simulation loop...");
  console.log(`[Simulator] Update interval: ${SIMULATION_INTERVAL_MS}ms`);

  simulationTimer = setInterval(async () => {
    try {
      await tick();
    } catch (error) {
      console.error("[Simulator] Tick error:", error);
    }
  }, SIMULATION_INTERVAL_MS);

  console.log("[Simulator] Simulation started. Press Ctrl+C to stop.");
}

/**
 * Stops the simulation loop
 */
function stop(): void {
  if (!isRunning) {
    console.log("[Simulator] Not running");
    return;
  }

  isRunning = false;
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }

  console.log("[Simulator] Simulation stopped");
  console.log(`[Simulator] Total ticks: ${tickCount}`);
}

/**
 * Handles graceful shutdown
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    console.log(`\n[Simulator] Received ${signal}, shutting down...`);
    stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("[Simulator] Uncaught exception:", error);
    stop();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[Simulator] Unhandled rejection:", reason);
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    if (arg.startsWith("--speed=")) {
      simulationSpeedMultiplier = parseFloat(arg.split("=")[1]) || 1;
    }
    if (arg.startsWith("--start-hour=")) {
      const hour = parseInt(arg.split("=")[1], 10);
      if (hour >= 0 && hour <= 23) {
        simulationBaseDate = new Date();
        simulationBaseDate.setHours(hour, 0, 0, 0);
      }
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

// Export for testing
export {
  initialize,
  start,
  stop,
  tick,
  getSimulationTime,
  trainStates,
};

// Run main
main();
