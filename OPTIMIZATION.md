# OPTIMIZATION.md — CP-SAT Optimization Engine

`ai-service/optimization/optimizer.py`, built on **Google OR-Tools
CP-SAT**. This is the load-bearing component for SIH25022 ("maximizing
section throughput") — it decides train precedence and holding, not a
random or hard-coded score.

## Decision variables (per contending train `i`)

- `entry[i]` — the time (seconds from now) train `i` enters the
  contested resource (section/junction/platform).
- `hold[i]` — how long train `i` is held past its originally requested
  entry time (bounded by `max_hold_seconds`, controller-configurable).
- `rerouted[i]` — boolean, only present if `reroute_available=True` for
  that train; whether it takes an alternate resource instead.

Constraint: `entry[i] == requested_entry_sec[i] + hold[i]`.

## Constraints

For every pair of trains contending for the same resource, a boolean
`before_ab` variable enforces disjunctive scheduling:

```
IF before_ab:      entry[b] >= entry[a] + transit[a] + MIN_HEADWAY_SEC
IF NOT before_ab:  entry[a] >= entry[b] + transit[b] + MIN_HEADWAY_SEC
```

`MIN_HEADWAY_SEC = 120` by default (configurable). This is a genuine
disjunctive/job-shop-style scheduling constraint, solved exactly by
CP-SAT — not a heuristic ordering.

## Objective function

```
minimize   sum_i  priority_weight[i] * hold[i]
         + sum_i  reroute_extra_seconds[i] * rerouted[i]
```

`priority_weight` maps priority 1 (highest, e.g. express) -> 5.0, down
to priority 5 (lowest) -> 1.0 (`PRIORITY_WEIGHT` dict in
`optimizer.py`). This directly implements "weighted delay based on
train priority" from the SIH objective list: a higher-priority train's
holding time is penalized 5x more than a lowest-priority train's.

Throughput is not a separate decision variable in this scoped model —
in the single-resource contention formulation, all requesting trains
do get through (the model does not drop trains), so throughput is
constant across candidate solutions and the meaningful lever is
**weighted delay**, which is what is minimized. See "Known limitations"
below for how this scoping decision affects claims about throughput.

## Alternatives / ranking

`optimize_precedence()` solves the unconstrained-precedence problem
once (the true optimum), then re-solves once per train with
`forced_first=<that train>` to produce the "what if this train goes
first instead" alternatives the SIH spec asks for (Option A/B/C-style
ranking). All options are sorted by objective value ascending.

## Safety is external, not baked into the objective

The optimizer's objective has no notion of "safety" beyond headway —
it is a pure delay-minimization model over the disjunctive-scheduling
constraints already listed. Every candidate solution is independently
re-validated by `safety.safety_validator.SafetyValidator` (see
SAFETY.md) before being surfaced to the recommendation engine. **The
optimizer cannot itself produce an "approved" recommendation; the
safety validator has the final say.**

## Runtime

Measured directly (not fabricated) via the `runtime_sec` field
returned by every `/ai/optimize` and `/ai/recommend` call. In testing
(see `ai-service/tests/test_optimizer.py`):
- 2-train single-resource case: ~0.01s
- 6-train single-resource case (with alternative generation): well under 5s (asserted in `test_runtime_is_fast_enough_for_demo`)

`cp_model.CpSolver().parameters.max_time_in_seconds` is capped (default
5s) so a pathological case degrades to "best found so far" rather than
hanging.

## Baseline comparison (FCFS)

`POST /ai/what-if` runs the **same** input trains through two real,
independently-computed strategies:
1. **Baseline — First-Come-First-Served:** sorts by requested entry
   time, enforces the same `MIN_HEADWAY_SEC`, no priority weighting.
2. **AI Optimized — this CP-SAT model.**

Both produce real schedules and real `total_weighted_delay_sec`
figures computed from those schedules — see DEMO.md for an example run
with actual numbers.

## Known limitations

- The current formulation solves **one contested resource at a time**
  (a junction/section/platform). It does not yet do full network-wide
  multi-resource rolling-horizon optimization across the whole 26-station
  corridor in a single CP-SAT model — that is future work, not
  implemented here. Practically, this means cascading multi-hop
  conflicts must currently be resolved by repeated calls (one per
  contested resource) rather than one global solve.
- `max_hold_seconds` is a hard per-train cap; if a scenario truly
  requires holding a train longer than that cap to stay conflict-free
  (e.g. many trains piled into one small resource), the solver reports
  `feasible: False` rather than silently violating the cap. This is
  intentional (a real hard constraint), and is covered by
  `test_runtime_is_fast_enough_for_demo`'s comment in the test file
  where an earlier draft of the test hit exactly this and had to be
  corrected — see git history / test file comments.
- Throughput, as defined in this scoped model, does not vary between
  baseline and optimized because both process the same finite train set
  — the win is entirely in weighted delay/travel time, which is the
  effect an operator actually feels in this resource-contention framing.
