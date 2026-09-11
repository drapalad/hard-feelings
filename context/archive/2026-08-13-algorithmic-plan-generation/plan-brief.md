# Algorithmic Plan Generation — Plan Brief

> Full plan: `context/changes/algorithmic-plan-generation/plan.md`

## What & Why

Member can generate an algorithmic week into a calendar from saved weekly km and races, optionally freeze in-week workouts and regenerate around them, and view the result (US-01, FR-004, FR-013, FR-005 view-only). Roadmap speed: executable generator, not training-science quality (S-06).

## Starting Point

F-01 `generatePlan` / `validatePlan` and S-01 profile/races APIs plus dashboard setup island are on disk. No plan table, no `/api/plan`, no calendar. DEP-008 (hosted profiles/races) is done.

## Desired End State

Signed-in member generates a 7-day week, sees type + km on `/dashboard`, freezes units and regenerates around them. Missing km or no A race surfaces F-01 codes. Rows are RLS-scoped. Manual type/km edit is S-04.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Generator | Reuse F-01 `generatePlan` as-is | Speed path; do not invent training science | Locked / Roadmap |
| Persist | `training_units` + RLS, map ↔ `TrainingUnit` | Frozen anchors and calendar view need storage | Locked |
| Race mapping | `toRaceInput` only; no name/id on `RaceInput` | Display name must not leak into generate | Locked / S-01 |
| Errors | Surface F-01 codes; null km → non-finite `weeklyKm` | No second error schema | Locked |
| FR-005 | View + freeze + generate only | Manual edit/undo is S-04 | Locked |
| HTTP | JSON + zod; 401; not `PROTECTED_ROUTES` | Middleware redirects would break `fetch` | Locked / AGENTS |
| Dates | `YYYY-MM-DD` + UTC Monday week | Same as F-01 / S-01; no local `Date` parse | Locked |
| Hosted SQL | Append DEP-009; leave 001–008 | Worker rollback does not undo SQL | Locked |

## Scope

**In scope:** `training_units` migration/RLS; UTC week helpers; generate-input builder; GET/POST `/api/plan` + PATCH freeze; dashboard calendar island; DEP-009.

**Out of scope:** Algorithm rewrite; S-03 chat; S-04 edit/undo; S-05 logging; S-06 Admin; FR-012; LLMs; Playwright; hosted `db push`.

## Architecture / Approach

Island → cookie JSON APIs → load profile/races/frozen week → `generatePlan` → upsert the 7-day window via PostgREST + RLS. Freeze updates `frozen` then generate reloads those rows as `frozenUnits`. `weekStart` is always the UTC Monday.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | `training_units` + DEP-009 | Hosted DB never gets the SQL |
| 2. Mapping + week helpers | UTC dates, row ↔ unit, name stripped | `new Date("YYYY-MM-DD")` or name leak |
| 3. Services and APIs | Generate/persist/freeze JSON | `/api/plan` on `PROTECTED_ROUTES` |
| 4. Calendar UI | View + freeze + generate on dashboard | Inventing edit UX (S-04) |

**Prerequisites:** F-01 + S-01 on disk; local Supabase for the new migration.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Production generate persist fails until DEP-009; Worker rollback does not drop `training_units`.
- One unit per day (`UNIQUE (user_id, date)`) matches the F-01 stub; S-04 must not assume multiple units per date without a migration.
- Soft volume warnings may appear after generate; they do not block `ok: true`.

## Success Criteria (Summary)

- Member generates a week from saved km + A race and sees it after reload.
- Freeze + regenerate keeps frozen type/km.
- Missing km / no A race shows F-01 codes, not a new schema.
