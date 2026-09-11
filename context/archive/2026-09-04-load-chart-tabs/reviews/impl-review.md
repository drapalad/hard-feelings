<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Switch km-per-week and daily-load charts with one visible

- **Plan**: context/changes/load-chart-tabs/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-09-04
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Git scope

`6d988a5..HEAD`: `9cf5287` (p1), `8f09000` (epilogue). Product files: `PlanCalendar.tsx`, `PlanCalendar.test.ts`, `TrainingLoadChart.tsx`, `TrainingLoadChart.test.ts`. Context: plan, brief, plan-review, change.md, backlog FU-137. `training-load.ts` not in the diff.

## Plan drift

| File | Plan | Actual | Verdict |
| ---- | ---- | ------ | ------- |
| `TrainingLoadChart.tsx` | `LoadChartTabs`; labels `km per week` / `daily load (decay 0.85)`; `role="tablist"` named Training load; `<button type="button" role="tab">`; default `useState("daily")`; ternary exclusive mount; `role="tabpanel"`; captions/series unchanged; eslint-clean | Matches (`LoadChartTabs` ~216–255); prettier-only wrap on SVG date `<text>` (HEAD debt, in-scope because we edited the file) | MATCH |
| `PlanCalendar.tsx` | Replace stacked charts with `<LoadChartTabs weeks={aggregateLoadWeeks…} days={aggregateDailyLoad…} />` above the grid; no tab state here; keep generate / day-edit chrome | Single wrapper at ~616; `RefreshCw`, `grid-cols-2`, closed `<details>`, Make AI slot unchanged | MATCH |
| `PlanCalendar.test.ts` | Require `LoadChartTabs` above grid; both aggregates; not consecutive chart JSX | Matches | MATCH |
| `TrainingLoadChart.test.ts` | Tablist, labels, default daily, ternary, not Weekly/`>Daily<` | Matches | MATCH |
| `training-load.ts` | Do not edit | Not in diff | MATCH |

## Success criteria

- `npm test -- src/components/plan/PlanCalendar.test.ts src/components/plan/TrainingLoadChart.test.ts`: PASS (24)
- `npm test`: PASS (349; 2 skipped)
- Touched-file `npx eslint` on the four plan files: PASS. Repo-wide `npm run lint` remains red at HEAD on untouched `training-load.ts` / those tests / `pace-estimate.test.ts` (ADAPT; not this diff)
- `npx astro check`: PASS (0 errors; pre-existing unused-React hints)
- Manual 1.6–1.8: still `[ ]` (human-only)

## Findings

None.

## Decisions

No findings to triage.
