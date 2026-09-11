/**
 * Seed data for dummy trains to display before live simulation begins
 * These are pre-seeded coordinate points along the CSMT-Kalyan line
 * 
 * These seeds represent the exact 8 trains from the timetable at their 06:00 starting positions.
 * They are sent before the live simulator begins to populate the frontend.
 * Once the simulator starts, it will take over with accurate simulation-based positions.
 */

// Station coordinates (from sampleTrackData.json / stations.json)
const STATIONS = {
  "CSMT": { lat: 18.943900, lng: 72.831000 },
  "DADAR": { lat: 19.018335, lng: 72.843214 },
  "THANE": { lat: 19.186110, lng: 72.975830 },
  "KALYAN": { lat: 19.265000, lng: 73.135000 },
};

// Seed trains matching the exact timetable
const seedTrains = [
  // UP_SLOW_1: CSMT 06:00
  {
    train_id: "UP_SLOW_1",
    lat: STATIONS.CSMT.lat,
    lng: STATIONS.CSMT.lng,
    speed: 0,
    type: "slow",
    line_id: "csmt-kalyan",
    destination: "KALYAN",
    timestamp: Date.now(),
    trackType: "up_slow",
    trackVariant: "up_slow_1",
    laneIndex: 0,
    laneCount: 2,
  },
  // UP_SLOW_2: CSMT 06:02
  {
    train_id: "UP_SLOW_2",
    lat: STATIONS.CSMT.lat,
    lng: STATIONS.CSMT.lng,
    speed: 0,
    type: "slow",
    line_id: "csmt-kalyan",
    destination: "KALYAN",
    timestamp: Date.now(),
    trackType: "up_slow",
    trackVariant: "up_slow_2",
    laneIndex: 1,
    laneCount: 2,
  },
  // UP_SLOW_3: CSMT 06:05
  {
    train_id: "UP_SLOW_3",
    lat: STATIONS.CSMT.lat,
    lng: STATIONS.CSMT.lng,
    speed: 0,
    type: "slow",
    line_id: "csmt-kalyan",
    destination: "KALYAN",
    timestamp: Date.now(),
    trackType: "up_slow",
    trackVariant: "up_slow_1",
    laneIndex: 0,
    laneCount: 2,
  },
  // UP_FAST_1: CSMT 06:01
  {
    train_id: "UP_FAST_1",
    lat: STATIONS.CSMT.lat,
    lng: STATIONS.CSMT.lng,
    speed: 0,
    type: "fast",
    line_id: "csmt-kalyan",
    destination: "KALYAN",
    timestamp: Date.now(),
    trackType: "up_fast",
    trackVariant: "up_fast",
    laneIndex: 0,
    laneCount: 1,
  },
  // UP_SLOW_4: DADAR 06:03
  {
    train_id: "UP_SLOW_4",
    lat: STATIONS.DADAR.lat,
    lng: STATIONS.DADAR.lng,
    speed: 0,
    type: "slow",
    line_id: "csmt-kalyan",
    destination: "KALYAN",
    timestamp: Date.now(),
    trackType: "up_slow",
    trackVariant: "up_slow_2",
    laneIndex: 1,
    laneCount: 2,
  },
  // DOWN_FAST_1: THANE 06:10
  {
    train_id: "DOWN_FAST_1",
    lat: STATIONS.THANE.lat,
    lng: STATIONS.THANE.lng,
    speed: 0,
    type: "fast",
    line_id: "csmt-kalyan",
    destination: "CSMT",
    timestamp: Date.now(),
    trackType: "down_fast",
    trackVariant: "down_fast",
    laneIndex: 0,
    laneCount: 1,
  },
  // DOWN_SLOW_1: KALYAN 06:05
  {
    train_id: "DOWN_SLOW_1",
    lat: STATIONS.KALYAN.lat,
    lng: STATIONS.KALYAN.lng,
    speed: 0,
    type: "slow",
    line_id: "csmt-kalyan",
    destination: "CSMT",
    timestamp: Date.now(),
    trackType: "down_slow",
    trackVariant: "down_slow_1",
    laneIndex: 0,
    laneCount: 2,
  },
  // DOWN_FAST_2: KALYAN 06:05
  {
    train_id: "DOWN_FAST_2",
    lat: STATIONS.KALYAN.lat,
    lng: STATIONS.KALYAN.lng,
    speed: 0,
    type: "fast",
    line_id: "csmt-kalyan",
    destination: "CSMT",
    timestamp: Date.now(),
    trackType: "down_fast",
    trackVariant: "down_fast",
    laneIndex: 0,
    laneCount: 1,
  },
];

/**
 * Get all seed trains with updated timestamps
 */
function getSeedTrains() {
  return seedTrains.map(train => ({
    ...train,
    timestamp: Date.now(),
  }));
}

/**
 * Send seed trains to the API
 */
async function sendSeedTrains(apiUrl = "http://localhost:3000/api/receiver") {
  const trains = getSeedTrains();
  const endpoint = `${apiUrl}`;

  console.log(`[Seed] Sending ${trains.length} seed trains to ${endpoint}`);

  for (const train of trains) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(train),
      });

      if (response.ok) {
        console.log(`[Seed] Sent ${train.train_id} at (${train.lat}, ${train.lng})`);
      } else {
        console.error(`[Seed] Failed to send ${train.train_id}: ${response.status}`);
      }
    } catch (error) {
      console.error(`[Seed] Error sending ${train.train_id}:`, error);
    }
  }

  console.log(`[Seed] Completed sending seed trains`);
}

// Export for use in other modules
module.exports = {
  seedTrains,
  getSeedTrains,
  sendSeedTrains,
};

// Run directly if executed as script
if (require.main === module) {
  const baseUrl = process.argv[2] || "http://localhost:3000";
  // Ensure the URL includes /api/receiver endpoint
  const apiUrl = baseUrl.includes("/api/receiver") ? baseUrl : `${baseUrl}/api/receiver`;
  sendSeedTrains(apiUrl)
    .then(() => {
      console.log("[Seed] Done");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[Seed] Fatal error:", error);
      process.exit(1);
    });
}
