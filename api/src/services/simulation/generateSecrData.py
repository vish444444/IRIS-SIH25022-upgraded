import json
import os
import sys

# Import build_sectors from generateSectorBlocks
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)
from generateSectorBlocks import build_sectors

stations = [
    ("DURG", "Durg Junction", 21.1895, 81.2828),
    ("BPHB", "Bhilai Power House", 21.2091, 81.3653),
    ("BIA", "Bhilai", 21.2144, 81.4089),
    ("KMI", "Kumhari", 21.2294, 81.5147),
    ("SZB", "Sarona", 21.2403, 81.5724),
    ("SRWN", "Saraswati Nagar", 21.2472, 81.6033),
    ("R", "Raipur Junction (DRM HQ)", 21.2588, 81.6296),
    ("WRC", "WRS Colony", 21.2721, 81.6420),
    ("URK", "Urkura", 21.2947, 81.6521),
    ("MDH", "Mandhar", 21.3533, 81.6782),
    ("SLH", "Silyari", 21.4390, 81.6967),
    ("BKTH", "Baikunth", 21.5031, 81.7145),
    ("TLD", "Tilda Neora", 21.5615, 81.7481),
    ("HN", "Hathbandh", 21.6508, 81.7963),
    ("BYT", "Bhatapara", 21.7381, 81.8291),
    ("NPI", "Nipania", 21.8490, 81.8972),
    ("DGS", "Dagori", 21.9211, 81.9723),
    ("BYL", "Belha", 21.9682, 82.0289),
    ("DPH", "Dadhapara", 22.0322, 82.0911),
    ("BSP", "Bilaspur Junction", 22.0805, 82.1648),
]

def build_secr_track_data():
    track_data = {}
    n = len(stations)
    for idx, (code, name, lat, lng) in enumerate(stations):
        station_id = str(idx + 1)
        up_station = stations[idx + 1][0] if idx < n - 1 else None
        down_station = stations[idx - 1][0] if idx > 0 else None

        # Tracks structure
        tracks = {
            "up_slow": {"segments": []},
            "down_slow": {"segments": []},
            "up_fast": {"segments": []},
            "down_fast": {"segments": []},
        }

        # Up slow
        if up_station:
            if code == "R":
                tracks["up_slow"]["segments"].append({
                    "to_station": up_station,
                    "split": {
                        "up_slow_1": {"next": [f"{up_station}.up_slow_1"]},
                        "up_slow_2": {"next": [f"{up_station}.up_slow_2"]},
                    }
                })
            elif code == "WRC" and up_station:
                tracks["up_slow"]["segments"].append({
                    "to_station": up_station,
                    "split": {
                        "up_slow": {"next": [f"{up_station}.up_slow"]},
                    }
                })
            else:
                tracks["up_slow"]["segments"].append({
                    "to_station": up_station,
                    "split": {
                        "up_slow": {"next": [f"{up_station}.up_slow"]},
                    }
                })

        # Down slow
        if down_station:
            if code == "R":
                tracks["down_slow"]["segments"].append({
                    "to_station": down_station,
                    "split": {
                        "down_slow_1": {"next": [f"{down_station}.down_slow_1"]},
                        "down_slow_2": {"next": [f"{down_station}.down_slow_2"]},
                    }
                })
            else:
                tracks["down_slow"]["segments"].append({
                    "to_station": down_station,
                    "split": {
                        "down_slow": {"next": [f"{down_station}.down_slow"]},
                    }
                })

        # Up fast
        if up_station:
            if code == "R":
                tracks["up_fast"]["segments"].append({
                    "to_station": up_station,
                    "split": {
                        "up_fast_1": {"next": [f"{up_station}.up_fast_1"]},
                        "up_fast_2": {"next": [f"{up_station}.up_fast_2"]},
                    }
                })
            else:
                tracks["up_fast"]["segments"].append({
                    "to_station": up_station,
                    "split": {
                        "up_fast": {"next": [f"{up_station}.up_fast"]},
                    }
                })

        # Down fast
        if down_station:
            if code == "R":
                tracks["down_fast"]["segments"].append({
                    "to_station": down_station,
                    "split": {
                        "down_fast_1": {"next": [f"{down_station}.down_fast_1"]},
                        "down_fast_2": {"next": [f"{down_station}.down_fast_2"]},
                    }
                })
            else:
                tracks["down_fast"]["segments"].append({
                    "to_station": down_station,
                    "split": {
                        "down_fast": {"next": [f"{down_station}.down_fast"]},
                    }
                })

        track_data[code] = {
            "id": station_id,
            "name": name,
            "lat": lat,
            "lng": lng,
            "tracks": tracks
        }
    return track_data

if __name__ == "__main__":
    track_data = build_secr_track_data()
    out_track_file = os.path.join(script_dir, "sampleTrackSecrRaipurData.json")
    with open(out_track_file, "w") as f:
        json.dump(track_data, f, indent=2)
    print(f"Generated {out_track_file}")

    sectors = build_sectors(track_data)
    out_sectors_file = os.path.join(script_dir, "sectorsSecrRaipur.json")
    with open(out_sectors_file, "w") as f:
        json.dump(sectors, f, indent=2)
    print(f"Generated {out_sectors_file} with {len(sectors)} sectors")

    # Also generate secrStations.json for simulator
    sim_dir = os.path.abspath(os.path.join(script_dir, "../../../../simulator"))
    secr_stations = {
        "line_id": "secr-raipur",
        "stations": [
            {
                "code": code,
                "name": name,
                "lat": lat,
                "lng": lng,
                "order": idx + 1
            }
            for idx, (code, name, lat, lng) in enumerate(stations)
        ]
    }
    sim_stations_file = os.path.join(sim_dir, "secrStations.json")
    with open(sim_stations_file, "w") as f:
        json.dump(secr_stations, f, indent=2)
    print(f"Generated {sim_stations_file}")
