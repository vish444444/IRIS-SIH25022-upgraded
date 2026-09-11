import json
import math

# ----------- CONFIG -----------
SECTOR_LEN = 320        # ~ length of 15-coach EMU
MIN_SECTORS = 2        # ensure enough resolution for every segment


# ----------- HELPERS -----------

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (math.sin(dLat/2)**2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dLon/2)**2)
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))


def interpolate(p1, p2, t):
    return {
        "lat": p1["lat"] + (p2["lat"] - p1["lat"]) * t,
        "lng": p1["lng"] + (p2["lng"] - p1["lng"]) * t
    }


# ----------- MAIN FUNCTION -----------

def build_sectors(track_data):
    sectors = []

    for station_name, station in track_data.items():
        from_lat = station["lat"]
        from_lng = station["lng"]

        for track_type, track_info in station["tracks"].items():
            # New structure: track_info has "segments" array
            segments = track_info.get("segments", [])
            if not segments:
                continue

            for segment in segments:
                to_station = segment["to_station"]

                if to_station not in track_data:
                    continue

                next_station = track_data[to_station]
                to_lat = next_station["lat"]
                to_lng = next_station["lng"]

                # compute distance
                dist = haversine(from_lat, from_lng, to_lat, to_lng)

                # compute number of sectors
                count = max(MIN_SECTORS, math.ceil(dist / SECTOR_LEN))

                # Process split variants (parallel lanes between stations)
                split_variants = segment.get("split", {})
                lane_names = list(split_variants.keys())
                lane_count = max(1, len(lane_names))

                for lane_index, split_track_name in enumerate(lane_names):
                    split_info = split_variants[split_track_name]
                    for nxt in split_info.get("next", []):
                        next_station_name, next_track = nxt.split(".")

                        for i in range(count):
                            start = interpolate(
                                {"lat": from_lat, "lng": from_lng},
                                {"lat": to_lat, "lng": to_lng},
                                i / count
                            )
                            end = interpolate(
                                {"lat": from_lat, "lng": from_lng},
                                {"lat": to_lat, "lng": to_lng},
                                (i + 1) / count
                            )
                            seg_len = haversine(start["lat"], start["lng"], end["lat"], end["lng"])

                            sector_id = f"{station_name}__{split_track_name}__{to_station}__{i}"

                            sectors.append({
                                "sector_id": sector_id,
                                "track_type": track_type,
                                "split_variant": split_track_name,
                                "lane_index": lane_index,
                                "lane_count": lane_count,
                                "from_station": station_name,
                                "to_station": to_station,
                                "next_station": next_station_name,
                                "index": i,
                                "start": start,
                                "end": end,
                                "lengthMeters": seg_len,
                                # Placeholders for linking; computed in post-process
                                "next_sectors": [],
                                "prev_sectors": []
                            })

    # Post-process: link sectors via next/prev based on track topology
    link_sectors(sectors, track_data)
    return sectors


def link_sectors(sectors, track_data):
    """
    Build next/prev links so signal logic can propagate without array indexing.
    For each sector, find sectors that follow it (next) or precede it (prev).
    """
    # Group by variant key for fast lookup
    by_variant = {}
    for sec in sectors:
        key = f"{sec['split_variant']}__{sec['from_station']}__{sec['to_station']}"
        if key not in by_variant:
            by_variant[key] = []
        by_variant[key].append(sec)

    # Sort each variant group by index
    for lst in by_variant.values():
        lst.sort(key=lambda s: s["index"])

    # Link within same station pair (sequential sectors)
    for lst in by_variant.values():
        for i in range(len(lst)):
            if i + 1 < len(lst):
                lst[i]["next_sectors"].append(lst[i + 1]["sector_id"])
            if i > 0:
                lst[i]["prev_sectors"].append(lst[i - 1]["sector_id"])

    # Link across station boundaries (last sector -> first of next segment)
    # Use topology from track_data
    for sec in sectors:
        # If this is the last sector of its segment, find the next segment(s)
        variant_key = f"{sec['split_variant']}__{sec['from_station']}__{sec['to_station']}"
        group = by_variant.get(variant_key, [])
        if not group:
            continue
        last_in_group = group[-1]
        if sec["sector_id"] != last_in_group["sector_id"]:
            continue

        # Look up next station/track from track_data topology
        station_name = sec["to_station"]
        split_variant = sec["split_variant"]
        track_type = sec["track_type"]

        if station_name not in track_data:
            continue
        station_obj = track_data[station_name]
        tracks = station_obj.get("tracks", {})
        track_info = tracks.get(track_type, {})
        segments = track_info.get("segments", [])

        for segment in segments:
            split_obj = segment.get("split", {})
            variant_info = split_obj.get(split_variant, {})
            next_list = variant_info.get("next", [])
            for nxt in next_list:
                # nxt format: "NEXT_STATION.next_track"
                parts = nxt.split(".")
                if len(parts) != 2:
                    continue
                next_station_name, next_track = parts

                # Find first sector of next segment
                next_key = f"{split_variant}__{station_name}__{next_station_name}"
                next_group = by_variant.get(next_key, [])
                if next_group:
                    first_next = next_group[0]
                    sec["next_sectors"].append(first_next["sector_id"])
                    first_next["prev_sectors"].append(sec["sector_id"])


# ----------- RUN SCRIPT -----------

if __name__ == "__main__":
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    with open(os.path.join(script_dir, "sampleTrackData.json"), "r") as f:
        track_data = json.load(f)

    sectors = build_sectors(track_data)

    with open(os.path.join(script_dir, "sectors.json"), "w") as f:
        json.dump(sectors, f, indent=2)

    print("Generated sectors.json!")
