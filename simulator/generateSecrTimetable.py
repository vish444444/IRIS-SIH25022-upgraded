import json
import os

stations = [
    ("DURG", "Durg Junction"),
    ("BPHB", "Bhilai Power House"),
    ("BIA", "Bhilai"),
    ("KMI", "Kumhari"),
    ("SZB", "Sarona"),
    ("SRWN", "Saraswati Nagar"),
    ("R", "Raipur Junction"),
    ("WRC", "WRS Colony"),
    ("URK", "Urkura"),
    ("MDH", "Mandhar"),
    ("SLH", "Silyari"),
    ("BKTH", "Baikunth"),
    ("TLD", "Tilda Neora"),
    ("HN", "Hathbandh"),
    ("BYT", "Bhatapara"),
    ("NPI", "Nipania"),
    ("DGS", "Dagori"),
    ("BYL", "Belha"),
    ("DPH", "Dadhapara"),
    ("BSP", "Bilaspur Junction"),
]

# Down direction: DURG -> BSP (Increasing index: order 1 to 20)
# Up direction: BSP -> DURG (Decreasing index: order 20 to 1)

def format_time(total_minutes):
    hrs = (total_minutes // 60) % 24
    mins = total_minutes % 60
    return f"{hrs:02d}:{mins:02d}"

trains = []

# 1. 20825 Bilaspur - Nagpur Vande Bharat Express (BSP -> DURG via R)
# Departs BSP at 06:05, fast stops: BSP, BYT, R, DURG
vande_bharat_stops = []
t = 6 * 60 + 5 # 06:05
vande_bharat_station_times = {
    "BSP": (t, t),
    "BYT": (t + 25, t + 27),
    "TLD": (t + 45, t + 46),
    "R": (t + 75, t + 80),   # 5-min stop at Raipur Junction (DRM HQ)
    "BPHB": (t + 105, t + 107),
    "DURG": (t + 120, t + 120),
}
for code, name in reversed(stations):
    if code in vande_bharat_station_times:
        arr, dep = vande_bharat_station_times[code]
        vande_bharat_stops.append({
            "station": code,
            "arrival": format_time(arr),
            "departure": format_time(dep)
        })

trains.append({
    "train_id": "SECR_VB_20825",
    "trip_id": "SECR_VB_20825_06:05",
    "pattern_id": "secr_bsp_durg_vb",
    "service_type": "fast",
    "train_subtype": "vande_bharat",
    "rake_type": "VB_16",
    "rake_length": "16_car",
    "direction": "DOWN",
    "line_type": "DOWN_fast",
    "track_type": "down_fast",
    "track_variant": "down_fast_1",
    "lane_index": 0,
    "lane_count": 2,
    "from": "BSP",
    "to": "DURG",
    "departure": "06:05",
    "peak": False,
    "color": "#FF9500",
    "speed_profile": "fast",
    "flags": {
        "is_ac": True,
        "is_womens": False,
        "is_fast": True,
        "is_peak_service": False
    },
    "stop_times": vande_bharat_stops
})

# 2. 08701 Raipur - Durg MEMU Special (R -> DURG)
memu_stops = []
t = 6 * 60 + 10 # 06:10
r_to_durg = [s for s in stations if s[0] in ["R", "SRWN", "SZB", "KMI", "BIA", "BPHB", "DURG"]]
cur_t = t
for code, name in reversed(r_to_durg):
    arr_str = format_time(cur_t)
    dep_str = format_time(cur_t + (1 if code not in ["R", "DURG"] else 0))
    memu_stops.append({
        "station": code,
        "arrival": arr_str,
        "departure": dep_str
    })
    cur_t += 5

trains.append({
    "train_id": "SECR_MEMU_08701",
    "trip_id": "SECR_MEMU_08701_06:10",
    "pattern_id": "secr_r_durg_memu",
    "service_type": "slow",
    "train_subtype": "memu",
    "rake_type": "MEMU_8",
    "rake_length": "8_car",
    "direction": "DOWN",
    "line_type": "DOWN_slow",
    "track_type": "down_slow",
    "track_variant": "down_slow_1",
    "lane_index": 0,
    "lane_count": 2,
    "from": "R",
    "to": "DURG",
    "departure": "06:10",
    "peak": False,
    "color": "#007AFF",
    "speed_profile": "slow",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": False,
        "is_peak_service": False
    },
    "stop_times": memu_stops
})

# 3. 08702 Durg - Raipur MEMU Special (DURG -> R)
memu_up_stops = []
t = 6 * 60 + 15 # 06:15
durg_to_r = [s for s in stations if s[0] in ["DURG", "BPHB", "BIA", "KMI", "SZB", "SRWN", "R"]]
cur_t = t
for code, name in durg_to_r:
    arr_str = format_time(cur_t)
    dep_str = format_time(cur_t + (1 if code not in ["DURG", "R"] else 0))
    memu_up_stops.append({
        "station": code,
        "arrival": arr_str,
        "departure": dep_str
    })
    cur_t += 5

trains.append({
    "train_id": "SECR_MEMU_08702",
    "trip_id": "SECR_MEMU_08702_06:15",
    "pattern_id": "secr_durg_r_memu",
    "service_type": "slow",
    "train_subtype": "memu",
    "rake_type": "MEMU_8",
    "rake_length": "8_car",
    "direction": "UP",
    "line_type": "UP_slow",
    "track_type": "up_slow",
    "track_variant": "up_slow_1",
    "lane_index": 0,
    "lane_count": 2,
    "from": "DURG",
    "to": "R",
    "departure": "06:15",
    "peak": False,
    "color": "#34C759",
    "speed_profile": "slow",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": False,
        "is_peak_service": False
    },
    "stop_times": memu_up_stops
})

# 4. 12855 Bilaspur - Itwari Intercity Express (BSP -> DURG via R)
intercity_stops = []
t = 6 * 60 + 20
bsp_to_durg_intercity = ["BSP", "BYL", "BYT", "HN", "TLD", "R", "BPHB", "DURG"]
cur_t = t
for code in bsp_to_durg_intercity:
    intercity_stops.append({
        "station": code,
        "arrival": format_time(cur_t),
        "departure": format_time(cur_t + 2)
    })
    cur_t += 14

trains.append({
    "train_id": "SECR_INT_12855",
    "trip_id": "SECR_INT_12855_06:20",
    "pattern_id": "secr_bsp_itwari_intercity",
    "service_type": "fast",
    "train_subtype": "superfast",
    "rake_type": "LHB_22",
    "rake_length": "22_car",
    "direction": "DOWN",
    "line_type": "DOWN_fast",
    "track_type": "down_fast",
    "track_variant": "down_fast_2",
    "lane_index": 1,
    "lane_count": 2,
    "from": "BSP",
    "to": "DURG",
    "departure": "06:20",
    "peak": False,
    "color": "#FF3B30",
    "speed_profile": "fast",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": True,
        "is_peak_service": False
    },
    "stop_times": intercity_stops
})

# 5. 18237 Chhattisgarh Express (DURG -> BSP via R)
chhattisgarh_stops = []
t = 6 * 60 + 25
durg_to_bsp_exp = ["DURG", "BPHB", "R", "WRC", "TLD", "BYT", "BSP"]
cur_t = t
for code in durg_to_bsp_exp:
    chhattisgarh_stops.append({
        "station": code,
        "arrival": format_time(cur_t),
        "departure": format_time(cur_t + 3)
    })
    cur_t += 16

trains.append({
    "train_id": "SECR_EXP_18237",
    "trip_id": "SECR_EXP_18237_06:25",
    "pattern_id": "secr_chhattisgarh_express",
    "service_type": "fast",
    "train_subtype": "mail_express",
    "rake_type": "ICF_24",
    "rake_length": "24_car",
    "direction": "UP",
    "line_type": "UP_fast",
    "track_type": "up_fast",
    "track_variant": "up_fast_1",
    "lane_index": 0,
    "lane_count": 2,
    "from": "DURG",
    "to": "BSP",
    "departure": "06:25",
    "peak": False,
    "color": "#AF52DE",
    "speed_profile": "fast",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": True,
        "is_peak_service": False
    },
    "stop_times": chhattisgarh_stops
})

# 6. SECR Heavy Coal Freight (BSP -> Bhilai via Urkura/Raipur)
coal_stops = []
t = 6 * 60 + 0 # already moving
cur_t = t
for code in ["BSP", "BYT", "TLD", "URK", "R", "BPHB", "DURG"]:
    coal_stops.append({
        "station": code,
        "arrival": format_time(cur_t),
        "departure": format_time(cur_t + 1)
    })
    cur_t += 20

trains.append({
    "train_id": "SECR_COAL_BOXN_1",
    "trip_id": "SECR_COAL_BOXN_1_06:00",
    "pattern_id": "secr_coal_freight",
    "service_type": "slow",
    "train_subtype": "freight",
    "rake_type": "BOXN_58",
    "rake_length": "58_car",
    "direction": "DOWN",
    "line_type": "DOWN_slow",
    "track_type": "down_slow",
    "track_variant": "down_slow_2",
    "lane_index": 1,
    "lane_count": 2,
    "from": "BSP",
    "to": "DURG",
    "departure": "06:00",
    "peak": False,
    "color": "#78716C",
    "speed_profile": "slow",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": False,
        "is_peak_service": False
    },
    "stop_times": coal_stops
})

# 7. SECR Steel Rake Outbound (DURG/Bhilai -> BSP via Raipur)
steel_stops = []
t = 6 * 60 + 30
cur_t = t
for code in ["DURG", "BPHB", "R", "TLD", "BYT", "BSP"]:
    steel_stops.append({
        "station": code,
        "arrival": format_time(cur_t),
        "departure": format_time(cur_t + 2)
    })
    cur_t += 22

trains.append({
    "train_id": "SECR_STEEL_BFNS_2",
    "trip_id": "SECR_STEEL_BFNS_2_06:30",
    "pattern_id": "secr_steel_freight",
    "service_type": "slow",
    "train_subtype": "freight",
    "rake_type": "BFNS_45",
    "rake_length": "45_car",
    "direction": "UP",
    "line_type": "UP_fast",
    "track_type": "up_fast",
    "track_variant": "up_fast_2",
    "lane_index": 1,
    "lane_count": 2,
    "from": "DURG",
    "to": "BSP",
    "departure": "06:30",
    "peak": False,
    "color": "#475569",
    "speed_profile": "slow",
    "flags": {
        "is_ac": False,
        "is_womens": False,
        "is_fast": False,
        "is_peak_service": False
    },
    "stop_times": steel_stops
})

script_dir = os.path.dirname(os.path.abspath(__file__))
out_file = os.path.join(script_dir, "secrTimetable.json")
with open(out_file, "w") as f:
    json.dump(trains, f, indent=2)

# Also write to api simulation directory
api_sim_dir = os.path.abspath(os.path.join(script_dir, "../api/src/services/simulation"))
api_out_file = os.path.join(api_sim_dir, "secrTimetable.json")
with open(api_out_file, "w") as f:
    json.dump(trains, f, indent=2)

print(f"Generated {out_file} and {api_out_file} with {len(trains)} SECR trains")
