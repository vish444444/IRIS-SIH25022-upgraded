"""
generate_dataset.py
====================

IMPORTANT / HONESTY NOTICE
---------------------------
This script generates 100% SYNTHETIC / SIMULATED training data.
It is NOT real Indian Railways operational data. It is a documented,
rule-based + randomised generator built to resemble the kind of features
that would exist in a real train-delay dataset for the IRIS Mumbai
suburban corridor simulation (CSMT <-> Kalyan, 26 stations).

Every row is generated from an explicit scenario template (see
SCENARIOS below) with Gaussian noise applied to the parameters. The
target column `future_delay_min` is derived using a hand-written,
documented formula (see `compute_future_delay`) -- it is not learned
from anything, so the ML model trained on this data is only ever
demonstrating that it can recover the structure we deliberately
injected. This is disclosed explicitly here and in AI_MODEL.md so
nobody mistakes this for a real predictive breakthrough on real
railway data.

Usage:
    python generate_dataset.py --rows 8000 --out synthetic_train_delays.csv
"""

import argparse
import numpy as np
import pandas as pd

RNG_SEED = 42

TRAIN_TYPES = ["slow", "fast", "ac", "womens"]
TRAIN_TYPE_BASE_SPEED = {"slow": 45, "fast": 65, "ac": 58, "womens": 42}

# Priority: 1 = highest (e.g. express/VIP), 5 = lowest (e.g. empty rake)
PRIORITY_LEVELS = [1, 2, 3, 4, 5]

# Documented synthetic scenario templates.
# Each scenario perturbs the "normal" feature distribution in a specific,
# named way so the generated data has interpretable structure.
SCENARIOS = [
    "NORMAL",
    "MINOR_DELAY",
    "HEAVY_DELAY",
    "CONGESTION",
    "BREAKDOWN",
    "TRACK_BLOCKAGE",
    "PLATFORM_CONFLICT",
    "SIGNAL_RESTRICTION",
]

FEATURE_COLUMNS = [
    "current_delay_min",
    "train_type_code",
    "priority",
    "current_speed_kmh",
    "previous_speed_kmh",
    "dwell_time_sec",
    "distance_to_next_km",
    "section_occupancy",      # 0-1: fraction of block sections ahead occupied
    "trains_ahead",           # count of trains within next 3 sections
    "congestion_index",       # 0-1 composite congestion score
    "platform_available",     # 0/1
    "disruption_active",      # 0/1
    "scheduled_headway_sec",  # planned separation from preceding train
]

TARGET_COLUMN = "future_delay_min"


def _train_type_code(t: str) -> int:
    return TRAIN_TYPES.index(t)


def compute_future_delay(row: dict, scenario: str, rng: np.random.Generator) -> float:
    """
    Documented, hand-written formula for the synthetic target.
    This is intentionally simple and explainable -- it is NOT meant to
    model real physics precisely, only to give the ML model a learnable,
    realistic-shaped signal for demo purposes.
    """
    base = row["current_delay_min"] * 0.85  # delay tends to persist

    # Slower current speed relative to type's cruising speed adds delay
    speed_deficit = max(0.0, TRAIN_TYPE_BASE_SPEED[TRAIN_TYPES[row["train_type_code"]]] - row["current_speed_kmh"])
    base += speed_deficit * 0.05

    # Congestion & occupancy compound delay
    base += row["congestion_index"] * 6.0
    base += row["section_occupancy"] * 4.0
    base += row["trains_ahead"] * 0.8

    # Dwell overruns
    expected_dwell = 30 if row["train_type_code"] != TRAIN_TYPES.index("fast") else 20
    dwell_overrun = max(0.0, (row["dwell_time_sec"] - expected_dwell) / 60.0)
    base += dwell_overrun

    # Platform / disruption penalties
    if row["platform_available"] == 0:
        base += rng.uniform(2, 6)
    if row["disruption_active"] == 1:
        base += rng.uniform(3, 10)

    # Lower priority trains absorb more of the delay (held more often)
    base += (row["priority"] - 1) * 0.6

    # Headway violations amplify delay
    if row["scheduled_headway_sec"] < 180:
        base += rng.uniform(1, 4)

    # Scenario-specific shocks (explicit, documented, synthetic)
    scenario_shock = {
        "NORMAL": rng.uniform(-1.0, 1.0),
        "MINOR_DELAY": rng.uniform(1.0, 4.0),
        "HEAVY_DELAY": rng.uniform(8.0, 20.0),
        "CONGESTION": rng.uniform(4.0, 10.0),
        "BREAKDOWN": rng.uniform(15.0, 40.0),
        "TRACK_BLOCKAGE": rng.uniform(10.0, 30.0),
        "PLATFORM_CONFLICT": rng.uniform(3.0, 9.0),
        "SIGNAL_RESTRICTION": rng.uniform(2.0, 7.0),
    }[scenario]
    base += scenario_shock

    # Noise floor + clamp to non-negative
    base += rng.normal(0, 0.5)
    return float(max(0.0, base))


def generate_row(scenario: str, rng: np.random.Generator) -> dict:
    train_type = rng.choice(TRAIN_TYPES)
    priority = int(rng.choice(PRIORITY_LEVELS, p=[0.15, 0.25, 0.3, 0.2, 0.1]))
    base_speed = TRAIN_TYPE_BASE_SPEED[train_type]

    # Scenario-conditioned feature distributions (documented, synthetic)
    if scenario == "NORMAL":
        current_delay = max(0, rng.normal(1.0, 1.0))
        congestion = rng.uniform(0.0, 0.25)
        occupancy = rng.uniform(0.0, 0.3)
        trains_ahead = rng.integers(0, 2)
        platform_avail = 1
        disruption = 0
        speed = max(5, rng.normal(base_speed, 5))
    elif scenario == "MINOR_DELAY":
        current_delay = max(0, rng.normal(4, 2))
        congestion = rng.uniform(0.1, 0.4)
        occupancy = rng.uniform(0.1, 0.4)
        trains_ahead = rng.integers(0, 3)
        platform_avail = int(rng.random() > 0.1)
        disruption = 0
        speed = max(5, rng.normal(base_speed * 0.9, 6))
    elif scenario == "HEAVY_DELAY":
        current_delay = max(0, rng.normal(15, 5))
        congestion = rng.uniform(0.3, 0.7)
        occupancy = rng.uniform(0.3, 0.7)
        trains_ahead = rng.integers(1, 4)
        platform_avail = int(rng.random() > 0.3)
        disruption = int(rng.random() > 0.6)
        speed = max(5, rng.normal(base_speed * 0.7, 8))
    elif scenario == "CONGESTION":
        current_delay = max(0, rng.normal(6, 3))
        congestion = rng.uniform(0.6, 0.95)
        occupancy = rng.uniform(0.5, 0.9)
        trains_ahead = rng.integers(2, 6)
        platform_avail = int(rng.random() > 0.4)
        disruption = 0
        speed = max(5, rng.normal(base_speed * 0.6, 7))
    elif scenario == "BREAKDOWN":
        current_delay = max(0, rng.normal(20, 8))
        congestion = rng.uniform(0.4, 0.8)
        occupancy = rng.uniform(0.5, 1.0)
        trains_ahead = rng.integers(1, 5)
        platform_avail = int(rng.random() > 0.5)
        disruption = 1
        speed = max(0, rng.normal(base_speed * 0.2, 10))
    elif scenario == "TRACK_BLOCKAGE":
        current_delay = max(0, rng.normal(12, 6))
        congestion = rng.uniform(0.5, 0.9)
        occupancy = rng.uniform(0.7, 1.0)
        trains_ahead = rng.integers(2, 6)
        platform_avail = int(rng.random() > 0.3)
        disruption = 1
        speed = max(0, rng.normal(base_speed * 0.3, 10))
    elif scenario == "PLATFORM_CONFLICT":
        current_delay = max(0, rng.normal(5, 3))
        congestion = rng.uniform(0.2, 0.5)
        occupancy = rng.uniform(0.2, 0.5)
        trains_ahead = rng.integers(0, 3)
        platform_avail = 0
        disruption = 0
        speed = max(5, rng.normal(base_speed * 0.8, 6))
    else:  # SIGNAL_RESTRICTION
        current_delay = max(0, rng.normal(4, 2))
        congestion = rng.uniform(0.2, 0.5)
        occupancy = rng.uniform(0.3, 0.6)
        trains_ahead = rng.integers(0, 3)
        platform_avail = int(rng.random() > 0.2)
        disruption = 0
        speed = max(5, rng.normal(base_speed * 0.6, 5))

    previous_speed = max(0, speed + rng.normal(0, 4))
    dwell = max(0, rng.normal(30 if train_type != "fast" else 20, 10))
    distance_next = rng.uniform(0.8, 4.5)  # km, matches ~2km avg suburban stop spacing
    headway = max(60, rng.normal(240, 90))

    row = {
        "current_delay_min": round(current_delay, 2),
        "train_type_code": _train_type_code(train_type),
        "priority": priority,
        "current_speed_kmh": round(speed, 1),
        "previous_speed_kmh": round(previous_speed, 1),
        "dwell_time_sec": round(dwell, 1),
        "distance_to_next_km": round(distance_next, 2),
        "section_occupancy": round(occupancy, 3),
        "trains_ahead": int(trains_ahead),
        "congestion_index": round(congestion, 3),
        "platform_available": int(platform_avail),
        "disruption_active": int(disruption),
        "scheduled_headway_sec": round(headway, 1),
    }
    row[TARGET_COLUMN] = round(compute_future_delay(row, scenario, rng), 2)
    row["scenario"] = scenario  # kept for analysis, dropped before training
    return row


def generate_dataset(n_rows: int, seed: int = RNG_SEED) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n_rows):
        scenario = rng.choice(SCENARIOS, p=[0.35, 0.2, 0.08, 0.12, 0.05, 0.05, 0.08, 0.07])
        rows.append(generate_row(scenario, rng))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=8000)
    parser.add_argument("--out", type=str, default="synthetic_train_delays.csv")
    parser.add_argument("--seed", type=int, default=RNG_SEED)
    args = parser.parse_args()

    df = generate_dataset(args.rows, args.seed)
    df.to_csv(args.out, index=False)
    print(f"[generate_dataset] Wrote {len(df)} SYNTHETIC rows to {args.out}")
    print(df["scenario"].value_counts())
