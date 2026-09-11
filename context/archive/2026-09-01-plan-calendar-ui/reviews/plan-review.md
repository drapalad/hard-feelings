<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Compact, readable training week

- **Plan**: context/changes/plan-calendar-ui/plan.md
- **Mode**: Deep
- **Date**: 2026-09-01
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 paths ✓ (`PlanCalendar.tsx`, `PlanCalendar.test.ts`, `dates.ts`, `button.tsx`, `utils.ts`, `change.md`, `backlog.md`), 7/7 symbols ✓ (`weekDates`, `utcToday`, `formatRevisionLabel`, `size="icon"`, `Undo2`, `sm:grid-cols-7`, instructional `Generate a week from your saved weekly km`), brief↔plan ✓. `docs/reference/contract-surfaces.md` absent (skip). UTC check: 2026-08-31 getUTCDay()=1 (Mon), 2026-09-06=0 (Sun).

## Findings

### F1 — Edit form would sit inside the compact mobile row

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Icon actions and compact layout
- **Detail**: The plan set every day `<article>` to `flex-row` below `sm`. The edit form is a stacked Type / km / Structure + Save/Cancel block. Leaving it inside that row would crush the form on ~390px and break the “Save/Cancel stay full width” contract.
- **Fix**: When `editing` is true, force `flex-col` on the article and `w-full` on the form.
- **Decision**: FIXED — contract now requires `flex-col` + `w-full` form while editing; Critical Implementation Details notes the same.

### F2 — Icon actions omitted existing glass outline classes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Icon actions and compact layout
- **Detail**: Week-nav already uses `size="icon"` with `border-white/20 bg-white/10 text-white hover:bg-white/20`. The plan specified `size="icon"` `variant="outline"` without those classes. Default outline chrome is built for a light surface and would vanish on the dark glass card.
- **Fix**: Reuse the existing week-nav outline class string on Edit/Log/Unlog/Freeze icon buttons.
- **Decision**: FIXED — contract now names those classes.
