"""
explanation_engine.py
=======================
Generates human-readable explanations STRICTLY from structured
optimizer/recommendation/conflict data. No LLM is used here, and no
numeric value in the output is invented -- every number is read
directly from the Recommendation / Conflict objects passed in.

An LLM (e.g. Gemini) MAY be used downstream, purely as a
"structured-facts -> nicer prose" formatter, but is not required for
the system to be explainable, and is NOT called from this module.
See explanation/llm_formatter.py for that optional, clearly-labelled
integration point.
"""
from dataclasses import asdict
from typing import Optional

from conflicts.conflict_detector import Conflict
from recommendation.recommendation_engine import Recommendation


def explain_recommendation(conflict: Optional[Conflict], recommendation: Recommendation) -> dict:
    held_trains = [
        tid for tid, a in recommendation.assignments.items() if a["hold_sec"] > 0
    ]
    proceeding_trains = [
        tid for tid, a in recommendation.assignments.items() if a["hold_sec"] == 0
    ]

    what_happened = (
        f"Conflict {conflict.conflict_id} ({conflict.conflict_type}) detected at "
        f"{conflict.location} between {', '.join(conflict.trains)}, predicted in "
        f"~{conflict.predicted_time_sec:.0f}s with probability {conflict.probability:.2f}."
        if conflict else "Evaluating a scheduling decision (no single triggering conflict record supplied)."
    )

    why_selected = (
        f"This option minimizes total weighted delay (objective={recommendation.objective_value:.0f}), "
        f"which accounts for train priority: higher-priority trains are held less."
    )

    impact = {
        "total_weighted_delay_sec": recommendation.total_weighted_delay_sec,
        "total_weighted_delay_min": round(recommendation.total_weighted_delay_sec / 60, 2),
        "travel_time_penalty_sec": recommendation.total_travel_time_penalty_sec,
        "per_train": recommendation.assignments,
    }

    predicted_delays = {
        train_id: assignment.get("predicted_delay_min", 0.0)
        for train_id, assignment in recommendation.assignments.items()
    }

    safety_explanation = (
        "All configured safety constraints (headway, block occupancy, platform occupancy, "
        "direction conflicts, speed limits) were checked and passed."
        if recommendation.is_safe else
        "REJECTED by the safety validator: " + "; ".join(recommendation.safety_reasons)
    )

    if_rejected = (
        "If the controller rejects this recommendation, the conflict remains open. "
        "The system will re-optimize on the next telemetry/state update, or the "
        "controller may request alternative options or apply a manual override "
        "(which is itself re-validated for safety before being applied)."
    )

    return {
        "what_happened": what_happened,
        "conflict": asdict(conflict) if conflict else None,
        "trains_involved": conflict.trains if conflict else list(recommendation.assignments.keys()),
        "held_trains": held_trains,
        "proceeding_trains": proceeding_trains,
        "why_this_recommendation": why_selected,
        "expected_impact": impact,
        "safety_status": "PASS" if recommendation.is_safe else "FAIL",
        "safety_explanation": safety_explanation,
        "if_rejected": if_rejected,
        "recommendation_score": recommendation.recommendation_score,
        "predicted_delay_by_train": predicted_delays,
    }
