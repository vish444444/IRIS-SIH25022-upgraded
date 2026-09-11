# Mumbai Local Train Simulator

A realistic train movement simulator for the CSMT-Kalyan line that generates live train data based on the full 3-hour timetable.

## Overview

This simulator:
1. Loads the `full_timetable.json` with all train schedules
2. Uses `stations.json` for real GPS coordinates of each station
3. Computes train positions by interpolating between stations based on schedule times
4. Calculates speed from position changes every 2 seconds
5. Sends live data to the `/api/receiver` endpoint

## File Structure

```
/simulator
├── index.ts           # Main entry point with simulation loop
├── timetableLoader.ts # Loads and parses the timetable JSON
├── trackBuilder.ts    # Builds track graph with haversine distances
├── trainSimulator.ts  # Core simulation logic
├── networkClient.ts   # HTTP client for API communication
├── seed.js           # Dummy trains for initial display
├── stations.json      # Station coordinates (lat/lng)
├── full_timetable.json # Train schedules
├── package.json
└── tsconfig.json
```

## Installation

```bash
cd simulator
npm install
```

## Usage

### Development Mode (with ts-node)
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Fast Simulation (10x speed)
```bash
npm run dev:fast
```

### Send Seed Trains Only
```bash
npm run seed
```

### Custom Options
```bash
# Custom speed multiplier
ts-node index.ts --speed=5

# Custom start hour (6-9 for morning rush)
ts-node index.ts --start-hour=7

# Both options
ts-node index.ts --speed=10 --start-hour=8
```

## Train Types and Colors

| Type    | Color  | Description           |
|---------|--------|-----------------------|
| slow    | blue   | Stops at all stations |
| fast    | red    | Express service       |
| womens  | pink   | Ladies special        |
| ac      | cyan   | AC local service      |

## API Payload

Every 2 seconds, the simulator POSTs to `http://localhost:3000/api/receiver`:

```json
{
  "train_id": "UP_SLOW_1",
  "lat": 19.0653,
  "lng": 72.8794,
  "speed": 45.5,
  "type": "slow",
  "line_id": "csmt-kalyan",
  "destination": "KALYAN",
  "timestamp": 1701676800000
}
```

## How It Works

### 1. Time Mapping
The simulator maps HH:MM times from the timetable to actual Date objects. The simulation starts at 06:00 by default.

### 2. Segment Detection
For each train, we find which station-to-station segment it's currently on by checking if `currentTime` falls between `departure(A)` and `arrival(B)`.

### 3. Position Interpolation
```
progress = (currentTime - departureTime) / (arrivalTime - departureTime)
lat = start.lat + (end.lat - start.lat) * progress
lng = start.lng + (end.lng - start.lng) * progress
```

### 4. Speed Calculation
```
distance = haversine(previousPosition, currentPosition)
speed = distance / 2 seconds * 3600 (convert to km/h)
```

### 5. Haversine Distance
Used to calculate real-world distances between GPS coordinates:
```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
c = 2 × atan2(√a, √(1−a))
distance = R × c  (where R = 6371 km)
```

## Environment Variables

- `API_URL` - API base URL (default: `http://localhost:3000`)

## Graceful Shutdown

Press `Ctrl+C` to stop the simulator gracefully. It handles SIGINT, SIGTERM, and SIGHUP signals.

## Stations on CSMT-Kalyan Line

1. CSMT (Chhatrapati Shivaji Maharaj Terminus)
2. Masjid Bunder
3. Sandhurst Road
4. Byculla
5. Chinchpokli
6. Currey Road
7. Parel
8. Dadar
9. Matunga
10. Sion
11. Kurla
12. Vidyavihar
13. Ghatkopar
14. Vikhroli
15. Kanjurmarg
16. Bhandup
17. Nahur
18. Mulund
19. Thane
20. Kalva
21. Mumbra
22. Diva Junction
23. Kopar
24. Dombivli
25. Thakurli
26. Kalyan Junction

## License

ISC
