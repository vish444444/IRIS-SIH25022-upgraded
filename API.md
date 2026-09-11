# API.md

## AI Decision-Support Service (Python/FastAPI, `ai-service/`, default port 8001)

All request/response schemas are Pydantic models in `ai-service/api/schemas.py`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/ai/status` | Service health, model metrics, which components are IMPLEMENTED |
| POST | `/ai/predict-delay` | Delay prediction (ML) for one train's current state |
| POST | `/ai/detect-conflicts` | Deterministic conflict detection over a list of predicted occupancies |
| POST | `/ai/optimize` | Run the CP-SAT optimizer over a set of trains contending for one resource |
| POST | `/ai/validate` | Run the safety validator over a set of train plans |
| POST | `/ai/recommend` | Full pipeline: optimize -> validate each option -> rank -> explain |
| POST | `/ai/override` | Validate a manual controller override; blocks if unsafe |
| POST | `/ai/what-if` | Baseline (FCFS) vs AI-optimized comparison on the same input |
| GET | `/ai/recommendations` | In-memory history of recommendations issued this process lifetime |
| GET | `/ai/optimization-runs` | In-memory history of optimizer runs this process lifetime |

### Example: `POST /ai/recommend`

Request:
```json
{
  "conflict_trains": [
    {"train_id": "T102", "resource_id": "DADAR-JN", "priority": 1, "requested_entry_sec": 60, "transit_seconds": 90},
    {"train_id": "T205", "resource_id": "DADAR-JN", "priority": 3, "requested_entry_sec": 90, "transit_seconds": 90}
  ]
}
```

Response (abridged, real shape):
```json
{
  "recommendation_id": "REC-xxxxxxxx",
  "runtime_sec": 0.02,
  "recommendations": [
    {
      "rank": 1,
      "label": "Hold T205 to let T102 proceed first",
      "safety_status": "PASS",
      "safety_explanation": "All configured safety constraints ... passed.",
      "expected_impact": {
        "total_weighted_delay_sec": 540,
        "total_weighted_delay_min": 9.0,
        "per_train": { "T102": {"entry_sec": 60, "hold_sec": 0, "rerouted": false},
                        "T205": {"entry_sec": 270, "hold_sec": 180, "rerouted": false} }
      },
      "recommendation_score": 0.85,
      "predicted_delay_by_train": {"T102": 7.3, "T205": 1.2},
      "if_rejected": "If the controller rejects this recommendation, ..."
    }
  ]
}
```

### Example: `POST /ai/what-if`

Request:
```json
{
  "scenario_name": "express_delay_10min",
  "trains": [
    {"train_id": "T102", "resource_id": "DADAR-JN", "priority": 1, "requested_entry_sec": 60, "transit_seconds": 90},
    {"train_id": "T205", "resource_id": "DADAR-JN", "priority": 3, "requested_entry_sec": 90, "transit_seconds": 90}
  ]
}
```

Response includes `baseline`, `ai_optimized`, and
`weighted_delay_improvement_pct` — all computed live from the two
strategies, not fabricated. Each summary also includes total/average
delay, conflicts, affected trains, recovery time, runtime, and safety
status. `blocked_sectors` may be supplied to validate the scenario.

---

## Node/Express proxy (`api/`, default port 3000, mounted at `/api/ai`)

Same endpoints as above, proxied 1:1, plus persistence + RBAC:

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/ai/status` | none | health passthrough |
| POST | `/api/ai/predict-delay` | JWT | |
| POST | `/api/ai/detect-conflicts` | JWT | persists into `ai_conflicts` |
| POST | `/api/ai/optimize` | JWT | persists into `ai_optimization_runs` |
| POST | `/api/ai/validate` | JWT | |
| POST | `/api/ai/recommend` | JWT + `dashboard:read` | persists top recommendation into `ai_recommendations` |
| POST | `/api/ai/recommendations/:id/decide` | JWT + `decision:accept` | body: `{ "decision": "approved" \| "rejected" }`; writes `audit_logs` |
| POST | `/api/ai/override` | JWT + `decision:override` | writes `audit_logs`; 409 if unsafe |
| POST | `/api/ai/what-if` | JWT + `dashboard:read` | persists into `ai_scenarios` |
| GET | `/api/ai/recommendations` | JWT + `dashboard:read` | durable history from SQLite |
| GET | `/api/ai/optimization-runs` | JWT + `dashboard:read` | durable history from SQLite |
| GET | `/api/ai/conflicts` | JWT + `dashboard:read` | durable history from SQLite |
| POST | `/api/ai/disruptions` | JWT + `decision:override` | logs a disruption (breakdown/track_blockage/etc.) |
| GET | `/api/ai/disruptions` | JWT + `dashboard:read` | active disruptions |
| DELETE | `/api/ai/disruptions/:id` | JWT + `decision:override` | resolves a disruption |

Permission strings (`dashboard:read`, `decision:accept`,
`decision:override`) are checked against the **existing** RBAC
middleware (`api/src/middleware/rbac.middleware.ts`) — no new roles
were introduced; `section_controller` already has these per the
pre-existing role/permission seed.

## Existing endpoints (unchanged, reused)

`/api/receiver/*`, `/api/status/*`, `/api/v1/auth/*`, `/api/v1/admin/*`
— unchanged by this upgrade. See the original README for these.
