# SAFETY.md — Deterministic Safety Validator

`ai-service/safety/safety_validator.py`. Contains **no ML and no
optimization**. This is a plain, auditable rule-checker, and it is the
only component allowed to say "SAFE" or "UNSAFE."

## Why this exists separately from the optimizer

The CP-SAT optimizer (OPTIMIZATION.md) is a delay-minimizer; nothing
stops it from proposing a schedule that is mathematically optimal but
operationally unsafe if a constraint wasn't modeled in its objective
(e.g. a sector that was blocked after the optimizer's inputs were
built). The safety validator is the final, independent gate — it is
called on every optimizer option before any option is shown to a
controller as "safe," and again on every manual override attempt.

## Constraints implemented

| Constraint | Logic |
|---|---|
| Blocked sector | Reject if any plan's `section_id` is in `blocked_sectors` |
| Minimum headway | For trains sharing a section, `next.enters_at - prev.exits_at >= min_headway_seconds` (default 120s) |
| Block occupancy | Reject if two trains' intervals in the same section overlap at all (`gap < 0`) |
| Opposing-direction conflict | On sections listed in `single_line_sections`, reject if trains from different directions have overlapping intervals |
| Platform occupancy | Same overlap check as block occupancy, applied per `platform_id` |
| Minimum dwell time | Reject if a train's `dwell_seconds` at a platform is below `min_dwell_seconds` (default 20s) but nonzero |
| Speed limit | Reject if `planned_speed_kmh` exceeds the section's configured limit (`section_speed_limits`, falling back to `max_speed_kmh` default 100) |

All are configurable via `SafetyConfig` (headway/dwell/speed
defaults) and per-request `NetworkState` (blocked sectors, single-line
sections, per-section speed limits) — see `api/schemas.py::ValidateRequest`.

## Output contract

```json
{ "safe": false, "reasons": ["Train T104 cannot enter sector S18 because it is BLOCKED.", "..."] }
```

Every reason is a plain-English, human-checkable sentence naming the
specific trains/sectors/times involved — never a numeric code alone.

## Where it's enforced

1. `POST /ai/recommend` — every candidate optimizer option is passed
   through the validator; only `safe=true` options can rank #1 (unsafe
   options are still returned, ranked last, with their rejection reason
   attached, for transparency — see `recommendation/recommendation_engine.py`).
2. `POST /ai/override` — a controller's manual override is validated
   exactly the same way, with **zero special-casing** for "a human
   asked for it." An unsafe override is rejected with the same
   structured reasons.
3. `POST /ai/validate` — exposed directly so the Node backend or
   frontend can pre-flight-check any hypothetical plan.

## Demonstrated failure-safe behaviour (automated test)

`ai-service/tests/test_safety_validator.py::test_unsafe_manual_override_is_blocked`
and `ai-service/tests/test_integration.py::test_unsafe_override_rejected_end_to_end`
both explicitly construct the SIH Demo Scenario 10 case (train T205
manually forced into a sector already occupied by T099) and assert:
- `safe` / `override_allowed` is `False`
- at least one reason string is returned, naming both trains and the
  sector

These are real, passing, executed tests (not aspirational) — see
DEMO.md for how to trigger the same scenario from the UI ("Demo:
Attempt Unsafe Manual Override" button).

## Known limitations

- Speed-limit and dwell-time checks assume the caller supplies accurate
  `planned_speed_kmh` / `dwell_seconds`; the validator does not itself
  infer these from physics — it checks the numbers it's given.
- Signalling-system interlocking logic (actual signal aspect / route
  locking) is out of scope; `SignallingAdapter` in `adapters/adapters.py`
  is a mock and documents where a real system would plug in.
