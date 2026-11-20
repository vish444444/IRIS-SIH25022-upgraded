/**
 * VDU (Visual Display Unit) Service
 * Generates synthetic but realistic SECR railway interlocking data
 * for the DRM Raipur control room display.
 * 
 * ⚠ SIMULATED DATA — Not connected to real CRIS/COA/SCADA systems.
 */

export interface PlatformState {
  id: string;
  station: string;
  number: number;
  name: string;
  length_m: number;
  line_type: 'main' | 'loop' | 'goods';
  occupied_by: string | null;
  state: 'clear' | 'occupied' | 'reserved' | 'blocked';
  reserved_for?: string;
  eta_min?: number;
}

export interface PointMachine {
  id: string;
  station: string;
  label: string;
  position: 'Normal' | 'Reverse';
  detection: 'detected' | 'not_detected';
  status: 'healthy' | 'fault' | 'under_maintenance';
  operated_at?: string;
}

export interface AxleCounter {
  id: string;
  station: string;
  section_label: string;
  state: 'clear' | 'occupied' | 'reset_required' | 'failed';
  train_id: string | null;
  count_in: number;
  count_out: number;
}

export interface SignalAspect {
  id: string;
  station: string;
  label: string;
  type: 'home' | 'starter' | 'advanced_starter' | 'distant' | 'shunt';
  aspect: 'green' | 'yellow' | 'double_yellow' | 'red' | 'shunt_clear';
  speed_kmh: number | null;
  direction: 'up' | 'down';
  platform?: number;
}

export interface VduSnapshot {
  timestamp: string;
  simulated: true;
  corridor: string;
  platforms: PlatformState[];
  pointMachines: PointMachine[];
  axleCounters: AxleCounter[];
  signals: SignalAspect[];
  activePlatformCount: number;
  faultCount: number;
  occupiedAxleCount: number;
}

// ---------------------------------------------------------
// Static topology for SECR Raipur Division
// ---------------------------------------------------------
const RAIPUR_PLATFORMS: Omit<PlatformState, 'occupied_by' | 'state' | 'reserved_for' | 'eta_min'>[] = [
  { id: 'R-PF1', station: 'Raipur Jn', number: 1, name: 'Pf 1 (Main Up)', length_m: 648, line_type: 'main' },
  { id: 'R-PF2', station: 'Raipur Jn', number: 2, name: 'Pf 2 (Main Dn)', length_m: 648, line_type: 'main' },
  { id: 'R-PF3', station: 'Raipur Jn', number: 3, name: 'Pf 3 (Loop A)', length_m: 540, line_type: 'loop' },
  { id: 'R-PF4', station: 'Raipur Jn', number: 4, name: 'Pf 4 (Loop B)', length_m: 540, line_type: 'loop' },
  { id: 'R-PF5', station: 'Raipur Jn', number: 5, name: 'Pf 5 (Loop C)', length_m: 450, line_type: 'loop' },
  { id: 'R-PF6', station: 'Raipur Jn', number: 6, name: 'Pf 6 (Goods Rd)', length_m: 420, line_type: 'goods' },
  { id: 'R-PF7', station: 'Raipur Jn', number: 7, name: 'Pf 7 (Reserve)', length_m: 350, line_type: 'loop' },
];

const DURG_PLATFORMS: Omit<PlatformState, 'occupied_by' | 'state' | 'reserved_for' | 'eta_min'>[] = [
  { id: 'DURG-PF1', station: 'Durg', number: 1, name: 'Pf 1 (Main)', length_m: 580, line_type: 'main' },
  { id: 'DURG-PF2', station: 'Durg', number: 2, name: 'Pf 2 (Loop)', length_m: 500, line_type: 'loop' },
  { id: 'DURG-PF3', station: 'Durg', number: 3, name: 'Pf 3 (Loop)', length_m: 500, line_type: 'loop' },
];

const BSP_PLATFORMS: Omit<PlatformState, 'occupied_by' | 'state' | 'reserved_for' | 'eta_min'>[] = [
  { id: 'BSP-PF1', station: 'Bilaspur Jn', number: 1, name: 'Pf 1 (Main Up)', length_m: 696, line_type: 'main' },
  { id: 'BSP-PF2', station: 'Bilaspur Jn', number: 2, name: 'Pf 2 (Main Dn)', length_m: 696, line_type: 'main' },
  { id: 'BSP-PF3', station: 'Bilaspur Jn', number: 3, name: 'Pf 3 (Loop)', length_m: 540, line_type: 'loop' },
  { id: 'BSP-PF4', station: 'Bilaspur Jn', number: 4, name: 'Pf 4 (Loop)', length_m: 540, line_type: 'loop' },
];

// Point machines at Raipur Jn and other major stations
const STATIC_POINT_MACHINES: Omit<PointMachine, 'position' | 'detection' | 'status' | 'operated_at'>[] = [
  // Raipur Jn - Up end (DPS/NX interlocking area)
  { id: 'R-PM-1A', station: 'Raipur Jn', label: 'Pt 1A — Up Home Entry Loop A' },
  { id: 'R-PM-1B', station: 'Raipur Jn', label: 'Pt 1B — Up Home Crossover' },
  { id: 'R-PM-3A', station: 'Raipur Jn', label: 'Pt 3A — Up Main to Pf1/2 Split' },
  { id: 'R-PM-5A', station: 'Raipur Jn', label: 'Pt 5A — Pf3 Loop Entry' },
  { id: 'R-PM-5B', station: 'Raipur Jn', label: 'Pt 5B — Pf4 Loop Entry' },
  { id: 'R-PM-7A', station: 'Raipur Jn', label: 'Pt 7A — Pf5 Loop Entry' },
  // Raipur Jn - Down end
  { id: 'R-PM-10A', station: 'Raipur Jn', label: 'Pt 10A — Dn Starter Exit Loop A' },
  { id: 'R-PM-10B', station: 'Raipur Jn', label: 'Pt 10B — Dn Starter Exit Crossover' },
  { id: 'R-PM-12A', station: 'Raipur Jn', label: 'Pt 12A — Goods Road Entry' },
  { id: 'R-PM-15A', station: 'Raipur Jn', label: 'Pt 15A — Loco Pilot Exam Pit' },
  // Durg
  { id: 'DURG-PM-1A', station: 'Durg', label: 'Pt 1A — Up Home Entry' },
  { id: 'DURG-PM-3A', station: 'Durg', label: 'Pt 3A — Loco Shed Escape Road' },
  { id: 'DURG-PM-5A', station: 'Durg', label: 'Pt 5A — Dalli Rajhara Branch Split' },
  // BPHB
  { id: 'BPHB-PM-1A', station: 'Bhilai Power House', label: 'Pt 1A — Steel Plant Junction Entry' },
  { id: 'BPHB-PM-2A', station: 'Bhilai Power House', label: 'Pt 2A — Goods Yard Crossover' },
  // Bilaspur
  { id: 'BSP-PM-1A', station: 'Bilaspur Jn', label: 'Pt 1A — Zonal HQ Up Entry' },
  { id: 'BSP-PM-3A', station: 'Bilaspur Jn', label: 'Pt 3A — Workshop Escape' },
  { id: 'BSP-PM-5A', station: 'Bilaspur Jn', label: 'Pt 5A — Pf3/4 Loop Entry' },
];

// Axle counters covering block sections
const STATIC_AXLE_COUNTERS: Omit<AxleCounter, 'state' | 'train_id' | 'count_in' | 'count_out'>[] = [
  { id: 'AX-DURG-BPHB-UP', station: 'Durg', section_label: 'Durg → BPHB (Up Line)' },
  { id: 'AX-DURG-BPHB-DN', station: 'Durg', section_label: 'Durg → BPHB (Down Line)' },
  { id: 'AX-BPHB-R-UP', station: 'Bhilai Power House', section_label: 'BPHB → Raipur (Up Main)' },
  { id: 'AX-BPHB-R-DN', station: 'Bhilai Power House', section_label: 'BPHB → Raipur (Down Main)' },
  { id: 'AX-R-PF1', station: 'Raipur Jn', section_label: 'Raipur Pf 1 Track Circuit' },
  { id: 'AX-R-PF2', station: 'Raipur Jn', section_label: 'Raipur Pf 2 Track Circuit' },
  { id: 'AX-R-PF3', station: 'Raipur Jn', section_label: 'Raipur Pf 3 Track Circuit' },
  { id: 'AX-R-PF4', station: 'Raipur Jn', section_label: 'Raipur Pf 4 Track Circuit' },
  { id: 'AX-R-TILDA', station: 'Raipur Jn', section_label: 'Raipur → Tilda (Up Line)' },
  { id: 'AX-TILDA-BHTA', station: 'Tilda', section_label: 'Tilda → Bhatapara (Up Line)' },
  { id: 'AX-BHTA-BSP', station: 'Bhatapara', section_label: 'Bhatapara → Bilaspur (Up Main)' },
  { id: 'AX-BSP-PF1', station: 'Bilaspur Jn', section_label: 'Bilaspur Pf 1 Track Circuit' },
  { id: 'AX-BSP-PF2', station: 'Bilaspur Jn', section_label: 'Bilaspur Pf 2 Track Circuit' },
];

// Signal aspects (NX interlocking signals)
const STATIC_SIGNALS: Omit<SignalAspect, 'aspect' | 'speed_kmh'>[] = [
  // Raipur Jn - Up approach / Arrival signals
  { id: 'R-UH', station: 'Raipur Jn', label: 'UP HOME (UH)', type: 'home', direction: 'up' },
  { id: 'R-UH-A', station: 'Raipur Jn', label: 'UP HOME A (UH-A)', type: 'home', direction: 'up', platform: 1 },
  { id: 'R-UH-B', station: 'Raipur Jn', label: 'UP HOME B (UH-B)', type: 'home', direction: 'up', platform: 2 },
  { id: 'R-US-1', station: 'Raipur Jn', label: 'UP STARTER Pf1 (US-1)', type: 'starter', direction: 'up', platform: 1 },
  { id: 'R-US-2', station: 'Raipur Jn', label: 'UP STARTER Pf2 (US-2)', type: 'starter', direction: 'up', platform: 2 },
  { id: 'R-UAS', station: 'Raipur Jn', label: 'UP ADV STARTER (UAS)', type: 'advanced_starter', direction: 'up' },
  // Raipur Jn - Down direction
  { id: 'R-DH', station: 'Raipur Jn', label: 'DN HOME (DH)', type: 'home', direction: 'down' },
  { id: 'R-DS-1', station: 'Raipur Jn', label: 'DN STARTER Pf1 (DS-1)', type: 'starter', direction: 'down', platform: 1 },
  { id: 'R-DS-2', station: 'Raipur Jn', label: 'DN STARTER Pf2 (DS-2)', type: 'starter', direction: 'down', platform: 2 },
  { id: 'R-DAS', station: 'Raipur Jn', label: 'DN ADV STARTER (DAS)', type: 'advanced_starter', direction: 'down' },
  // Raipur - Distant signals
  { id: 'R-UDIST', station: 'Raipur Jn', label: 'UP DISTANT (UD)', type: 'distant', direction: 'up' },
  { id: 'R-DDIST', station: 'Raipur Jn', label: 'DN DISTANT (DD)', type: 'distant', direction: 'down' },
  // BPHB signals
  { id: 'BPHB-UH', station: 'Bhilai Power House', label: 'UP HOME (UH)', type: 'home', direction: 'up' },
  { id: 'BPHB-DH', station: 'Bhilai Power House', label: 'DN HOME (DH)', type: 'home', direction: 'down' },
  // Bilaspur signals
  { id: 'BSP-UH', station: 'Bilaspur Jn', label: 'UP HOME (UH)', type: 'home', direction: 'up' },
  { id: 'BSP-DH', station: 'Bilaspur Jn', label: 'DN HOME (DH)', type: 'home', direction: 'down' },
];

// ---------------------------------------------------------
// In-memory mutable state (synthetic simulation)
// ---------------------------------------------------------
interface MutableVduState {
  platforms: PlatformState[];
  pointMachines: PointMachine[];
  axleCounters: AxleCounter[];
  signals: SignalAspect[];
  lastTrainPositions: Map<string, string>; // trainId -> stationName
}

let vduState: MutableVduState | null = null;

function initVduState(): MutableVduState {
  // Build initial platform states (all clear)
  const platforms: PlatformState[] = [
    ...RAIPUR_PLATFORMS,
    ...DURG_PLATFORMS,
    ...BSP_PLATFORMS,
  ].map((p): PlatformState => ({ ...p, occupied_by: null as string | null, state: 'clear' as const }));

  // Build initial point machines (all Normal/detected/healthy)
  const pointMachines: PointMachine[] = STATIC_POINT_MACHINES.map((pm): PointMachine => ({
    ...pm,
    position: 'Normal' as const,
    detection: 'detected' as const,
    status: 'healthy' as const,
    operated_at: new Date().toISOString(),
  }));

  // Start a few as Reverse to look realistic
  const reverseIds = ['R-PM-1B', 'R-PM-5A', 'DURG-PM-5A'];
  reverseIds.forEach((id) => {
    const pm = pointMachines.find((p) => p.id === id);
    if (pm) pm.position = 'Reverse';
  });

  // One under maintenance
  const maintPm = pointMachines.find((p) => p.id === 'BPHB-PM-2A');
  if (maintPm) maintPm.status = 'under_maintenance';

  // Build axle counters (all clear)
  const axleCounters: AxleCounter[] = STATIC_AXLE_COUNTERS.map((ac): AxleCounter => ({
    ...ac,
    state: 'clear' as const,
    train_id: null as string | null,
    count_in: 0,
    count_out: 0,
  }));

  // Build signals (all red by default — NX interlocking)
  const signals: SignalAspect[] = STATIC_SIGNALS.map((s): SignalAspect => ({
    ...s,
    aspect: 'red' as const,
    speed_kmh: null as number | null,
  }));

  // Set some to green/yellow for realism
  ['R-UDIST', 'R-DDIST', 'BSP-UH', 'BPHB-UH'].forEach((id) => {
    const sig = signals.find((s) => s.id === id);
    if (sig) { sig.aspect = 'green'; sig.speed_kmh = 110; }
  });
  ['R-UH', 'R-DH'].forEach((id) => {
    const sig = signals.find((s) => s.id === id);
    if (sig) { sig.aspect = 'yellow'; sig.speed_kmh = 45; }
  });

  return {
    platforms,
    pointMachines,
    axleCounters,
    signals,
    lastTrainPositions: new Map(),
  };
}

function getState(): MutableVduState {
  if (!vduState) vduState = initVduState();
  return vduState;
}

/** Called from receiver controller when a train telemetry update arrives */
export function updateVduFromTrain(
  trainId: string,
  speed_ms: number,
  lat: number,
  lng: number,
  stationName?: string
): void {
  const state = getState();
  const isStopped = speed_ms < 0.5;

  if (stationName && isStopped) {
    // Train has arrived at a station platform
    const prevStation = state.lastTrainPositions.get(trainId);

    // Clear old platform if train moved
    if (prevStation && prevStation !== stationName) {
      state.platforms.forEach((pf) => {
        if (pf.occupied_by === trainId) {
          pf.occupied_by = null;
          pf.state = 'clear';
        }
      });
      // Clear old axle counters
      state.axleCounters.forEach((ac) => {
        if (ac.train_id === trainId) {
          ac.state = 'clear';
          ac.train_id = null;
          ac.count_out = ac.count_in; // equalize counts = section clear
        }
      });
    }

    // Assign train to the first free platform at this station
    const freePlatforms = state.platforms.filter(
      (pf) => pf.station === stationName && pf.state === 'clear' && pf.line_type !== 'goods'
    );
    if (freePlatforms.length > 0 && !state.platforms.find((p) => p.occupied_by === trainId)) {
      freePlatforms[0].occupied_by = trainId;
      freePlatforms[0].state = 'occupied';
    }

    // Set approach axle counter to occupied
    const approachAx = state.axleCounters.find(
      (ac) => ac.section_label.includes(stationName) && ac.section_label.includes('Track Circuit')
    );
    if (approachAx && approachAx.state !== 'occupied') {
      approachAx.state = 'occupied';
      approachAx.train_id = trainId;
      approachAx.count_in += 1;
    }

    state.lastTrainPositions.set(trainId, stationName);

    // Set platform signal to red (occupied)
    const homeSignal = state.signals.find(
      (s) => s.station === stationName && s.type === 'home'
    );
    if (homeSignal) homeSignal.aspect = 'red';
  } else if (!isStopped) {
    // Train is moving — clear its old platform
    const prevStation = state.lastTrainPositions.get(trainId);
    if (prevStation) {
      state.platforms.forEach((pf) => {
        if (pf.occupied_by === trainId) {
          pf.occupied_by = null;
          pf.state = 'clear';
        }
      });

      // Set block section axle counter to occupied (train in transit)
      const transitAx = state.axleCounters.find(
        (ac) => ac.section_label.includes(prevStation) && !ac.section_label.includes('Track Circuit')
      );
      if (transitAx) {
        transitAx.state = 'occupied';
        transitAx.train_id = trainId;
        transitAx.count_in += 1;
      }

      state.lastTrainPositions.set(trainId, '');
    }
  }

  // Randomly simulate small state fluctuations (± once per update with low probability)
  _simulateNoise(state);
}

function _simulateNoise(state: MutableVduState): void {
  const r = Math.random();
  // Occasionally flip a point machine
  if (r < 0.02) {
    const idx = Math.floor(Math.random() * state.pointMachines.length);
    const pm = state.pointMachines[idx];
    if (pm.status === 'healthy') {
      pm.position = pm.position === 'Normal' ? 'Reverse' : 'Normal';
      pm.operated_at = new Date().toISOString();
    }
  }
  // Occasionally set a signal to yellow (caution)
  if (r > 0.95) {
    const idx = Math.floor(Math.random() * state.signals.length);
    const sig = state.signals[idx];
    if (sig.aspect === 'green') {
      sig.aspect = 'yellow';
      sig.speed_kmh = 45;
    } else if (sig.aspect === 'yellow') {
      sig.aspect = 'green';
      sig.speed_kmh = 110;
    }
  }
}

/** Returns a full VDU snapshot for the given corridor */
export function getVduSnapshot(corridor: string): VduSnapshot {
  const state = getState();

  const faultCount = state.pointMachines.filter(
    (pm) => pm.status === 'fault' || pm.status === 'under_maintenance'
  ).length;

  const occupiedAxleCount = state.axleCounters.filter(
    (ac) => ac.state === 'occupied' || ac.state === 'reset_required'
  ).length;

  const activePlatformCount = state.platforms.filter(
    (pf) => pf.state === 'occupied'
  ).length;

  return {
    timestamp: new Date().toISOString(),
    simulated: true,
    corridor,
    platforms: [...state.platforms],
    pointMachines: [...state.pointMachines],
    axleCounters: [...state.axleCounters],
    signals: [...state.signals],
    activePlatformCount,
    faultCount,
    occupiedAxleCount,
  };
}
