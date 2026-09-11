import json
from datetime import datetime, timedelta
import random

# -----------------------
# PATTERNS (STATION ORDER)
# -----------------------

csmt_kalyan_slow = [
    "CSMT","MASJID","SANDHURST_ROAD","BYCULLA","CHINCHPOKLI","CURREY_ROAD",
    "PAREL","DADAR","MATUNGA","SION","KURLA","VIDYAVIHAR","GHATKOPAR",
    "VIKHROLI","KANJUR_MARG","BHANDUP","NAHUR","MULUND","THANE","KALVA",
    "MUMBRA","DIVA","KOPAR","DOMBIVLI","THAKURLI","KALYAN"
]
kalyan_csmt_slow = list(reversed(csmt_kalyan_slow))

csmt_kalyan_fast = [
    "CSMT","BYCULLA","DADAR","KURLA","GHATKOPAR","THANE","DOMBIVLI","KALYAN"
]
kalyan_csmt_fast = list(reversed(csmt_kalyan_fast))


# ---------------
# SECTION TIMES (minutes between consecutive stations)
# ---------------

# 25 hops → 26 stations
slow_up_times = [
    3,2,3,2,2,3,3,3,3,4,   # CSMT → SION
    3,3,3,3,3,3,3,5,5,4,   # KURLA → KALVA
    4,5,4,4,5              # MUMBRA → KALYAN
]
slow_down_times = list(reversed(slow_up_times))

# 7 hops → 8 stations
fast_up_times = [7,6,8,10,11,15,8]
fast_down_times = list(reversed(fast_up_times))


# -----------------------
# SERVICE META
# -----------------------

SERVICE_META = {
    "slow":        {"color": "#007AFF", "speed_profile": "slow"},
    "fast":        {"color": "#FF3B30", "speed_profile": "fast"},
    "ac_slow":     {"color": "#34C759", "speed_profile": "slow"},
    "ac_fast":     {"color": "#FF9500", "speed_profile": "fast"},
    "womens_slow": {"color": "#AF52DE", "speed_profile": "slow"},
    "womens_fast": {"color": "#AF52DE", "speed_profile": "fast"}
}

RAKE_TYPES   = ["MRVC", "ICF"]
RAKE_LENGTHS = ["12_car", "15_car"]


# -----------------------
# LANE / TRACK HELPERS
# -----------------------

def lane_metadata(service_type: str, direction: str, idx: int) -> dict:
    """
    Decide track_type, variant, and lane metadata to align with split-track rendering.
    - Slow services get two lanes per direction to mirror up_slow_1/2 and down_slow_1/2.
    - Fast services default to a single lane (variant == track_type).
    - AC/Women's inherit slow/fast lane counts from their speed role.
    """
    direction_key = direction.lower()  # "up" or "down"
    speed_role = "fast" if service_type.endswith("fast") or service_type == "fast" else "slow"
    track_type = f"{direction_key}_{speed_role}"

    if speed_role == "slow":
        lane_count = 2
        lane_index = (idx - 1) % lane_count  # spread alternately 0/1
        track_variant = f"{track_type}_{lane_index + 1}"
    else:
        lane_count = 1
        lane_index = 0
        track_variant = track_type

    return {
        "track_type": track_type,
        "track_variant": track_variant,
        "lane_index": lane_index,
        "lane_count": lane_count,
    }


# -----------------------
# HELPERS
# -----------------------

def create_train_id(prefix: str, idx: int) -> str:
    return f"{prefix}_{idx}"

def expand_stops(start_time_str: str, stops: list[str], section_times: list[int]) -> list[dict]:
    """
    Given a departure time at stops[0], compute arrival+departure at each station.
    arrival == departure at each stop (no dwell simulation here).
    """
    t = datetime.strptime(start_time_str, "%H:%M")
    result = [{
        "station": stops[0],
        "arrival": t.strftime("%H:%M"),
        "departure": t.strftime("%H:%M")
    }]

    for minutes, station in zip(section_times, stops[1:]):
        t += timedelta(minutes=minutes)
        ts = t.strftime("%H:%M")
        result.append({
            "station": station,
            "arrival": ts,
            "departure": ts
        })

    return result

def generate_block(
    start: datetime,
    end: datetime,
    freq_min: int,
    stops: list[str],
    pattern_id: str,
    section_times: list[int],
    service_type: str,
    direction: str,      # "UP" or "DOWN"
    id_prefix: str
) -> list[dict]:
    """
    Generate a block of trains of the same pattern between [start, end] (inclusive),
    spaced by freq_min minutes.
    """
    trains = []
    t = start
    idx = 1

    while t <= end:
        dep = t.strftime("%H:%M")
        train_id = create_train_id(id_prefix, idx)

        lane_meta = lane_metadata(service_type, direction, idx)

        meta = SERVICE_META[service_type]
        color = meta["color"]
        speed_profile = meta["speed_profile"]

        train = {
            "train_id": train_id,
            "trip_id": f"{train_id}_{dep}",     # unique per departure
            "pattern_id": pattern_id,
            "service_type": service_type,       # slow / fast / ac_slow / womens_fast etc.
            "train_subtype": "regular",
            "rake_type": random.choice(RAKE_TYPES),
            "rake_length": random.choice(RAKE_LENGTHS),
            "direction": direction,             # "UP" or "DOWN"
            "line_type": f"{direction}_{service_type}",  # e.g. UP_slow
            "track_type": lane_meta["track_type"],
            "track_variant": lane_meta["track_variant"],
            "lane_index": lane_meta["lane_index"],
            "lane_count": lane_meta["lane_count"],
            "from": stops[0],
            "to": stops[-1],
            "departure": dep,
            "peak": "07:00" <= dep <= "10:00",
            "color": color,
            "speed_profile": speed_profile,
            "flags": {
                "is_ac": service_type.startswith("ac"),
                "is_womens": "womens" in service_type,
                "is_fast": service_type.endswith("fast") or service_type == "fast",
                "is_peak_service": "07:00" <= dep <= "10:00"
            },
            "stop_times": expand_stops(dep, stops, section_times)
        }

        trains.append(train)
        t += timedelta(minutes=freq_min)
        idx += 1

    return trains


# -----------------------
# COMPUTE CUMULATIVE TIMES
# -----------------------

def compute_cumulative_times(section_times: list[int]) -> list[int]:
    """
    Given section times [t0, t1, ...], compute cumulative arrival times at each station.
    E.g., [3, 2, 3] → [0, 3, 5, 8]
    """
    cumulative = [0]
    for t in section_times:
        cumulative.append(cumulative[-1] + t)
    return cumulative

slow_cumulative = compute_cumulative_times(slow_up_times)
fast_cumulative = compute_cumulative_times(fast_up_times)


# -----------------------
# PRE-POSITION TRAINS AT STATIONS
# -----------------------

def create_prepositioned_train(
    train_id: str,
    trip_id: str,
    pattern_id: str,
    service_type: str,
    direction: str,
    stops: list[str],
    section_times: list[int],
    departure_time_str: str,  # departure at stops[0]
    start_station_idx: int,    # which station is the train starting from?
    idx: int
) -> dict:
    """
    Create a train that starts its journey from start_station_idx (not from stops[0]).
    Adjust the stop_times to reflect this mid-journey start.
    """
    meta = SERVICE_META[service_type]
    color = meta["color"]
    speed_profile = meta["speed_profile"]
    
    lane_meta = lane_metadata(service_type, direction, idx)
    
    # Build stop times from start_station_idx onwards
    stop_times = []
    t = datetime.strptime(departure_time_str, "%H:%M")
    for i in range(start_station_idx, len(stops)):
        ts = t.strftime("%H:%M")
        stop_times.append({
            "station": stops[i],
            "arrival": ts,
            "departure": ts
        })
        if i < len(stops) - 1:
            t += timedelta(minutes=section_times[i - start_station_idx])
    
    return {
        "train_id": train_id,
        "trip_id": trip_id,
        "pattern_id": pattern_id,
        "service_type": service_type,
        "train_subtype": "regular",
        "rake_type": random.choice(RAKE_TYPES),
        "rake_length": random.choice(RAKE_LENGTHS),
        "direction": direction,
        "line_type": f"{direction}_{service_type}",
        "track_type": lane_meta["track_type"],
        "track_variant": lane_meta["track_variant"],
        "lane_index": lane_meta["lane_index"],
        "lane_count": lane_meta["lane_count"],
        "from": stops[start_station_idx],
        "to": stops[-1],
        "departure": departure_time_str,
        "peak": "07:00" <= departure_time_str <= "10:00",
        "color": color,
        "speed_profile": speed_profile,
        "flags": {
            "is_ac": service_type.startswith("ac"),
            "is_womens": "womens" in service_type,
            "is_fast": service_type.endswith("fast") or service_type == "fast",
            "is_peak_service": "07:00" <= departure_time_str <= "10:00"
        },
        "stop_times": stop_times
    }


# -----------------------
# GENERATE EXACT FIXED TIMETABLE
# -----------------------

if __name__ == "__main__":
    all_trains = []
    
    # UP SLOW from CSMT: 06:00, 06:02, 06:05
    csmt_idx = 0
    all_trains.append(create_prepositioned_train(
        train_id="UP_SLOW_1",
        trip_id="UP_SLOW_1_06:00",
        pattern_id="csmt_kalyan_slow_v1",
        service_type="slow",
        direction="UP",
        stops=csmt_kalyan_slow,
        section_times=slow_up_times,
        departure_time_str="06:00",
        start_station_idx=csmt_idx,
        idx=1
    ))
    
    all_trains.append(create_prepositioned_train(
        train_id="UP_SLOW_2",
        trip_id="UP_SLOW_2_06:02",
        pattern_id="csmt_kalyan_slow_v1",
        service_type="slow",
        direction="UP",
        stops=csmt_kalyan_slow,
        section_times=slow_up_times,
        departure_time_str="06:02",
        start_station_idx=csmt_idx,
        idx=2
    ))
    
    all_trains.append(create_prepositioned_train(
        train_id="UP_SLOW_3",
        trip_id="UP_SLOW_3_06:05",
        pattern_id="csmt_kalyan_slow_v1",
        service_type="slow",
        direction="UP",
        stops=csmt_kalyan_slow,
        section_times=slow_up_times,
        departure_time_str="06:05",
        start_station_idx=csmt_idx,
        idx=3
    ))
    
    # UP FAST from CSMT: 06:01
    all_trains.append(create_prepositioned_train(
        train_id="UP_FAST_1",
        trip_id="UP_FAST_1_06:01",
        pattern_id="csmt_kalyan_fast_v1",
        service_type="fast",
        direction="UP",
        stops=csmt_kalyan_fast,
        section_times=fast_up_times,
        departure_time_str="06:01",
        start_station_idx=0,
        idx=1
    ))
    
    # UP SLOW from DADAR: 06:03
    dadar_idx_slow = csmt_kalyan_slow.index("DADAR")
    all_trains.append(create_prepositioned_train(
        train_id="UP_SLOW_4",
        trip_id="UP_SLOW_4_06:03",
        pattern_id="csmt_kalyan_slow_v1",
        service_type="slow",
        direction="UP",
        stops=csmt_kalyan_slow,
        section_times=slow_up_times,
        departure_time_str="06:03",
        start_station_idx=dadar_idx_slow,
        idx=4
    ))
    
    # DOWN FAST from THANE: 06:10
    thane_idx_fast = kalyan_csmt_fast.index("THANE")
    all_trains.append(create_prepositioned_train(
        train_id="DOWN_FAST_1",
        trip_id="DOWN_FAST_1_06:10",
        pattern_id="kalyan_csmt_fast_v1",
        service_type="fast",
        direction="DOWN",
        stops=kalyan_csmt_fast,
        section_times=fast_down_times,
        departure_time_str="06:10",
        start_station_idx=thane_idx_fast,
        idx=1
    ))
    
    # DOWN SLOW from KALYAN: 06:05
    kalyan_idx_slow = 0
    all_trains.append(create_prepositioned_train(
        train_id="DOWN_SLOW_1",
        trip_id="DOWN_SLOW_1_06:05",
        pattern_id="kalyan_csmt_slow_v1",
        service_type="slow",
        direction="DOWN",
        stops=kalyan_csmt_slow,
        section_times=slow_down_times,
        departure_time_str="06:05",
        start_station_idx=kalyan_idx_slow,
        idx=1
    ))
    
    # DOWN FAST from KALYAN: 06:05
    all_trains.append(create_prepositioned_train(
        train_id="DOWN_FAST_2",
        trip_id="DOWN_FAST_2_06:05",
        pattern_id="kalyan_csmt_fast_v1",
        service_type="fast",
        direction="DOWN",
        stops=kalyan_csmt_fast,
        section_times=fast_down_times,
        departure_time_str="06:05",
        start_station_idx=0,
        idx=2
    ))

    with open("full_timetable.json", "w") as f:
        json.dump(all_trains, f, indent=2)

    print(f"Generated {len(all_trains)} trains into full_timetable.json")
    print("\nFixed train roster:")
    print("  UP_SLOW from CSMT: 06:00, 06:02, 06:05")
    print("  UP_FAST from CSMT: 06:01")
    print("  UP_SLOW from DADAR: 06:03")
    print("  DOWN_FAST from THANE: 06:10")
    print("  DOWN_SLOW from KALYAN: 06:05")
    print("  DOWN_FAST from KALYAN: 06:05")
