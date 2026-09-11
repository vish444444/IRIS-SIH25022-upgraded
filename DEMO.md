# DEMO.md — Running the Demo for Judges

## 1. Start everything

```bash
# Terminal 1 — AI service (Python)
cd ai-service
pip install -r requirements.txt
python training/train_model.py --rows 8000   # only needed once, or if models/ is missing
uvicorn api.main:app --port 8001

# Terminal 2 — Node API
cd api
npm install
npm start

# Terminal 3 — Simulator
cd simulator
npm install
npm start

# Terminal 4 — Frontend
cd client
npm install
npm run dev
```

Set `AI_SERVICE_URL` (defaults to `http://localhost:8001`) as an env
var for the Node API if you run the AI service on a different host/port.

Log in as a `section_controller` (or `system_admin`) user, open the
**Simulation** page, and click the **AI** tab.

## 2. Demo Mode (one click per scenario)

The AI tab's "Hackathon Demo Mode" panel has buttons for:

| Button | What it sends | What it proves |
|---|---|---|
| Normal Traffic | 1 train, no contention | Baseline "nothing to optimize" case |
| Express Delayed 10 min | 2 trains, priorities 1 & 3, same junction plus simulated telemetry features | ML prediction is passed into the optimizer; it holds the lower-priority train, not the express |
| Two Trains, Same Junction | 2 trains, priorities 1 & 2 | Ranked alternatives (Option A/B) |
| Heavy Congestion (4 trains) | 4 trains, mixed priorities, one resource | Optimizer solves a harder combinatorial case; runtime shown |
| **Attempt Unsafe Manual Override** | Forces T205 into a sector already occupied by T099 | **Safety validator rejects it** with a named reason — Demo Scenario 10 |

Each scenario button (except the unsafe-override one) triggers, in order:
1. `POST /api/ai/recommend` -> shows the `AIRecommendationPanel` (conflict, recommended action, why, expected impact, safety status, alternatives, approve/reject buttons)
2. `POST /api/ai/what-if` -> shows the `KPIDashboard` baseline-vs-optimized comparison with real computed numbers

## 3. Walking through the acceptance test end-to-end

This mirrors the acceptance test in the original brief:

1. Start the simulator — trains appear on the map (existing feature, unchanged).
2. Go to the AI tab, click **Express Delayed 10 min**.
3. Observe: conflict trains T102/T205 shown, AI prediction per train, recommendation score, weighted delay impact, and safety status PASS.
4. Click **APPROVE** — this calls `POST /api/ai/recommendations/:id/decide`, which is persisted to `ai_recommendations` and logged to `audit_logs`.
5. Look at the KPI panel below it — baseline vs AI-optimized total/weighted delay, conflicts, affected trains, recovery time, runtime, and a computed `%` improvement. Throughput is labeled fixed-cohort because this scoped scenario processes the same train count.
6. Click **Heavy Congestion (4 trains)** — a harder, 4-train case; note the `optimized in _s` runtime shown in the recommendation panel header (measured, not fabricated).
7. Click **Attempt Unsafe Manual Override** — the panel shows "Override BLOCKED by safety validator" with the exact reason string (train + sector + occupying train).
8. Use the existing **Sector Blockages** panel to block a real sector ID, observe blocked trains stop emitting movement telemetry in the simulator, run a recommendation/what-if with that sector in `blocked_sectors`, then remove the blockage and observe recovery.

## 4. Answering "what exactly is the AI here?"

Point to, in order:
1. **ML** — `ai-service/models/delay_model.joblib`, trained by `training/train_model.py`, real MAE/RMSE/R² in `models/metrics.json` (see AI_MODEL.md). Exposed at `POST /ai/predict-delay`.
2. **Optimization** — `ai-service/optimization/optimizer.py`, Google OR-Tools CP-SAT, minimizing priority-weighted delay under disjunctive headway constraints (see OPTIMIZATION.md).
3. **Safety** — `ai-service/safety/safety_validator.py`, deterministic, has final veto power over every AI output (see SAFETY.md).
4. **Human-in-the-loop** — every recommendation requires an explicit `APPROVE`/`REJECT` from a logged-in controller; nothing in the codebase writes to train movement state autonomously.

## 5. What is NOT real (say this proactively)

- Train telemetry, delays, and disruptions are **simulated** (existing simulator), not live GPS/signalling feeds.
- The delay-prediction training data is **synthetic**, documented in AI_MODEL.md.
- `SignallingAdapter`, `TimetableAdapter`, `RollingStockAdapter`,
  `TrackStatusAdapter` in `ai-service/adapters/adapters.py` are **mocks**;
  they document the interface a real system would implement.
- No physical GPS hardware and no connection to any real Indian
  Railways system exists or is claimed.
