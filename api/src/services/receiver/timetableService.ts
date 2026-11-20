import * as fs from "fs";
import * as path from "path";
import { StoredTrainData } from "../../Interfaces/receiver/trainReceiver.interface";

export interface TimetableEntry {
  train_id: string;
  trip_id?: string;
  from: string;
  to: string;
  departure: string;
  stop_times: Array<{
    station: string;
    arrival: string;
    departure: string;
  }>;
  flags?: {
    is_ac?: boolean;
    is_womens?: boolean;
    is_fast?: boolean;
    is_peak_service?: boolean;
  };
  service_type?: "slow" | "fast" | string;
  direction?: "UP" | "DOWN" | string;
  [key: string]: any;
}

let timetableCache: TimetableEntry[] | null = null;

export class TimetableService {
  private static instance: TimetableService;
  private timetable: TimetableEntry[] = [];

  private constructor() {
    this.loadTimetable();
  }

  static getInstance(): TimetableService {
    if (!TimetableService.instance) {
      TimetableService.instance = new TimetableService();
    }
    return TimetableService.instance;
  }

  public reload(): void {
    this.loadTimetable();
  }

  public loadTimetable(): void {
    try {
      // Try to load from simulator directory or api services directory
      const possiblePaths = [
        path.join(__dirname, "../../../../simulator/full_timetable.json"),
        path.join(__dirname, "../../../simulator/full_timetable.json"),
        path.join(__dirname, "../../../../../../simulator/full_timetable.json"),
        path.join(__dirname, "../simulation/full_timetable.json"),
        path.resolve(process.cwd(), "simulator/full_timetable.json"),
        path.resolve(process.cwd(), "../simulator/full_timetable.json"),
      ];

      let timetablePath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          timetablePath = possiblePath;
          break;
        }
      }

      if (!timetablePath) {
        console.warn("[TimetableService] Could not find full_timetable.json");
        this.timetable = [];
        return;
      }

      const rawData = fs.readFileSync(timetablePath, "utf-8");
      const crTrains = JSON.parse(rawData);

      // Also load SECR Raipur timetable
      let secrTrains: TimetableEntry[] = [];
      const possibleSecrPaths = [
        path.join(__dirname, "../../../../simulator/secrTimetable.json"),
        path.join(__dirname, "../../../simulator/secrTimetable.json"),
        path.join(__dirname, "../simulation/secrTimetable.json"),
        path.resolve(process.cwd(), "simulator/secrTimetable.json"),
        path.resolve(process.cwd(), "../simulator/secrTimetable.json"),
      ];
      for (const p of possibleSecrPaths) {
        if (fs.existsSync(p)) {
          try {
            secrTrains = JSON.parse(fs.readFileSync(p, "utf-8"));
            break;
          } catch {}
        }
      }

      this.timetable = [...crTrains, ...secrTrains];
      console.log(`[TimetableService] Loaded ${this.timetable.length} trains from timetables (CR: ${crTrains.length}, SECR: ${secrTrains.length})`);
    } catch (error) {
      console.error("[TimetableService] Error loading timetable:", error);
      this.timetable = [];
    }
  }

  getTimetableEntry(trainId: string): TimetableEntry | undefined {
    return this.timetable.find((entry) => entry.train_id === trainId);
  }

  getAllTimetableEntries(): TimetableEntry[] {
    return this.timetable;
  }

  private persistTimetable(): boolean {
    const possiblePaths = [
      path.join(__dirname, "../../../../simulator/full_timetable.json"),
      path.join(__dirname, "../../../simulator/full_timetable.json"),
      path.join(__dirname, "../../../../../../simulator/full_timetable.json"),
      path.join(__dirname, "../simulation/full_timetable.json"),
      path.resolve(process.cwd(), "simulator/full_timetable.json"),
      path.resolve(process.cwd(), "../simulator/full_timetable.json"),
      path.resolve(process.cwd(), "src/services/simulation/full_timetable.json"),
    ];

    const jsonString = JSON.stringify(this.timetable, null, 2);
    let written = false;

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, jsonString, "utf-8");
          console.log(`[TimetableService] Persisted timetable to: ${filePath}`);
          written = true;
        } catch (err) {
          console.error(`[TimetableService] Failed to write to ${filePath}:`, err);
        }
      }
    }

    return written;
  }

  /**
   * Updates schedule for a specific train and writes to full_timetable.json files on disk
   */
  updateTrainSchedule(
    trainId: string,
    updates: {
      departure?: string;
      stop_times?: Array<{ station: string; arrival: string; departure: string }>;
    }
  ): boolean {
    const train = this.timetable.find((entry) => entry.train_id === trainId);
    if (!train) return false;

    if (updates.departure) {
      train.departure = updates.departure;
    }
    if (updates.stop_times && Array.isArray(updates.stop_times)) {
      train.stop_times = updates.stop_times;
    }

    return this.persistTimetable();
  }

  /**
   * Adds a new train to the timetable and persists to disk
   */
  addTrain(train: TimetableEntry): { success: boolean; error?: string } {
    if (this.timetable.some((t) => t.train_id.toUpperCase() === train.train_id.toUpperCase())) {
      return { success: false, error: `Train with ID '${train.train_id}' already exists` };
    }

    this.timetable.push(train);
    this.persistTimetable();
    return { success: true };
  }

  /**
   * Removes a train from the timetable and persists to disk
   */
  removeTrain(trainId: string): boolean {
    const index = this.timetable.findIndex((t) => t.train_id === trainId);
    if (index === -1) return false;

    this.timetable.splice(index, 1);
    this.persistTimetable();
    return true;
  }


  /**
   * Combines live train data with timetable data
   */
  combineWithLiveTrains(liveTrains: StoredTrainData[]): any[] {
    const now = new Date();
    const baseDate = new Date(now);
    baseDate.setHours(0, 0, 0, 0);

    return liveTrains.map((train) => {
      const timetableEntry = this.getTimetableEntry(train.train_id);
      
      // Parse scheduled times from timetable
      let scheduledArrival: Date | null = null;
      let scheduledDeparture: Date | null = null;
      let currentStation: string | null = null;
      let nextStation: string | null = null;
      let platform: number | null = null;

      if (timetableEntry && timetableEntry.stop_times.length > 0) {
        // Find current station based on GPS position
        const station = this.getStationFromCoordinates(train.lat, train.lng);
        currentStation = station;

        // Find next station in route
        if (timetableEntry.stop_times.length > 1) {
          const currentIndex = timetableEntry.stop_times.findIndex(
            (stop) => stop.station === station
          );
          if (currentIndex >= 0 && currentIndex < timetableEntry.stop_times.length - 1) {
            nextStation = timetableEntry.stop_times[currentIndex + 1].station;
            const currentStop = timetableEntry.stop_times[currentIndex];
            const nextStop = timetableEntry.stop_times[currentIndex + 1];
            
            scheduledArrival = this.parseTimeToDate(nextStop.arrival, baseDate);
            scheduledDeparture = this.parseTimeToDate(currentStop.departure, baseDate);
          }
        }
      }

      // Calculate delays
      const arrivalDelay = scheduledArrival
        ? Math.max(0, (now.getTime() - scheduledArrival.getTime()) / 1000)
        : 0;
      const departureDelay = scheduledDeparture
        ? Math.max(0, (now.getTime() - scheduledDeparture.getTime()) / 1000)
        : 0;

      return {
        trainId: train.train_id,
        trainClass: this.getTrainClass(train.type, timetableEntry),
        coaches: 12, // Default
        priority: 1,
        
        scheduledArrival: scheduledArrival?.toISOString() || null,
        scheduledDeparture: scheduledDeparture?.toISOString() || null,
        actualArrival: null as string | Date | null,
        actualDeparture: null as string | Date | null,
        arrivalDelay,
        departureDelay,
        delay: Math.max(arrivalDelay, departureDelay),
        
        platform: platform as number | null,
        station: currentStation || this.getStationFromCoordinates(train.lat, train.lng) || 'In Transit',
        stationId: null as string | null,
        
        state: train.isMoving ? 'cruising' : 'stopped',
        position: 0,
        speed: train.speed / 3.6, // Convert km/h to m/s
        speedKmh: train.speed,
        
        currentPipeline: '',
        nextPipeline: null as string | null,
        assignedPath: [] as string[],
        pathLength: 0,
        
        gps: {
          latitude: train.lat,
          longitude: train.lng,
          speed: train.speed,
        },
        
        pipelineInfo: null as {
          id: string;
          from: string;
          to: string;
          length: number;
          maxSpeed: number;
          maxSpeedMs: number;
          defaultHeadway: number;
          isOccupied: boolean;
          isFrozen: boolean;
          occupiedBy: string | null;
          nextTrain: string | null;
          nextNextTrain: string | null;
        } | null,
        nextPipelineInfo: null as {
          id: string;
          from: string;
          to: string;
          length: number;
          maxSpeed: number;
          maxSpeedMs: number;
          defaultHeadway: number;
          isOccupied: boolean;
          isFrozen: boolean;
        } | null,
        
        nextStation: nextStation || train.destination || null,
        nextStationId: null as string | null,
        
        totalKm: 0,
        totalKmRounded: 0,
        
        speedHistory: train.speedHistory.map(entry => ({
          timestamp: new Date(entry.timestamp),
          speed: entry.speed / 3.6,
          speedKmh: entry.speed,
        })),
        
        pipelineTimes: [] as Array<{ pipelineId: string; timeSeconds: number }>,
        pipelineTimesCount: 0,
        
        recommendedSpeed: 0,
        recommendedSpeedKmh: 0,
        
        positionPercent: 0,
        remainingDistance: 0,
        
        dwellTime: null as number | null,
        scheduledDwellTime: null as number | null,
      };
    });
  }

  private getTrainClass(type: string, timetableEntry?: TimetableEntry): string {
    if (type === 'ac') return 'AC Local';
    if (type === 'womens') return 'Ladies Special';
    if (type === 'fast' || timetableEntry?.flags.is_fast || timetableEntry?.service_type === 'fast') {
      return 'Fast Local';
    }
    return 'Slow Local';
  }

  private parseTimeToDate(timeStr: string, baseDate: Date): Date {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private getStationFromCoordinates(lat: number, lng: number): string | null {
    const stations = [
      { name: 'CSMT', lat: 18.939821, lng: 72.835468 },
      { name: 'MASJID', lat: 18.953611, lng: 72.838056 },
      { name: 'SANDHURST_ROAD', lat: 18.960826, lng: 72.839511 },
      { name: 'BYCULLA', lat: 18.975180, lng: 72.833783 },
      { name: 'CHINCHPOKLI', lat: 18.987500, lng: 72.832780 },
      { name: 'CURREY_ROAD', lat: 18.995000, lng: 72.832900 },
      { name: 'PAREL', lat: 19.009482, lng: 72.837661 },
      { name: 'DADAR', lat: 19.018335, lng: 72.843214 },
      { name: 'MATUNGA', lat: 19.028736, lng: 72.844156 },
      { name: 'SION', lat: 19.035288, lng: 72.867119 },
      { name: 'KURLA', lat: 19.065221, lng: 72.879375 },
      { name: 'VIDYAVIHAR', lat: 19.080000, lng: 72.896300 },
      { name: 'GHATKOPAR', lat: 19.085649, lng: 72.908218 },
      { name: 'VIKHROLI', lat: 19.110562, lng: 72.929066 },
      { name: 'KANJUR_MARG', lat: 19.128300, lng: 72.927500 },
      { name: 'BHANDUP', lat: 19.144236, lng: 72.937971 },
      { name: 'NAHUR', lat: 19.154722, lng: 72.946389 },
      { name: 'MULUND', lat: 19.172778, lng: 72.956510 },
      { name: 'THANE', lat: 19.186110, lng: 72.975830 },
      { name: 'KALVA', lat: 19.197050, lng: 72.998530 },
      { name: 'MUMBRA', lat: 19.176667, lng: 73.022220 },
      { name: 'DIVA', lat: 19.188389, lng: 73.041911 },
      { name: 'KOPAR', lat: 19.211237, lng: 73.077613 },
      { name: 'DOMBIVLI', lat: 19.218219, lng: 73.086900 },
      { name: 'THAKURLI', lat: 19.225770, lng: 73.097680 },
      { name: 'KALYAN', lat: 19.235250, lng: 73.130500 },
    ];

    const threshold = 0.01;
    for (const station of stations) {
      const latDiff = Math.abs(station.lat - lat);
      const lngDiff = Math.abs(station.lng - lng);
      if (latDiff < threshold && lngDiff < threshold) {
        return station.name;
      }
    }

    return null;
  }
}

