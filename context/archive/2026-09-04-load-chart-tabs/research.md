---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "load-chart-tabs: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: load-chart-tabs

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `PlanCalendar` mounts both charts stacked above the month grid (`src/components/plan/PlanCalendar.tsx:606-607`). Import: `TrainingLoadChart, { DailyLoadChart } from "./TrainingLoadChart"` (`:9`). There is no `role="tablist"` in this file.
- Captions (locked in tests): weekly `"Easy / Threshold / Speed · km per week · logs + plan"`; daily `"Easy / Threshold / Speed · daily load (decay 0.85) · logs + plan"` (`src/components/plan/TrainingLoadChart.tsx:5-6`, `TrainingLoadChart.test.ts:8-12`).
- `DailyLoadChart` lives in the same module as `TrainingLoadChart` (`TrainingLoadChart.tsx:84`), not a separate file.
- `PlanCalendar.test.ts` asserts TrainingLoadChart is above the grid (`:103-110`). It does not currently forbid `DailyLoadChart` being mounted at the same time (need to confirm — it contains TrainingLoadChart; DailyLoadChart mount is in source at 607).
- Verdict override: do not label tabs Weekly / Daily; captions already distinguish km-per-week sum vs decay 0.85.

## Code References

- `src/components/plan/PlanCalendar.tsx:9` - both chart exports from TrainingLoadChart.tsx
- `src/components/plan/PlanCalendar.tsx:606-607` - both mounted
- `src/components/plan/TrainingLoadChart.tsx:5-6` - captions
- `src/components/plan/TrainingLoadChart.tsx:22-65` - weekly stacked bars
- `src/components/plan/TrainingLoadChart.tsx:84-216` - DailyLoadChart polyline
- `src/components/plan/TrainingLoadChart.test.ts:8-12` - LOAD_CHART_CAPTION lock
- `src/components/plan/TrainingLoadChart.test.ts:47-49` - DailyLoadChart export + polyline
- `src/components/plan/PlanCalendar.test.ts:103-110` - TrainingLoadChart above grid

## Architecture Insights

Series, captions, and aggregation stay in `TrainingLoadChart.tsx` / `training-load.ts` (aggregation imported as `aggregateLoadWeeks` / `aggregateDailyLoad` in PlanCalendar). Tabs are a PlanCalendar (or small wrapper) concern. Unmounting the inactive chart matches Notes “Do not keep both mounted.”

## Open Questions

- `training-load.ts` aggregation not opened; Notes say do not change load aggregation.
- Source-scan in `PlanCalendar.test.ts` may need to allow a tablist and a single chart component at a time.
- No migration. Client-only tab state.
- Collision with four other PlanCalendar.tsx changes.
