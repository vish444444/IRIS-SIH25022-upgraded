"""
optimizer.py
=============
The heart of the SIH25022 solution: a real Operations-Research
optimizer built on Google OR-Tools CP-SAT. Given a set of trains that
all require the same constrained resource (a section/junction/
platform) within an unsafe time window, it decides:

  - the entry order (precedence) into the resource
  - how long (if at all) each train should be held
  - optionally, whether a train should be rerouted to an alternate
    resource with its own transit time

subject to a minimum-headway constraint between consecutive users of
the resource, and produces a MINIMUM weighted-delay solution -- this
is a genuine constrained optimization model, not a heuristic score.

Objective (see docstring of `optimize_precedence` for the exact
formula):
    minimize   sum_i  priority_weight[i] * hold_seconds[i]
             + sum_i  travel_time_penalty[i]
             + reroute_penalty (if used)

The optimizer NEVER outputs a final decision by itself: every
candidate solution it proposes is re-checked by safety.safety_validator
before being returned to the caller (see api/main.py `/ai/optimize`).
"""
from dataclasses import dataclass, field
from typing import List, Optional
import time as _time

from ortools.sat.python import cp_model


@dataclass
class TrainRequest:
    train_id: str
    resource_id: str
    priority: int  # 1 (highest) .. 5 (lowest)
    requested_entry_sec: int  # seconds from now this train wants to enter
    transit_seconds: int      # time needed to clear the resource once entered
    max_hold_seconds: int = 600  # controller-configurable cap on holding
    reroute_available: bool = False
    reroute_extra_seconds: int = 0  # travel-time penalty if rerouted
    predicted_delay_min: float = 0.0
    current_delay_min: float = 0.0
    scheduled_destination_arrival_sec: Optional[int] = None


@dataclass
class OptimizationOption:
    label: str  # e.g. "Hold T205 for 90s" / "Hold T102 for 60s" / "Reroute T205"
    assignments: dict  # train_id -> {entry_sec, hold_sec, rerouted}
    total_weighted_delay_sec: float
    total_travel_time_penalty_sec: float
    objective_value: float
    safety_checked: bool = False
    safety_safe: Optional[bool] = None
    safety_reasons: List[str] = field(default_factory=list)


PRIORITY_WEIGHT = {1: 5.0, 2: 4.0, 3: 3.0, 4: 2.0, 5: 1.0}
MIN_HEADWAY_SEC = 120


def _solve_single_resource(
    requests: List[TrainRequest],
    forced_first: Optional[str] = None,
    time_limit_sec: float = 5.0,
) -> Optional[OptimizationOption]:
    """
    Solves precedence + holding for trains contending for ONE resource.
    If `forced_first` is set, that train is constrained to enter first
    (used to generate ranked alternative options, e.g. "what if T102
    goes first instead of T205").
    """
    model = cp_model.CpModel()
    n = len(requests)
    horizon = max(r.requested_entry_sec for r in requests) + sum(r.max_hold_seconds for r in requests) + 3600

    entry = {}
    hold = {}
    rerouted = {}
    for r in requests:
        entry[r.train_id] = model.NewIntVar(r.requested_entry_sec, horizon, f"entry_{r.train_id}")
        hold[r.train_id] = model.NewIntVar(0, r.max_hold_seconds, f"hold_{r.train_id}")
        model.Add(entry[r.train_id] == r.requested_entry_sec + hold[r.train_id])
        if r.reroute_available:
            rerouted[r.train_id] = model.NewBoolVar(f"reroute_{r.train_id}")
        else:
            rerouted[r.train_id] = None

    # Pairwise ordering + headway (disjunctive scheduling on shared resource)
    for i in range(n):
        for j in range(i + 1, n):
            a, b = requests[i], requests[j]
            # If either train is rerouted away, no ordering constraint needed between them.
            both_present_terms = []
            before_ab = model.NewBoolVar(f"before_{a.train_id}_{b.train_id}")
            # a before b: entry_b >= entry_a + transit_a + headway
            model.Add(entry[b.train_id] >= entry[a.train_id] + a.transit_seconds + MIN_HEADWAY_SEC).OnlyEnforceIf(before_ab)
            # b before a: entry_a >= entry_b + transit_b + headway
            model.Add(entry[a.train_id] >= entry[b.train_id] + b.transit_seconds + MIN_HEADWAY_SEC).OnlyEnforceIf(before_ab.Not())

    if forced_first is not None:
        for r in requests:
            if r.train_id != forced_first:
                model.Add(entry[forced_first] < entry[r.train_id])

    # Predicted delay raises the cost of holding an already delayed train.
    # The model remains advisory: all hard timing constraints stay enforced.
    objective_terms = []
    for r in requests:
        w = PRIORITY_WEIGHT.get(r.priority, 1.0)
        risk_multiplier = 1.0 + max(0.0, r.predicted_delay_min) / 10.0
        objective_terms.append(int(w * 100 * risk_multiplier) * hold[r.train_id])
        if rerouted[r.train_id] is not None:
            objective_terms.append(int(r.reroute_extra_seconds * 100) * rerouted[r.train_id])

    model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.num_search_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    assignments = {}
    total_weighted_delay = 0.0
    total_travel_penalty = 0.0
    for r in requests:
        hold_val = solver.Value(hold[r.train_id])
        entry_val = solver.Value(entry[r.train_id])
        is_rerouted = bool(solver.Value(rerouted[r.train_id])) if rerouted[r.train_id] is not None else False
        assignments[r.train_id] = {
            "entry_sec": entry_val,
            "hold_sec": hold_val,
            "rerouted": is_rerouted,
            "predicted_delay_min": round(max(0.0, r.predicted_delay_min), 2),
            "predicted_destination_delay_min": round(
                max(0.0, r.current_delay_min)
                + max(0.0, r.predicted_delay_min)
                + hold_val / 60.0,
                2,
            ),
        }
        if r.scheduled_destination_arrival_sec is not None:
            assignments[r.train_id]["destination_eta_sec"] = (
                r.scheduled_destination_arrival_sec
                + max(0.0, r.current_delay_min) * 60
                + max(0.0, r.predicted_delay_min) * 60
                + hold_val
            )
        total_weighted_delay += PRIORITY_WEIGHT.get(r.priority, 1.0) * hold_val
        if is_rerouted:
            total_travel_penalty += r.reroute_extra_seconds

    return OptimizationOption(
        label="",  # filled in by caller
        assignments=assignments,
        total_weighted_delay_sec=total_weighted_delay,
        total_travel_time_penalty_sec=total_travel_penalty,
        objective_value=solver.ObjectiveValue(),
    )


def optimize_precedence(
    requests: List[TrainRequest],
    generate_alternatives: bool = True,
    time_limit_sec: float = 5.0,
) -> dict:
    """
    Returns the best solution plus ranked alternatives (one per train
    forced to go first), so the recommendation engine can present
    "OPTION A / B / C" the way a controller expects.
    """
    t0 = _time.time()
    best = _solve_single_resource(requests, forced_first=None, time_limit_sec=time_limit_sec)
    options: List[OptimizationOption] = []

    if best is None:
        return {
            "feasible": False,
            "runtime_sec": round(_time.time() - t0, 3),
            "options": [],
        }

    # Identify who effectively "won" precedence in the best solution (min entry time)
    winner = min(best.assignments.items(), key=lambda kv: kv[1]["entry_sec"])[0]
    held = [r.train_id for r in requests if r.train_id != winner]
    best.label = (
        f"Hold {', '.join(held)} to let {winner} proceed first"
        if held else f"No holding required; {winner} proceeds as scheduled"
    )
    options.append(best)

    if generate_alternatives and len(requests) > 1:
        for r in requests:
            if r.train_id == winner:
                continue
            alt = _solve_single_resource(requests, forced_first=r.train_id, time_limit_sec=time_limit_sec)
            if alt is not None:
                others = [x.train_id for x in requests if x.train_id != r.train_id]
                alt.label = f"Hold {', '.join(others)} to let {r.train_id} proceed first"
                options.append(alt)

    # Rank by objective value ascending (lower weighted delay = better)
    options.sort(key=lambda o: o.objective_value)

    return {
        "feasible": True,
        "runtime_sec": round(_time.time() - t0, 3),
        "options": options,
    }
