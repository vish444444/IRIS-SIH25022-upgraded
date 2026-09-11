# IRIS Architecture (SIH25022 Upgrade)

## Layered decision-support architecture

```
LIVE DATA (simulator telemetry, POST /api/receiver)
    |
    v
DATA / FEATURE ENGINE            ai-service/features/feature_engineering.py
    |
    v
AI PREDICTION (delay)            ai-service/training + models/ (GradientBoostingRegressor)
    |
    v
CONFLICT DETECTION               ai-service/conflicts/conflict_detector.py (deterministic)
    |
    v
OPERATIONS RESEARCH OPTIMIZER    ai-service/optimization/optimizer.py (Google OR-Tools CP-SAT)
    |
    v
SAFETY / CONSTRAINT VALIDATOR    ai-service/safety/safety_validator.py (deterministic, no ML)
    |
    v
RANKED RECOMMENDATIONS           ai-service/recommendation/recommendation_engine.py
    |
    v
EXPLANATION ENGINE               ai-service/explanation/explanation_engine.py (structured facts only)
    |
    v
SECTION CONTROLLER (React UI)    client/src/components/simulation/AIRecommendationPanel.tsx
    |
    v
APPROVE / OVERRIDE               api/src/controller/ai.controller.ts -> ai_recommendations table
    |
    v
AUDIT LOG                        api/src/db (audit_logs, ai_recommendations, ai_optimization_runs, ...)
```

## Process/service topology

```
┌─────────────────┐      REST (axios)      ┌──────────────────────┐
│  React Client    │ ───────────────────►  │  Node/Express API     │
│  (Vite, :5173)   │ ◄───────────────────  │  (:3000)               │
└─────────────────┘                        │  - auth/RBAC (existing)│
                                            │  - receiver/telemetry  │
                                            │  - sector blockage     │
                                            │  - /api/ai/* (NEW)     │
                                            └──────────┬─────────────┘
                                                       │ REST (axios, AIServiceClient)
                                                       v
                                            ┌──────────────────────┐
                                            │ Python FastAPI        │
                                            │ AI Decision-Support   │
                                            │ Service (:8001, NEW)  │
                                            │ - delay prediction     │
                                            │ - conflict detection    │
                                            │ - OR-Tools optimizer    │
                                            │ - safety validator      │
                                            │ - recommendation/explain│
                                            └──────────────────────┘

┌──────────────────┐
│ Node/TS Simulator │ ── POST telemetry ──►  Node/Express API (/api/receiver)
└──────────────────┘
```

## What is reused vs new

| Layer | Reused as-is | New for SIH25022 |
|---|---|---|
| Simulator | `trainSimulator.ts`, `trackBuilder.ts`, timetable/track JSON | none |
| Node API | auth/RBAC, receiver, sector blockage, audit log mechanism | `ai.controller.ts`, `ai.route.ts`, `aiServiceClient.ts`, `aiRepository.ts`, 5 new SQLite tables |
| AI/optimization | none existed | entire `ai-service/` (Python/FastAPI) |
| Frontend | CorridorMap, TrainInfoPanel, RBAC-aware routing | `AIRecommendationPanel.tsx`, `KPIDashboard.tsx`, `DemoMode.tsx`; re-enabled `EmergencyHandler.tsx` (was dead code) |

## Human-in-the-loop guarantee

The AI service never issues a movement command. Every optimizer output is:
1. Re-checked by the deterministic `SafetyValidator` before being returned.
2. Returned as a ranked `Recommendation`, not an action.
3. Only applied when a controller calls `POST /api/ai/recommendations/:id/decide` (approve) — the Node backend persists this decision; no code path exists that lets the AI service or optimizer write to train state directly.

See SAFETY.md for the exact validation logic and AI_MODEL.md / OPTIMIZATION.md for the ML and OR-Tools internals.
