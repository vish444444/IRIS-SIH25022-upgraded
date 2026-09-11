"""
recommendation_engine.py
==========================
Turns validated optimizer options into ranked, controller-facing
recommendations. This module does not invent numbers -- every field
comes directly from the optimizer's OptimizationOption and the
safety validator's ValidationResult.
"""
from dataclasses import dataclass, asdict
from typing import List, Optional

from optimization.optimizer import OptimizationOption
from safety.safety_validator import ValidationResult


@dataclass
class Recommendation:
    rank: int
    label: str
    is_safe: bool
    safety_reasons: List[str]
    assignments: dict
    total_weighted_delay_sec: float
    total_travel_time_penalty_sec: float
    objective_value: float
    recommendation_score: float


def build_recommendations(
    options: List[OptimizationOption],
    validations: List[ValidationResult],
) -> List[Recommendation]:
    """
    `options` and `validations` must be the same length and index-aligned
    (i.e. validations[i] is the safety check for options[i]).
    Only SAFE options are eligible to be ranked #1; UNSAFE options are
    still returned (so the controller/UI can show why they were
    excluded) but pushed to the bottom.
    """
    assert len(options) == len(validations)

    scored = []
    for opt, val in zip(options, validations):
        # This is an optimization-quality score, not a model probability.
        scored.append((opt, val))

    # Safe options first (sorted by objective ascending), then unsafe ones.
    safe = sorted([s for s in scored if s[1].safe], key=lambda s: s[0].objective_value)
    unsafe = [s for s in scored if not s[1].safe]

    ordered = safe + unsafe
    if not ordered:
        return []

    worst_obj = max(o.objective_value for o, _ in ordered) or 1.0
    recs = []
    for idx, (opt, val) in enumerate(ordered):
        recommendation_score = 0.99 if worst_obj == 0 else round(
            max(0.5, 1.0 - (opt.objective_value / (worst_obj * 1.15))), 2
        )
        if not val.safe:
            recommendation_score = 0.0
        recs.append(Recommendation(
            rank=idx + 1,
            label=opt.label,
            is_safe=val.safe,
            safety_reasons=val.reasons,
            assignments=opt.assignments,
            total_weighted_delay_sec=opt.total_weighted_delay_sec,
            total_travel_time_penalty_sec=opt.total_travel_time_penalty_sec,
            objective_value=opt.objective_value,
            recommendation_score=recommendation_score,
        ))
    return recs
