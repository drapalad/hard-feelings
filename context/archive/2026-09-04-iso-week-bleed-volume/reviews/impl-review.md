<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Show bleed-Monday units and ISO-week volume in coach context

- **Plan**: context/changes/iso-week-bleed-volume/plan.md
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

`50273d4..HEAD`: `053a988` (p1), `746f18c` (epilogue). Product files: `PlanCalendar.tsx`, `PlanCalendar.test.ts`, `chat.ts`, `chat.test.ts`, `openai-chat.ts`, `openai-chat.test.ts`, `propose-adaptation.ts`. Context: plan, brief, plan-review, change.md, backlog FU-143. `plan-adaptation.ts` / `gateByIsoWeek` not in the diff.

## Plan drift

| File | Plan | Actual | Verdict |
| ---- | ---- | ------ | ------- |
| `PlanCalendar.tsx` | Bind `unit` for every grid date; button when `inMonth \|\| unit`; Rest still `inMonth`; panel select allows bleed-with-unit; caption `ISO week includes` above weekday headers; fade keep/raise via `cn()`; Flag in-month only | `byDate.get(date)`; `{inMonth \|\| unit ? (`; `selectedHasUnit`; `formatIsoWeekIncludesCaption(grid[0])` after `LoadChartTabs`; bleed+unit `opacity-60`; race lookup still `inMonth` | MATCH |
| `chat.ts` | `loadIsoWeeks` via `utcMondayOf` / `weekDates` / `listRange`+`listLogsRange`; keep `loadCurrentLoad` | `loadIsoWeeks` next to `loadCurrentLoad`; `isoWeeks` on first-pass `complete` | MATCH |
| `openai-chat.ts` | `isoWeeks` on `LlmProposeRequest`; Mon–Sun ISO `weeklyKm` sentence; keep Current load JSON | Prompt line + `ISO weeks JSON` | MATCH |
| `propose-adaptation.ts` | Optional `isoWeeks` on `ProposeCompleteFn` | One optional field | MATCH |
| Tests | Source-scan bleed bind/select/caption; real `isoWeeks` from seeded bleed Monday; prompt wording | PlanCalendar / chat / openai-chat tests updated | MATCH |

## Success criteria

- `npm test -- src/components/plan/PlanCalendar.test.ts src/lib/services/chat.test.ts src/lib/services/openai-chat.test.ts`: PASS (50)
- `npm test`: PASS (382; 2 skipped)
- Touched-file `npx eslint` on the seven plan files: PASS. Repo-wide `npm run lint` remains red at HEAD on untouched training-load / pace-estimate files (ADAPT; not this diff)
- `npx astro check`: PASS (0 errors; pre-existing unused-React hints)
- Break-check: `dates.slice(1)` in `loadIsoWeeks` went red (omitted `2026-08-31`); restored via `git checkout`
- Manual 1.6–1.7: still `[ ]` (human-only)

## Findings

None.

## Decisions

No findings to triage.
