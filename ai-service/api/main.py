"""
main.py
========
FastAPI entrypoint for the IRIS AI Decision-Support Service.

This service is a DECISION-SUPPORT layer. It never issues movement
commands. Every optimizer output passes through the safety validator
before being returned, and every recommendation requires a human
controller's approval (enforced by the Node.js backend / frontend,
not by this service, but this service's contract assumes it).

Run:
    uvicorn api.main:app --reload --port 8001
"""
import os
import sys
import time
import uuid
from typing import List

import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.schemas import (  # noqa: E402
    DelayPredictRequest, DelayPredictResponse,
    ConflictDetectRequest, OptimizeRequest, ValidateRequest,
    RecommendRequest, OverrideRequest, WhatIfRequest,
)
from features.feature_engineering import build_feature_vector, compute_congestion_index  # noqa: E402
from conflicts.conflict_detector import detect_conflicts, PredictedOccupancy  # noqa: E402
from optimization.optimizer import optimize_precedence, TrainRequest  # noqa: E402
from safety.safety_validator import SafetyValidator, NetworkState, TrainPlan  # noqa: E402
from recommendation.recommendation_engine import build_recommendations  # noqa: E402
from explanation.explanation_engine import explain_recommendation  # noqa: E402
from data.generate_dataset import FEATURE_COLUMNS  # noqa: E402

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "delay_model.joblib")
METRICS_PATH = os.path.join(MODELS_DIR, "metrics.json")

app = FastAPI(
    title="IRIS AI Decision-Support Service",
    description=(
        "Delay prediction, conflict detection, OR-Tools optimization, "
        "safety validation, and explainable recommendations for the IRIS "
        "Mumbai suburban corridor simulation. Decision-support only -- "
        "no autonomous train control."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_delay_model = None
_model_metrics = {}
_safety_validator = SafetyValidator()

# In-memory history for the demo (mirrors what the Node backend also
# persists into SQLite via /api/ai proxy routes).
_optimization_runs: List[dict] = []
_recommendations_log: List[dict] = []


def _load_model():
    global _delay_model, _model_metrics
    if _delay_model is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(
                "Delay model not found. Run: python training/train_model.py"
            )
        _delay_model = joblib.load(MODEL_PATH)
        if os.path.exists(METRICS_PATH):
            import json
            with open(METRICS_PATH) as f:
                _model_metrics = json.load(f)
    return _delay_model


@app.on_event("startup")
def startup():
    try:
        _load_model()
        print("[ai-service] Delay model loaded OK.")
    except Exception as e:
        print(f"[ai-service] WARNING: {e}")


@app.get("/ai/status")
def status():
    model_loaded = os.path.exists(MODEL_PATH)
    if model_loaded:
        try:
            _load_model()
        except Exception:
            pass
    return {
        "service": "iris-ai-decision-support",
        "status": "ok",
        "model_loaded": model_loaded,
        "model_metrics": _model_metrics if model_loaded else None,
        "components": {
            "delay_prediction": "IMPLEMENTED (GradientBoostingRegressor, trained on synthetic data)",
            "conflict_detection": "IMPLEMENTED (deterministic, geometry-based)",
            "optimization_engine": "IMPLEMENTED (Google OR-Tools CP-SAT)",
            "safety_validator": "IMPLEMENTED (deterministic constraint checker)",
            "recommendation_engine": "IMPLEMENTED",
            "explanation_engine": "IMPLEMENTED (structured facts, no LLM invention)",
            "llm_usage": "NOT ACTIVE (optional formatter only, see explanation/llm_formatter.py)",
        },
        "recommendations_logged": len(_recommendations_log),
        "optimization_runs_logged": len(_optimization_runs),
    }


@app.post("/ai/predict-delay", response_model=DelayPredictResponse)
def predict_delay(req: DelayPredictRequest):
    model = _load_model()
    features = build_feature_vector(req.model_dump())
    import pandas as pd
    X = pd.DataFrame([[features[col] for col in FEATURE_COLUMNS]], columns=FEATURE_COLUMNS)
    pred = float(model.predict(X)[0])
    return DelayPredictResponse(
        predicted_future_delay_min=round(pred, 2),
        congestion_index=features["congestion_index"],
        model_type=_model_metrics.get("model_type", "GradientBoostingRegressor"),
        model_metrics={
            "MAE_minutes": _model_metrics.get("MAE_minutes"),
            "RMSE_minutes": _model_metrics.get("RMSE_minutes"),
            "R2": _model_metrics.get("R2"),
            "trained_on": "SYNTHETIC data (see AI_MODEL.md) -- not real railway data",
        },
    )


def _predict_delay_minutes(prediction_request: DelayPredictRequest | None) -> float:
    if prediction_request is None:
        return 0.0
    response = predict_delay(prediction_request)
    return response.predicted_future_delay_min


@app.post("/ai/detect-conflicts")
def detect_conflicts_endpoint(req: ConflictDetectRequest):
    occupancies = [
        PredictedOccupancy(
            train_id=o.train_id, section_id=o.section_id, platform_id=o.platform_id,
            direction=o.direction, priority=o.priority,
            eta_enter_sec=o.eta_enter_sec, eta_exit_sec=o.eta_exit_sec,
        )
        for o in req.occupancies
    ]
    conflicts = detect_conflicts(occupancies, req.single_line_sections)
    from dataclasses import asdict
    return {"count": len(conflicts), "conflicts": [asdict(c) for c in conflicts]}


@app.post("/ai/optimize")
def optimize_endpoint(req: OptimizeRequest):
    requests = [
        TrainRequest(
            train_id=r.train_id, resource_id=r.resource_id, priority=r.priority,
            requested_entry_sec=r.requested_entry_sec, transit_seconds=r.transit_seconds,
            max_hold_seconds=r.max_hold_seconds, reroute_available=r.reroute_available,
            reroute_extra_seconds=r.reroute_extra_seconds,
            predicted_delay_min=_predict_delay_minutes(r.prediction),
            current_delay_min=r.current_delay_min,
            scheduled_destination_arrival_sec=r.scheduled_destination_arrival_sec,
        )
        for r in req.requests
    ]
    result = optimize_precedence(requests, generate_alternatives=req.generate_alternatives)
    state = NetworkState(
        blocked_sectors=req.blocked_sectors,
        section_speed_limits=req.section_speed_limits,
        single_line_sections=req.single_line_sections,
    )
    run_id = f"OPT-{uuid.uuid4().hex[:8]}"
    log_entry = {
        "run_id": run_id,
        "timestamp": time.time(),
        "feasible": result["feasible"],
        "runtime_sec": result["runtime_sec"],
        "n_trains": len(requests),
        "n_options": len(result["options"]),
    }
    _optimization_runs.append(log_entry)
    return {
        "run_id": run_id,
        "feasible": result["feasible"],
        "runtime_sec": result["runtime_sec"],
        "options": [
            {
                "label": o.label,
                "assignments": o.assignments,
                "total_weighted_delay_sec": o.total_weighted_delay_sec,
                "total_travel_time_penalty_sec": o.total_travel_time_penalty_sec,
                "objective_value": o.objective_value,
                "predicted_delay_by_train": {
                    train_id: assignment.get("predicted_delay_min", 0.0)
                    for train_id, assignment in o.assignments.items()
                },
                "safety": {
                    "safe": _safety_validator.validate(
                        _plans_from_assignments(
                            o.assignments,
                            {r.train_id: r.transit_seconds for r in requests},
                            requests[0].resource_id,
                        ),
                        state,
                    ).safe,
                    "reasons": _safety_validator.validate(
                        _plans_from_assignments(
                            o.assignments,
                            {r.train_id: r.transit_seconds for r in requests},
                            requests[0].resource_id,
                        ),
                        state,
                    ).reasons,
                },
            }
            for o in result["options"]
        ],
    }


@app.post("/ai/validate")
def validate_endpoint(req: ValidateRequest):
    plans = [
        TrainPlan(
            train_id=p.train_id, section_id=p.section_id, platform_id=p.platform_id,
            direction=p.direction, enters_at_sec=p.enters_at_sec, exits_at_sec=p.exits_at_sec,
            planned_speed_kmh=p.planned_speed_kmh, dwell_seconds=p.dwell_seconds,
        )
        for p in req.plans
    ]
    state = NetworkState(
        blocked_sectors=req.blocked_sectors,
        section_speed_limits=req.section_speed_limits,
        single_line_sections=req.single_line_sections,
    )
    result = _safety_validator.validate(plans, state)
    return {"safe": result.safe, "reasons": result.reasons}


def _plans_from_assignments(assignments: dict, transit_seconds_by_train: dict, resource_id: str) -> List[TrainPlan]:
    plans = []
    for train_id, a in assignments.items():
        transit = transit_seconds_by_train.get(train_id, 90)
        plans.append(TrainPlan(
            train_id=train_id,
            section_id=resource_id,
            platform_id=None,
            direction="up",
            enters_at_sec=a["entry_sec"],
            exits_at_sec=a["entry_sec"] + transit,
            planned_speed_kmh=60.0,
            dwell_seconds=0.0,
        ))
    return plans


@app.post("/ai/recommend")
def recommend_endpoint(req: RecommendRequest):
    requests = [
        TrainRequest(
            train_id=r.train_id, resource_id=r.resource_id, priority=r.priority,
            requested_entry_sec=r.requested_entry_sec, transit_seconds=r.transit_seconds,
            max_hold_seconds=r.max_hold_seconds, reroute_available=r.reroute_available,
            reroute_extra_seconds=r.reroute_extra_seconds,
            predicted_delay_min=_predict_delay_minutes(r.prediction),
            current_delay_min=r.current_delay_min,
            scheduled_destination_arrival_sec=r.scheduled_destination_arrival_sec,
        )
        for r in req.conflict_trains
    ]
    if not requests:
        raise HTTPException(400, "conflict_trains must be non-empty")

    resource_id = requests[0].resource_id
    opt_result = optimize_precedence(requests, generate_alternatives=True)
    if not opt_result["feasible"]:
        raise HTTPException(422, "Optimizer could not find a feasible solution")

    transit_map = req.transit_seconds_by_train or {r.train_id: r.transit_seconds for r in requests}
    state = NetworkState(
        blocked_sectors=req.blocked_sectors,
        section_speed_limits=req.section_speed_limits,
        single_line_sections=req.single_line_sections,
    )

    validations = []
    for opt in opt_result["options"]:
        plans = _plans_from_assignments(opt.assignments, transit_map, resource_id)
        validations.append(_safety_validator.validate(plans, state))

    recs = build_recommendations(opt_result["options"], validations)

    # Build a synthetic "conflict" record purely for explanation context
    from conflicts.conflict_detector import Conflict
    conflict = Conflict(
        conflict_id=f"CFL-{uuid.uuid4().hex[:6]}",
        conflict_type="RESOURCE_CONTENTION",
        severity="HIGH" if len(requests) > 1 else "LOW",
        trains=[r.train_id for r in requests],
        location=resource_id,
        predicted_time_sec=min(r.requested_entry_sec for r in requests),
        probability=0.85,
        reason=f"{len(requests)} trains require resource {resource_id} within an unsafe window.",
        affected_resources=[resource_id],
    )

    explained = []
    for rec in recs:
        exp = explain_recommendation(conflict, rec)
        explained.append({
            **exp,
            "rank": rec.rank,
            "label": rec.label,
            "predicted_delay_by_train": {
                train_id: assignment.get("predicted_delay_min", 0.0)
                for train_id, assignment in rec.assignments.items()
            },
        })

    log_id = f"REC-{uuid.uuid4().hex[:8]}"
    _recommendations_log.append({
        "id": log_id, "timestamp": time.time(), "resource_id": resource_id,
        "n_trains": len(requests), "top_label": recs[0].label if recs else None,
        "top_safe": recs[0].is_safe if recs else None,
    })

    return {"recommendation_id": log_id, "runtime_sec": opt_result["runtime_sec"], "recommendations": explained}


@app.post("/ai/override")
def override_endpoint(req: OverrideRequest):
    plans = [
        TrainPlan(
            train_id=p.train_id, section_id=p.section_id, platform_id=p.platform_id,
            direction=p.direction, enters_at_sec=p.enters_at_sec, exits_at_sec=p.exits_at_sec,
            planned_speed_kmh=p.planned_speed_kmh, dwell_seconds=p.dwell_seconds,
        )
        for p in req.plans
    ]
    state = NetworkState(
        blocked_sectors=req.blocked_sectors,
        section_speed_limits=req.section_speed_limits,
        single_line_sections=req.single_line_sections,
    )
    result = _safety_validator.validate(plans, state)
    return {
        "override_allowed": result.safe,
        "reasons": result.reasons,
        "user_id": req.user_id,
        "reason_given": req.reason,
        "original_recommendation_id": req.original_recommendation_id,
    }


@app.get("/ai/recommendations")
def get_recommendations(limit: int = 50):
    return {"count": len(_recommendations_log), "recommendations": _recommendations_log[-limit:][::-1]}


@app.get("/ai/optimization-runs")
def get_optimization_runs(limit: int = 50):
    return {"count": len(_optimization_runs), "runs": _optimization_runs[-limit:][::-1]}


@app.post("/ai/what-if")
def what_if_endpoint(req: WhatIfRequest):
    """
    Runs the SAME scenario under two strategies and returns real,
    computed metrics for both -- no fabricated numbers:
      BASELINE = First-Come-First-Served (no optimization, no holding
                 beyond what's needed to avoid literal double-occupancy)
      AI_OPTIMIZED = CP-SAT weighted-delay minimization (this project's optimizer)
    """
    if not req.trains:
        raise HTTPException(400, "trains must be non-empty")

    by_resource: dict = {}
    for t in req.trains:
        by_resource.setdefault(t.resource_id, []).append(t)

    def run_baseline(trains):
        # FCFS: sort by requested entry time, enforce headway sequentially, no priority weighting
        ordered = sorted(trains, key=lambda t: t.requested_entry_sec)
        schedule = {}
        prev_exit = None
        total_delay = 0
        total_weighted_delay = 0
        from optimization.optimizer import PRIORITY_WEIGHT, MIN_HEADWAY_SEC
        for t in ordered:
            entry = t.requested_entry_sec
            if prev_exit is not None:
                entry = max(entry, prev_exit + MIN_HEADWAY_SEC)
            hold = entry - t.requested_entry_sec
            schedule[t.train_id] = {"entry_sec": entry, "hold_sec": hold}
            total_delay += hold
            total_weighted_delay += PRIORITY_WEIGHT.get(t.priority, 1.0) * hold
            prev_exit = entry + t.transit_seconds
        return schedule, total_delay, total_weighted_delay, 0.0

    def run_optimized(trains):
        requests = [
            TrainRequest(
                train_id=t.train_id, resource_id=t.resource_id, priority=t.priority,
                requested_entry_sec=t.requested_entry_sec, transit_seconds=t.transit_seconds,
                predicted_delay_min=_predict_delay_minutes(t.prediction),
                current_delay_min=t.current_delay_min,
                scheduled_destination_arrival_sec=t.scheduled_destination_arrival_sec,
            )
            for t in trains
        ]
        result = optimize_precedence(requests, generate_alternatives=False)
        if not result["feasible"]:
            return {}, 0, 0, result["runtime_sec"]
        best = result["options"][0]
        total_delay = sum(a["hold_sec"] for a in best.assignments.values())
        return best.assignments, total_delay, best.total_weighted_delay_sec, result["runtime_sec"]

    def count_input_conflicts(trains):
        conflicts = 0
        for index, first in enumerate(trains):
            for second in trains[index + 1:]:
                if (
                    first.requested_entry_sec < second.requested_entry_sec + second.transit_seconds
                    and second.requested_entry_sec < first.requested_entry_sec + first.transit_seconds
                ):
                    conflicts += 1
        return conflicts

    def validate_schedule(schedule, trains):
        plans = [
            TrainPlan(
                train_id=train.train_id,
                section_id=train.resource_id,
                platform_id=None,
                direction="up",
                enters_at_sec=assignment["entry_sec"],
                exits_at_sec=assignment["entry_sec"] + train.transit_seconds,
                planned_speed_kmh=60.0,
            )
            for train in trains
            for assignment in [schedule.get(train.resource_id, {}).get(train.train_id, {})]
            if assignment
        ]
        state = NetworkState(
            blocked_sectors=req.blocked_sectors,
            section_speed_limits=req.section_speed_limits,
            single_line_sections=req.single_line_sections,
        )
        result = _safety_validator.validate(plans, state)
        return {"safe": result.safe, "reasons": result.reasons}

    def build_summary(schedule, trains, total_delay, total_weighted_delay, runtime_sec):
        exits = [
            assignment["entry_sec"] + train.transit_seconds
            for train in trains
            for assignment in [schedule.get(train.resource_id, {}).get(train.train_id, {})]
            if assignment
        ]
        requested_exits = [train.requested_entry_sec + train.transit_seconds for train in trains]
        holds = [
            schedule.get(train.resource_id, {}).get(train.train_id, {}).get("hold_sec", 0)
            for train in trains
        ]
        safety = validate_schedule(schedule, trains)
        return {
            "schedule": schedule,
            "total_delay_sec": total_delay,
            "average_delay_sec": round(total_delay / len(trains), 2) if trains else 0.0,
            "total_weighted_delay_sec": total_weighted_delay,
            "priority_weighted_delay_sec": total_weighted_delay,
            "conflicts": sum(count_input_conflicts(group) for group in by_resource.values()),
            "affected_trains": sum(1 for hold in holds if hold > 0),
            "recovery_time_sec": max(0, max(exits, default=0) - max(requested_exits, default=0)),
            "optimization_runtime_sec": runtime_sec,
            "safety": safety,
        }

    baseline_summary = {"schedule": {}, "total_delay_sec": 0, "total_weighted_delay_sec": 0}
    optimized_summary = {"schedule": {}, "total_delay_sec": 0, "total_weighted_delay_sec": 0}
    baseline_runtime = 0.0
    optimized_runtime = 0.0

    for resource_id, trains in by_resource.items():
        b_sched, b_delay, b_wdelay, b_runtime = run_baseline(trains)
        o_sched, o_delay, o_wdelay, o_runtime = run_optimized(trains)
        baseline_runtime += b_runtime
        optimized_runtime += o_runtime
        baseline_summary["schedule"][resource_id] = b_sched
        baseline_summary["total_delay_sec"] += b_delay
        baseline_summary["total_weighted_delay_sec"] += b_wdelay
        optimized_summary["schedule"][resource_id] = o_sched
        optimized_summary["total_delay_sec"] += o_delay
        optimized_summary["total_weighted_delay_sec"] += o_wdelay

    n_trains = len(req.trains)
    window_hours = max(1.0, max(t.requested_entry_sec for t in req.trains) / 3600.0)
    throughput_baseline = round(n_trains / window_hours, 2)
    throughput_optimized = round(n_trains / window_hours, 2)  # same trains pass; optimizer changes delay, not count, in this scoped model

    improvement_pct = (
        round(
            100.0 * (baseline_summary["total_weighted_delay_sec"] - optimized_summary["total_weighted_delay_sec"])
            / baseline_summary["total_weighted_delay_sec"], 1
        )
        if baseline_summary["total_weighted_delay_sec"] > 0 else 0.0
    )

    baseline_output = build_summary(
        baseline_summary["schedule"], req.trains,
        baseline_summary["total_delay_sec"], baseline_summary["total_weighted_delay_sec"], 0.0,
    )
    optimized_output = build_summary(
        optimized_summary["schedule"], req.trains,
        optimized_summary["total_delay_sec"], optimized_summary["total_weighted_delay_sec"],
        optimized_runtime,
    )

    return {
        "scenario_name": req.scenario_name,
        "n_trains": n_trains,
        "baseline": {**baseline_output, "throughput_trains_per_hour": throughput_baseline},
        "ai_optimized": {**optimized_output, "throughput_trains_per_hour": throughput_optimized},
        "weighted_delay_improvement_pct": improvement_pct,
        "note": "Computed directly from the CP-SAT optimizer and a deterministic FCFS baseline on the SAME input -- not fabricated.",
    }
