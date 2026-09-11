<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Switch km-per-week and daily-load charts with one visible

- **Plan**: context/changes/load-chart-tabs/plan.md
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical 1 warning 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 6/6 paths ✓ (`PlanCalendar.tsx`, `PlanCalendar.test.ts`, `TrainingLoadChart.tsx`, `TrainingLoadChart.test.ts`, `training-load.ts`, `ui/button.tsx`), 5/5 symbols ✓ (`TrainingLoadChart`, `DailyLoadChart`, `aggregateLoadWeeks`, `aggregateDailyLoad`, captions), brief↔plan ✓.

Deep verify (explore): all six plan claims CONFIRM. Extra callers: `training-load.test.ts` (aggregates, out of scope). `LoadChartTabs` does not exist yet. `Topbar.test.ts` bans `role="tablist"` only in `DashboardTabs.tsx`.

## Findings

### F1 — Tab controls must be buttons for jsx-a11y

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — LoadChartTabs contract
- **Detail**: Plan required `role="tab"` but did not specify the host element. `eslint-plugin-jsx-a11y` is enabled; a `div`/`span` with `onClick` would fail `click-events-have-key-events` / `no-static-element-interactions` and risk a Phase 1 lint gate fail.
- **Fix**: Specify `<button type="button" role="tab">` and `aria-selected`; no arrow-key roving (not in Notes).
- **Decision**: FIXED — contract now requires `<button type="button" role="tab">`. Also noted `Topbar.test.ts` tablist ban is DashboardTabs-only so a local tablist will not trip it.

## Triage

PLAN-FIX: F1 — tab host element is `button`.
