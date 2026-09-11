"""
conflict_detector.py
======================
Deterministic conflict detection over predicted train trajectories.
This is NOT a machine-learned classifier -- conflicts in a rail
network are a function of scheduled/predicted occupancy geometry, so
they are computed directly. (The DELAY that feeds these predicted
trajectories can come from the ML delay model in prediction/, but the
conflict logic itself is rule-based and auditable, matching the
"deterministic safety-adjacent logic" requirement.)

Detects:
  - section/block occupation conflicts (two trains need the same
    section within an unsafe window)
  - opposing movement conflicts on single-line sections
  - platform conflicts (two trains assigned the same platform with
    overlapping windows)
  - excessive headway violations (early warning before they become a
    hard safety violation)
"""
from dataclasses import dataclass
from typing import List, Optional
import itertools
import time


@dataclass
class PredictedOccupancy:
    train_id: str
    section_id: str
    platform_id: Optional[str]
    direction: str
    priority: int  # 1 = highest priority
    eta_enter_sec: float
    eta_exit_sec: float


@dataclass
class Conflict:
    conflict_id: str
    conflict_type: str
    severity: str  # LOW / MEDIUM / HIGH / CRITICAL
    trains: List[str]
    location: str
    predicted_time_sec: float
    probability: float
    reason: str
    affected_resources: List[str]


MIN_SAFE_HEADWAY_SEC = 120


def _severity_for_gap(gap_sec: float) -> (str, float):
    """Map a timing gap (or overlap, negative gap) to a severity + probability."""
    if gap_sec < 0:
        return "CRITICAL", 0.97
    if gap_sec < 60:
        return "HIGH", 0.87
    if gap_sec < MIN_SAFE_HEADWAY_SEC:
        return "MEDIUM", 0.6
    return "LOW", 0.25


def detect_conflicts(
    occupancies: List[PredictedOccupancy],
    single_line_sections: Optional[List[str]] = None,
) -> List[Conflict]:
    single_line_sections = single_line_sections or []
    conflicts: List[Conflict] = []
    counter = itertools.count(1)

    by_section: dict = {}
    for o in occupancies:
        by_section.setdefault(o.section_id, []).append(o)

    for section_id, occupants in by_section.items():
        occupants_sorted = sorted(occupants, key=lambda x: x.eta_enter_sec)
        for i in range(len(occupants_sorted) - 1):
            a, b = occupants_sorted[i], occupants_sorted[i + 1]
            gap = b.eta_enter_sec - a.eta_exit_sec
            if gap < MIN_SAFE_HEADWAY_SEC:
                severity, prob = _severity_for_gap(gap)
                conflict_type = (
                    "OPPOSING_MOVEMENT" if section_id in single_line_sections and a.direction != b.direction
                    else "BLOCK_OCCUPATION" if gap < 0
                    else "HEADWAY_VIOLATION"
                )
                reason = (
                    f"Both trains require section {section_id} within "
                    f"{max(gap, 0):.0f}s of each other"
                    if gap >= 0 else
                    f"Trains {a.train_id} and {b.train_id} would simultaneously occupy section {section_id}"
                )
                conflicts.append(Conflict(
                    conflict_id=f"CFL-{next(counter):04d}",
                    conflict_type=conflict_type,
                    severity=severity,
                    trains=[a.train_id, b.train_id],
                    location=section_id,
                    predicted_time_sec=b.eta_enter_sec,
                    probability=prob,
                    reason=reason,
                    affected_resources=[section_id],
                ))

    by_platform: dict = {}
    for o in occupancies:
        if o.platform_id:
            by_platform.setdefault(o.platform_id, []).append(o)

    for platform_id, occupants in by_platform.items():
        occupants_sorted = sorted(occupants, key=lambda x: x.eta_enter_sec)
        for i in range(len(occupants_sorted) - 1):
            a, b = occupants_sorted[i], occupants_sorted[i + 1]
            gap = b.eta_enter_sec - a.eta_exit_sec
            if gap < MIN_SAFE_HEADWAY_SEC:
                severity, prob = _severity_for_gap(gap)
                conflicts.append(Conflict(
                    conflict_id=f"CFL-{next(counter):04d}",
                    conflict_type="PLATFORM_CONFLICT",
                    severity=severity,
                    trains=[a.train_id, b.train_id],
                    location=platform_id,
                    predicted_time_sec=b.eta_enter_sec,
                    probability=prob,
                    reason=f"Both trains are assigned platform {platform_id} within {max(gap,0):.0f}s of each other",
                    affected_resources=[platform_id],
                ))

    # Sort worst-first
    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    conflicts.sort(key=lambda c: (order[c.severity], c.predicted_time_sec))
    return conflicts
