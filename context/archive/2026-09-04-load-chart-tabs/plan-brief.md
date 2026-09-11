# Switch km-per-week and daily-load charts with one visible — Plan Brief

> Full plan: `context/changes/load-chart-tabs/plan.md`
> Research: `context/changes/load-chart-tabs/research.md`

## What & Why

Both load charts are stacked and always visible. Members should switch between weekly km sum and daily decay 0.85 via tabs, seeing one chart at a time, with the newer decay view selected on first paint.

## Starting Point

`PlanCalendar` mounts `TrainingLoadChart` and `DailyLoadChart` back-to-back above the month grid. Captions, legends, and series already exist in `TrainingLoadChart.tsx`. No tablist. Calendar mobile chrome (icon generate, compact day-edit, closed log) is already on this branch.

## Desired End State

A Training load tablist above the grid; default daily decay chart; switching to km per week shows week bars only. Captions/legends unchanged. Generate and day-edit chrome unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| One chart vs stacked | One mounted at a time; default decay | Locked in Notes option + S-14.2 / S-14.3 | Plan |
| Tab labels | `km per week` and `daily load (decay 0.85)` — never Weekly/Daily | Verdict override: labels must match captions; decay 0.85 is the daily series name. Short `daily load` is FU-137 | Unattended |
| Tab widget | Native `role="tablist"` / `tab` / `tabpanel`, not shadcn Tabs | `src/components/ui/` has only Button; Notes require `role="tablist"` | Plan |
| Where tabs live | `LoadChartTabs` in `TrainingLoadChart.tsx`; PlanCalendar mounts it | Charts and captions already live in that module; PlanCalendar stays calendar chrome | Unattended |
| Tab state | `useState` default daily; no URL | S-14.3 client-only | Plan |
| Tab order | Daily tab first (default), then km per week | Default-selected tab is the first control | Unattended |
| Aggregation | Keep both `aggregateLoadWeeks` / `aggregateDailyLoad` calls; do not edit `training-load.ts` | Notes: do not change load aggregation | Plan |
| Tests | Source-scan in the two colocated test files; no Playwright | test-plan §6.1 / §7; existing chart tests are source-scan | Plan |
| Lint gate | Touched-file eslint, including a clean `TrainingLoadChart.tsx` | Repo-wide lint is red at HEAD on untouched training-load / pace-estimate files | Plan |

## Scope

**In scope:** `LoadChartTabs` + PlanCalendar wiring; source-scan updates; eslint-clean `TrainingLoadChart.tsx`.

**Out of scope:** aggregation, Profile mix, month grid, generate, chat, day-edit restyle, URL persistence, Weekly/Daily labels, shadcn Tabs, Playwright, lint fixes in `training-load.ts` / those tests.

## Architecture / Approach

Wrapper next to the two chart functions owns selection and exclusive render. Parent still computes both series and places one wrapper above the seven-column grid.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Tabbed load charts | Tablist + one chart + source-scan | Existing PlanCalendar scan still expects `<TrainingLoadChart` in the calendar file |

**Prerequisites:** `calendar-mobile-chrome` already on this branch (HEAD).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Exact daily tab copy includes `(decay 0.85)`; shorter `daily load` is recorded as FU-137.
- Repo-wide `npm run lint` stays red on untouched files; phase gate is touched-file eslint.

## Success Criteria (Summary)

- First paint: tabs + daily decay chart only.
- km per week tab: week bars only.
- Captions/legends/series unchanged; generate and day-edit chrome unchanged.
