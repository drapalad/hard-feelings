# Eight-week Easy / Threshold / Speed load chart — Plan Brief

> Full plan: `context/changes/training-load-chart/plan.md`

## What & Why

The Calendar has no load picture, and a probe UI used mock km because the month GET is only ~35 days. Members need an 8-week Easy / Threshold / Speed chart from real logs and planned units above the month.

## Starting Point

`GET /api/plan?from=&to=` already returns units + logs but caps at 42 days. `PlanWorkspace` replaces state with the visible month grid. Types are the six workout enums; logs snapshot type + km. Profile mix columns must not drive this chart.

## Desired End State

A compact stacked CSS chart above the month shows eight UTC weeks (five past + current + two future) with caption `Easy / Threshold / Speed · km per week · logs + plan` and a three-series legend. Km are derived: past dates prefer logs, today/future use the plan. No mock series, no chart library, no SetupForm/generate/chat/snapshot changes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Type mapping | Easy = base+recovery+long; Threshold = tempo+threshold; Speed = anaerobic | Locked Notes | Plan |
| Window | Eight UTC weeks from `utcMondayOf(utcToday())`, offsets −5…+2 | Locked length; origin was unspecified so today-relative (chart does not follow the browsed month) | Unattended |
| Per-date fallback | `date < today` → log else unit; `date >= today` → unit only | Locked “today and future = plan”; current-week yesterday still uses logs | Plan |
| Fetch | Keep month GET; add 8-week GET; merge by date; `MAX_PLAN_GET_RANGE_DAYS = 56` | Month ∪ chart > 56 for the current month, so one union GET cannot stay at the locked minimum cap | Unattended |
| Chart library | CSS stacked bars + `cn()`; no npm chart package | Locked files / Do-not | Plan |
| Placement | Above the `grid-cols-7` month, below toolbar/errors | Locked “above the month” | Plan |
| Caption / legend | Exact caption string; legend Easy / Threshold / Speed | Locked Visible + Do | Plan |
| Colors / stack | Easy slate, Threshold orange, Speed red; Easy at the bottom | Match calendar `TYPE_TONE` family; easy is most of the volume | Unattended |
| Empty weeks / scale | Always eight bars; height vs max total (max 0 → 1) | Locked eight weeks; avoid divide-by-zero | Unattended |
| Mix columns | Do not read profile mix / SetupForm | Locked Do-not | Plan |
| Testing | Colocated mapping tests + source-scans; contract 57-day reject; no Playwright | Locked tests; test-plan §6.3; existing calendar `2026-` lock | Plan |

## Scope

**In scope:** `training-load.ts` + tests, `TrainingLoadChart.tsx`, calendar mount, workspace 8-week GET + merge, `MAX_PLAN_GET_RANGE_DAYS = 56`, contract-test update.

**Out of scope:** Profile mix/pace, migrations, npm charts, generate/chat/snapshot, SetupForm, Playwright, closing unrelated FU/DEP.

## Architecture / Approach

`loadChartWindow` + `aggregateLoadWeeks` (client, from GET payloads) → CSS bars in `TrainingLoadChart` → `PlanCalendar` above the grid. Workspace fetches month grid and chart window in parallel on `loadMonth`, merges by date, keeps week mutation merges.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Cap + mapping | 56-day GET; bucket + logs-vs-plan tests | Contract fixture still rejecting 43 days after the cap moves |
| 2. Chart + fetch | Visible bars from real km; month navigation does not wipe the window | Replacing units with month-only payload |

**Prerequisites:** Compact calendar, races overlay, generate-via-chat, chat-auto-apply, coach-data-request, profile prefs already on this branch.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Chart stays today-relative when browsing another month (FU-123). Alternative: slide the eight weeks with `visibleMonth`.
- Two GETs at cap 56 rather than raising the cap to union nearby months (FU-124).
- DEP-020 remains open and unused here.

## Success Criteria (Summary)

- Chart above the month uses real km with the locked caption, mapping, and log/plan rule.
- 8-week GET is accepted (56) and 57 is still rejected.
- Generate, chat, snapshot, and SetupForm are untouched.
