import * as fs from "fs";
import * as path from "path";

export interface StopTime {
  station: string;
  arrival: string;
  departure: string;
  // Computed Date objects for simulation
  arrivalDate?: Date;
  departureDate?: Date;
}

export interface TrainFlags {
  is_ac: boolean;
  is_womens: boolean;
  is_fast: boolean;
  is_peak_service: boolean;
}

export interface TrainEntry {
  train_id: string;
  trip_id: string;
  pattern_id: string;
  service_type: "slow" | "fast";
  train_subtype: string;
  rake_type: string;
  rake_length: string;
  direction: "UP" | "DOWN";
  line_type: string;
  // Lane-aware routing metadata (optional, overrides defaults)
  track_type?: string; // canonical track type e.g., up_slow
  track_variant?: string; // specific split variant e.g., up_slow_1
  lane_index?: number; // 0-based lane index
  lane_count?: number; // total lanes for this train on the segment
  from: string;
  to: string;
  departure: string;
  peak: boolean;
  color: string;
  speed_profile: string;
  flags: TrainFlags;
  stop_times: StopTime[];
  // Track allocation (computed during simulation)
  allocatedLaneIndex?: number;
}

export type TrainType = "slow" | "fast" | "womens" | "ac";

/**
 * Converts HH:MM time string to a Date object relative to a base date
 */
export function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Determines the train type based on flags and service_type
 */
export function getTrainType(train: TrainEntry): TrainType {
  if (train.flags.is_ac) return "ac";
  if (train.flags.is_womens) return "womens";
  if (train.flags.is_fast || train.service_type === "fast") return "fast";
  return "slow";
}

/**
 * Loads the timetable from full_timetable.json and converts all times to Date objects
 */
export function loadTimetable(baseDate: Date): TrainEntry[] {
  // Handle both development (ts-node) and production (compiled) paths
  let timetablePath = path.join(__dirname, "full_timetable.json");
  if (!fs.existsSync(timetablePath)) {
    timetablePath = path.join(__dirname, "..", "full_timetable.json");
  }
  const rawData = fs.readFileSync(timetablePath, "utf-8");
  const trains: TrainEntry[] = JSON.parse(rawData);

  // Convert all HH:MM times to Date objects
  for (const train of trains) {
    for (const stop of train.stop_times) {
      stop.arrivalDate = parseTimeToDate(stop.arrival, baseDate);
      stop.departureDate = parseTimeToDate(stop.departure, baseDate);
    }
  }

  console.log(`[TimetableLoader] Loaded ${trains.length} trains from timetable`);
  return trains;
}

/**
 * Loads SECR timetable for South East Central Railway (DRM Raipur Division)
 */
export function loadSecrTimetable(baseDate: Date): TrainEntry[] {
  let timetablePath = path.join(__dirname, "secrTimetable.json");
  if (!fs.existsSync(timetablePath)) {
    timetablePath = path.join(__dirname, "..", "secrTimetable.json");
  }
  if (!fs.existsSync(timetablePath)) return [];
  const rawData = fs.readFileSync(timetablePath, "utf-8");
  const trains: TrainEntry[] = JSON.parse(rawData);

  for (const train of trains) {
    for (const stop of train.stop_times) {
      stop.arrivalDate = parseTimeToDate(stop.arrival, baseDate);
      stop.departureDate = parseTimeToDate(stop.departure, baseDate);
    }
  }

  console.log(`[TimetableLoader] Loaded ${trains.length} SECR trains from secrTimetable`);
  return trains;
}

/**
 * Filters trains that are active within a given time window
 */
export function getActiveTrains(
  trains: TrainEntry[],
  currentTime: Date,
  windowMinutes: number = 5
): TrainEntry[] {
  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(currentTime.getTime() - windowMs);
  const windowEnd = new Date(currentTime.getTime() + windowMs);

  return trains.filter((train) => {
    const stopTimes = train.stop_times;
    if (stopTimes.length < 2) return false;

    const firstDeparture = stopTimes[0].departureDate!;
    const lastArrival = stopTimes[stopTimes.length - 1].arrivalDate!;

    // Train is active if it has departed and hasn't reached destination
    return firstDeparture <= windowEnd && lastArrival >= windowStart;
  });
}

export default {
  loadTimetable,
  getTrainType,
  parseTimeToDate,
  getActiveTrains,
};
