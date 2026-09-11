# Log Pace & Heart Rate — Plan Brief

> Full plan: `context/changes/log-pace-hr/plan.md`

## What & Why

Add optional average pace and heart rate fields to workout logging. Currently logging records completion status and distance only — runners want to track effort metrics alongside distance. This extends the existing log flow without touching planned workout fields or generation.

## Starting Point

`workout_logs` table stores `date`, `type`, `distance_km` per member per date. The `WorkoutLog` TypeScript type mirrors this. The day panel has a "Log km" input; the calendar cell shows type + distance but not log data.

## Desired End State

After logging, the day cell shows pace (mm:ss /km) and/or HR (bpm) in a muted secondary line. Values round-trip through the API and persist across reloads. Out-of-range values are rejected (pace 120–900 s/km, HR 60–220 bpm).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage format for pace | Integer seconds per km | Avoids floating-point; mm:ss conversion is UI-only. | Plan |
| Validation ranges | Pace 120–900 s/km, HR 60–220 bpm | Locked in change.md notes. | Unattended |
| Nullable columns, no default | NULL for existing rows | Additive migration; no backfill needed. | Plan |
| Pace input format | mm:ss text input, converted client-side | Natural runner input format; stored as seconds. | Unattended |
| No chat integration | Chat log stays distance-only | Locked: do not change planned workout fields or generation. | Unattended |

## Scope

**In scope:** DB migration (2 nullable integer columns + CHECK + RLS), types, service validation, API pass-through, day panel inputs (pace mm:ss + HR bpm), calendar cell display.

**Out of scope:** Strava auto-import, changes to planned workouts or generation, chat-driven pace/HR logging, training load chart integration.

## Architecture / Approach

Vertical slice through all layers: migration → types → service (zod schema + parsing + upsert) → API (pass-through) → UI (form inputs + cell display). Each phase is independently compilable and testable.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migration, Types & Service | DB columns, TS types, service validation/upsert | Schema mismatch between migration CHECK and zod |
| 2. API Layer | POST endpoint accepts/returns pace & HR | Minimal — pass-through only |
| 3. UI — Form & Display | Day panel inputs + calendar cell display | Pace mm:ss parsing edge cases |

**Prerequisites:** None — builds on existing workout-logging infrastructure.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Migration must be applied to hosted Supabase separately (DEP item).
- Pace mm:ss parsing assumes valid format; malformed input yields undefined (not sent to API).

## Success Criteria (Summary)

- Logged pace and HR appear on the calendar day cell after save and after reload.
- Out-of-range values are rejected by the API with a clear error.
- All existing tests continue to pass — no regression.
