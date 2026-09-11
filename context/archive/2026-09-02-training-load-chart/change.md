---
change_id: training-load-chart
title: Eight-week Easy / Threshold / Speed load chart from logs and plan
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/components/plan/training-load.ts` (bucket + week aggregate), `src/components/plan/TrainingLoadChart.tsx` (CSS stacked bars, `cn()`), `src/components/plan/PlanCalendar.tsx` (chart above the month), `src/components/plan/PlanWorkspace.tsx` (8-week GET), `src/lib/services/plan.ts` (`MAX_PLAN_GET_RANGE_DAYS`), tests for mapping and logs-vs-plan fallback. No new table. No npm chart library.

A decision-pack screen used mock series because the probe month GET is not an 8-week window. Production must derive real km.

### Today

Week tab is month grid + week generate/chat. `GET /api/plan?from&to` already returns `training_units` + `workout_logs` but caps at 42 days (month grid). No load chart. Profile may already have mix percents from `profile-plan-prefs`; this chart does **not** read those columns — it buckets units/logs by type.

### Do

1. Mapping: Easy = `base`+`recovery`+`long`; Threshold = `tempo`+`threshold`; Speed = `anaerobic`.

2. Window: eight UTC weeks (five past Mondays + current + two future). Past weeks: log km (and log type) when a log exists, else planned unit. Today and future dates: planned units only.

3. Fetch via existing range GET (`listRange` + `listLogsRange`); raise `MAX_PLAN_GET_RANGE_DAYS` from 42 to at least 56 (8×7 inclusive).

4. Compact stacked CSS bars or inline SVG above the month. Caption exactly `Easy / Threshold / Speed · km per week · logs + plan`. Legend with the three series.

5. Do not ship hardcoded week km.

### Do not

- Add Profile mix fields, pace fields, a migration, or an npm chart library.
- Change generate, chat, or snapshot behavior.

### Visible

A small labeled 8-week Easy / Threshold / Speed chart above the calendar.

### Sequencing

After `generate-via-chat` (`PlanCalendar.tsx` / `PlanWorkspace.tsx`). Do not run in parallel with `calendar-month-polish` or `races-on-calendar`. `profile-plan-prefs` may already be on master; do not edit `SetupForm`.
