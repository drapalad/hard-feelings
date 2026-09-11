# Daily Training Load Decay Chart — Plan Brief

> Full plan: `context/changes/daily-load-decay/plan.md`

## What & Why

Add a per-day exponential-decay training load model (Easy / Threshold / Speed) and render it as an SVG polyline chart on the calendar page. This gives the runner a visual sense of accumulated training stress across three intensity dimensions, with spikes decaying visibly over ~7 days.

## Starting Point

`PlanCalendar` already shows a weekly stacked-bar chart (`TrainingLoadChart`) using `aggregateLoadWeeks`. The `training-load.ts` module has bucket mapping, `pickDayLoad`, and the 56-day chart window — but no per-day accumulation or decay model.

## Desired End State

Three colored polylines (Easy green, Threshold amber, Speed red) on an SVG chart below the weekly bar chart, showing `load[d] = load[d-1] * 0.85 + km[d]` per bucket over the 56-day window. Tooltip on hover. Existing weekly bar stays.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Decay factor | 0.85 (configurable constant) | Specified in locked decisions | Unattended |
| Chart library | SVG only, no charting library | Locked decisions forbid charting libraries | Unattended |
| Data source per day | Reuse `pickDayLoad` (log wins in past, plan wins today/future) | Already handles log-vs-plan priority correctly | Plan |
| Chart window | Same 56-day window as weekly chart (`loadChartWindow`) | Consistent visible range, no new data fetch needed | Plan |
| Placement | Below existing weekly bar chart, above calendar grid | Locked decisions say "above or below the calendar grid"; placing near existing chart is natural | Unattended |
| Tooltip implementation | HTML overlay via React state on mouse move | SVG `<title>` has poor cross-browser formatting; React state tooltip matches interactive island pattern | Plan |

## Scope

**In scope:**
- `nextDailyLoad` and `aggregateDailyLoad` pure functions in `training-load.ts`
- `DailyLoadChart` SVG component in `TrainingLoadChart.tsx`
- Wiring in `PlanCalendar.tsx`
- Unit tests (≥3 scenarios per function)

**Out of scope:**
- Removing existing weekly bar chart
- Changing workout types, accent taxonomy, or plan generation
- Using mock data or a charting library
- New data fetching / API changes

## Architecture / Approach

Pure functions (`nextDailyLoad`, `aggregateDailyLoad`) added to the existing `training-load.ts`. A new named-export `DailyLoadChart` React component in `TrainingLoadChart.tsx` renders an SVG with three `<polyline>` elements. `PlanCalendar` calls `aggregateDailyLoad` and passes the result to `DailyLoadChart`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Daily Load Decay Model + Tests | Pure functions + unit tests | Minimal — well-defined formula |
| 2. SVG Polyline Chart + Calendar Wiring | Visual chart + integration | SVG layout/scaling needs care |

**Prerequisites:** None — builds on existing training-load module.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Decay factor 0.85 is locked but may need tuning after real use — configurable constant allows future change.

## Success Criteria (Summary)

- Three load lines visible on the calendar page, decaying after spikes
- Tooltip shows date + three values on hover
- All existing and new tests pass
