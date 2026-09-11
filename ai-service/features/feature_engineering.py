"""
feature_engineering.py
========================
Converts raw train/section telemetry (as sent by the IRIS Node.js
backend) into the exact feature vector the delay-prediction model
expects (see data/generate_dataset.py:FEATURE_COLUMNS).

Also implements `compute_congestion_index`, a deterministic (rule-based,
NOT learned) congestion score used both as a model input feature and
exposed directly via `/ai/status` for the dashboard. Congestion here is
explicitly a formula over occupancy/traffic density, not a prediction --
it is disclosed as SIMULATED/derived, matching the honesty requirement.
"""
from typing import Dict, Any, List

TRAIN_TYPES = ["slow", "fast", "ac", "womens"]


def compute_congestion_index(section_occupancy: float, trains_ahead: int, disruption_active: bool) -> float:
    """Deterministic composite score in [0, 1]. Not ML -- documented formula."""
    score = 0.5 * section_occupancy + 0.08 * min(trains_ahead, 6)
    if disruption_active:
        score += 0.15
    return round(min(1.0, score), 3)


def build_feature_vector(raw: Dict[str, Any]) -> Dict[str, float]:
    """
    `raw` is expected to contain (all optional, sane defaults applied):
      current_delay_min, train_type ("slow"/"fast"/"ac"/"womens"), priority (1-5),
      current_speed_kmh, previous_speed_kmh, dwell_time_sec, distance_to_next_km,
      section_occupancy (0-1), trains_ahead (int), platform_available (bool),
      disruption_active (bool), scheduled_headway_sec
    """
    train_type = raw.get("train_type", "slow")
    train_type_code = TRAIN_TYPES.index(train_type) if train_type in TRAIN_TYPES else 0
    section_occupancy = float(raw.get("section_occupancy", 0.0))
    trains_ahead = int(raw.get("trains_ahead", 0))
    disruption_active = bool(raw.get("disruption_active", False))

    congestion = raw.get(
        "congestion_index",
        compute_congestion_index(section_occupancy, trains_ahead, disruption_active),
    )

    return {
        "current_delay_min": float(raw.get("current_delay_min", 0.0)),
        "train_type_code": train_type_code,
        "priority": int(raw.get("priority", 3)),
        "current_speed_kmh": float(raw.get("current_speed_kmh", 0.0)),
        "previous_speed_kmh": float(raw.get("previous_speed_kmh", 0.0)),
        "dwell_time_sec": float(raw.get("dwell_time_sec", 0.0)),
        "distance_to_next_km": float(raw.get("distance_to_next_km", 1.0)),
        "section_occupancy": section_occupancy,
        "trains_ahead": trains_ahead,
        "congestion_index": float(congestion),
        "platform_available": int(bool(raw.get("platform_available", True))),
        "disruption_active": int(disruption_active),
        "scheduled_headway_sec": float(raw.get("scheduled_headway_sec", 240.0)),
    }
