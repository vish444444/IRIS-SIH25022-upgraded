"""
safety_validator.py
=====================
Deterministic, rule-based safety validator. Contains NO machine learning
and NO optimization. This module is the final gate: the optimizer's
output is only ever a *proposal*; this module decides SAFE / UNSAFE.

The optimizer is never allowed to bypass this validator (see
optimization/optimizer.py, which calls this module before returning
any recommendation, and api/main.py, which re-validates before
accepting a manual override).

Constraints implemented (configurable via SafetyConfig):
  - block/sector occupancy (no two trains in the same sector)
  - minimum headway between trains on the same track
  - direction conflicts (opposing movement on a single-line section)
  - platform occupancy (no two trains on the same platform at once)
  - unavailable/blocked sectors
  - minimum dwell time
  - maximum permitted speed for the section/train type
"""
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class SafetyConfig:
    min_headway_seconds: int = 120
    min_dwell_seconds: int = 20
    max_speed_kmh: float = 100.0


@dataclass
class TrainPlan:
    """A single train's proposed state/action for validation."""
    train_id: str
    section_id: str
    platform_id: Optional[str]
    direction: str  # "up" or "down"
    enters_at_sec: float  # seconds from now the train enters `section_id`
    exits_at_sec: float   # seconds from now the train exits `section_id`
    planned_speed_kmh: float
    dwell_seconds: float = 0.0


@dataclass
class NetworkState:
    """Static/near-static facts the validator needs, supplied by the caller."""
    blocked_sectors: List[str] = field(default_factory=list)
    section_speed_limits: dict = field(default_factory=dict)  # section_id -> kmh
    single_line_sections: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    safe: bool
    reasons: List[str]


class SafetyValidator:
    def __init__(self, config: Optional[SafetyConfig] = None):
        self.config = config or SafetyConfig()

    def validate(self, plans: List[TrainPlan], state: NetworkState) -> ValidationResult:
        reasons: List[str] = []

        # 1. Blocked sector check
        for p in plans:
            if p.section_id in state.blocked_sectors:
                reasons.append(
                    f"Train {p.train_id} cannot enter sector {p.section_id} because it is BLOCKED."
                )

        # 2. Section occupancy + minimum headway (pairwise, same section)
        by_section: dict = {}
        for p in plans:
            by_section.setdefault(p.section_id, []).append(p)

        for section_id, occupants in by_section.items():
            occupants_sorted = sorted(occupants, key=lambda x: x.enters_at_sec)
            for i in range(len(occupants_sorted) - 1):
                a, b = occupants_sorted[i], occupants_sorted[i + 1]
                # Overlap check: does b enter before a exits?
                if b.enters_at_sec < a.exits_at_sec:
                    reasons.append(
                        f"Train {b.train_id} cannot enter sector {section_id} because it is "
                        f"occupied by {a.train_id} until t+{a.exits_at_sec:.0f}s."
                    )
                    continue
                headway = b.enters_at_sec - a.exits_at_sec
                if headway < self.config.min_headway_seconds:
                    reasons.append(
                        f"Headway violation in sector {section_id}: only {headway:.0f}s between "
                        f"{a.train_id} and {b.train_id} (minimum required: {self.config.min_headway_seconds}s)."
                    )

            # 3. Direction conflict on single-line sections
            if section_id in state.single_line_sections:
                directions = {o.direction for o in occupants}
                if len(directions) > 1:
                    overlapping = self._overlaps_exist(occupants)
                    if overlapping:
                        ids = ", ".join(o.train_id for o in occupants)
                        reasons.append(
                            f"Opposing-direction conflict in single-line sector {section_id}: "
                            f"trains {ids} require the section from opposite directions at overlapping times."
                        )

        # 4. Platform occupancy
        by_platform: dict = {}
        for p in plans:
            if p.platform_id:
                by_platform.setdefault(p.platform_id, []).append(p)
        for platform_id, occupants in by_platform.items():
            occupants_sorted = sorted(occupants, key=lambda x: x.enters_at_sec)
            for i in range(len(occupants_sorted) - 1):
                a, b = occupants_sorted[i], occupants_sorted[i + 1]
                if b.enters_at_sec < a.exits_at_sec:
                    reasons.append(
                        f"Platform conflict at {platform_id}: {b.train_id} would arrive while "
                        f"{a.train_id} still occupies the platform."
                    )

        # 5. Minimum dwell time
        for p in plans:
            if p.platform_id and 0 < p.dwell_seconds < self.config.min_dwell_seconds:
                reasons.append(
                    f"Train {p.train_id} dwell time {p.dwell_seconds:.0f}s is below the minimum "
                    f"required dwell of {self.config.min_dwell_seconds}s at {p.platform_id}."
                )

        # 6. Speed limit
        for p in plans:
            limit = state.section_speed_limits.get(p.section_id, self.config.max_speed_kmh)
            if p.planned_speed_kmh > limit:
                reasons.append(
                    f"Train {p.train_id} planned speed {p.planned_speed_kmh:.0f} km/h exceeds the "
                    f"permitted limit of {limit:.0f} km/h in sector {p.section_id}."
                )

        return ValidationResult(safe=(len(reasons) == 0), reasons=reasons)

    @staticmethod
    def _overlaps_exist(occupants: List[TrainPlan]) -> bool:
        occupants_sorted = sorted(occupants, key=lambda x: x.enters_at_sec)
        for i in range(len(occupants_sorted) - 1):
            a, b = occupants_sorted[i], occupants_sorted[i + 1]
            if b.enters_at_sec < a.exits_at_sec:
                return True
        return False
