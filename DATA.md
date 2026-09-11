# DATA.md — Data Sources & Honesty Ledger

| Category | Item | Status |
|---|---|---|
| IMPLEMENTED | Delay-prediction ML model (GradientBoostingRegressor) | Real, trained, evaluated (AI_MODEL.md) |
| IMPLEMENTED | CP-SAT optimizer | Real (OR-Tools), solves real disjunctive scheduling problem |
| IMPLEMENTED | Deterministic conflict detector | Real, geometry/timing-based |
| IMPLEMENTED | Deterministic safety validator | Real, rule-based, has veto power |
| IMPLEMENTED | Recommendation ranking + explanation engine | Real, derived only from optimizer/validator output |
| IMPLEMENTED | Baseline (FCFS) vs AI-optimized comparison | Real, computed on the same input for both strategies |
| IMPLEMENTED | RBAC (4 roles) | Pre-existing, reused unchanged |
| IMPLEMENTED | Audit logging of AI decisions | Real, new SQLite tables + existing `audit_logs` mechanism |
| SIMULATED | Train positions, speed, delay | Existing Node/TS simulator (`simulator/trainSimulator.ts`) — not live GPS |
| SIMULATED | Disruptions used in demo scenarios | Hand-authored scenario presets in `DemoMode.tsx`, run through the real AI pipeline |
| SIMULATED (training data) | Delay-model training set | `ai-service/data/generate_dataset.py` — documented synthetic generator, 8 named scenario templates, NOT real Indian Railways data |
| MOCK | `SignallingAdapter` | Returns "PROCEED" for all sections; documents the real integration point |
| MOCK | `TimetableAdapter` | Returns empty schedule shell |
| MOCK | `RollingStockAdapter` | Returns a static "IN_SERVICE" status |
| MOCK | `TrackStatusAdapter` | Returns no blocked sectors; real integration point is the existing Node `/api/status/*` endpoints |
| MOCK | `TelemetryAdapter` | Empty; real integration point is the existing `/api/receiver` endpoint |
| FUTURE | Physical GPS/AFTC hardware integration | Not implemented, not claimed |
| FUTURE | Real Indian Railways signalling/TMS/COIS-DMS integration | Not implemented, not claimed |
| FUTURE | Network-wide (multi-resource, whole-corridor) single-solve optimization | Current optimizer solves one contested resource per call (see OPTIMIZATION.md limitations) |
| FUTURE | Learned conflict/congestion classifiers | Current conflict detection and congestion scoring are deterministic/rule-based by design (see AI_MODEL.md, SAFETY.md) — disclosed as a design choice, not a gap to hide |

## Synthetic dataset generation — reproducibility

```bash
cd ai-service
python3 data/generate_dataset.py --rows 8000 --out /tmp/synthetic_train_delays.csv
```

Every row carries a `scenario` column (dropped before training) so
the distribution of scenario types used can always be audited:
`NORMAL, MINOR_DELAY, HEAVY_DELAY, CONGESTION, BREAKDOWN,
TRACK_BLOCKAGE, PLATFORM_CONFLICT, SIGNAL_RESTRICTION`, sampled with
documented probabilities in `generate_dataset()`.

No dataset CSV or trained model binary larger than a few hundred KB is
committed to the repository by default (per the original brief); the
training script regenerates both deterministically from a fixed seed.
