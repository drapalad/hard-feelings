# Race Pace Estimates — Plan Brief

> Full plan: `context/changes/race-pace-estimates/plan.md`

## What & Why

Add a read-only "Estimated paces" section to the profile SetupForm so runners can see predicted finish times (5K, 10K, Half, Marathon) based on a reference race result. This gives the member a quick sanity check on their fitness level directly on the profile page.

## Starting Point

`SetupForm` collects weekly km, long/rest days, mix percentages, and manages the race calendar. The `Race` type has no finish-time or distance field — no pace prediction exists anywhere in the app.

## Desired End State

Below the race calendar, a new "Estimated paces" card lets the user pick a reference distance and enter a finish time. Four predicted race times appear instantly using the Riegel formula. Nothing is persisted.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Reference race input | Manual input (distance dropdown + time) | `Race` type has no time/distance field, so auto-detection from existing races is not possible in v1. | Unattended |
| Prediction formula | Riegel (`t2 = t1 * (d2/d1)^1.06`) | Industry-standard, simple, well-known — locked decisions say "Riegel or equivalent". | Plan |
| Persistence | None — derived on render | Locked decisions explicitly say "do not persist estimates in the DB". | Plan |
| Distance options | 5K / 10K / Half / Marathon / Custom | Locked decisions list four standard distances; Custom added for flexibility. | Unattended |
| Time format | `H:MM:SS` (hours omitted when < 1h → `MM:SS`) | Locked decisions specify `H:MM:SS` format. | Plan |
| Architecture | Pure service + UI component | Service is testable without DOM; component is a thin layer — matches `src/lib/services/` pattern. | Plan |

## Scope

**In scope:** Riegel predictor service with tests, UI section in SetupForm with manual reference input, client-side recalculation

**Out of scope:** DB persistence, Race model changes, Strava import, server-side API, race CRUD changes

## Architecture / Approach

Pure function in `src/lib/services/pace-estimate.ts` (Riegel formula + formatting) → consumed by a new `<section>` inside `SetupForm.tsx`. All state is local `useState`; no props or API changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pace estimate service and tests | Pure predictor + formatTime + unit tests | Low — straightforward math |
| 2. UI component in SetupForm | Reference input + estimates display | Low — follows existing form patterns |

**Prerequisites:** None — builds on shipped S-01 SetupForm.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Riegel exponent 1.06 is a population average; individual runners may see different scaling — acceptable for v1, noted in UI as "estimates".
- `Race` type may gain a time field later (e.g., Strava import or race results feature); at that point auto-detection can replace manual input.

## Success Criteria (Summary)

- Unit tests pass for the Riegel predictor and time formatting
- Profile tab shows estimated paces section with working reference input
- Estimates recalculate on input change; clearing input shows a prompt
