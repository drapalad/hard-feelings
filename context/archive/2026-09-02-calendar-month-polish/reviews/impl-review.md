<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Compact month toolbar, denser phone cells, session structure, manual snapshots

- **Plan**: context/changes/calendar-month-polish/plan.md
- **Scope**: Phase 1–2 of 2
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 1 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Compact km always used one decimal

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/components/plan/plan-month.ts` (`formatCompactKm`)
- **Detail**: Plan and Progress 2.3 require `formatCompactKm(8) === "8"` and `formatCompactKm(8.5) === "8.5"` (locked phone cells: `8` or `8.5`, no `km` suffix). Phase 2 shipped `roundKm(km).toFixed(1)`, which yields `"8.0"`. `plan-month.test.ts` already expected `"8"`; the p2 commit left the helper and the test in conflict (break-check body not restored).
- **Fix**: After `roundKm`, emit `String(rounded)` when `Number.isInteger(rounded)`, else `rounded.toFixed(1)`.
- **Decision**: FIXED — helper now matches the plan and the existing unit tests. Re-ran scoped plan tests (50 passed), `npm test` (191 passed, 2 skipped), `npm run lint` (exit 0).

## Drift check

| Planned | Actual | Verdict |
|---------|--------|---------|
| `snapshotCurrentWeek` always insert + trim, surface errors | `plan.ts` insert/trim/`DB_ERROR`; no `weeksEqual` skip | MATCH |
| Stop auto-insert on generate / Accept / edit | No `snapshotWeekIfChanged` / `insertRevision` in those paths; `restoreWeek` still snapshots | MATCH |
| POST `/api/plan/snapshots` `{ weekStart }`, auth like restore, `prerender = false` | `snapshots.ts` 401/400/503/500 + 200 `{ weekStart, revisions, undoAvailable }` | MATCH |
| GET `latestSnapshotUnits` | `plan.ts` GET; product-gates include snapshots | MATCH |
| Toolbar strip, phone cells, structure lead, Save snapshot dirty/restore select | `PlanCalendar.tsx` / `PlanWorkspace.tsx` as specified; outline Save snapshot (FU-115) | MATCH |
| `formatCompactKm` integer vs one decimal | Was `toFixed(1)`; fixed in this review | MATCH after F1 |
| Extra vs original Notes file list | GET field on `plan.ts`; `accept-proposition.test.ts`; `plan-month.test.ts` | Planned (FU-114 + plan-review F1) |
| Not doing: list/profile/races/chat UI, generate fill, migration, Playwright | Unchanged | MATCH |

## Success criteria

Automated Progress rows 1.1–1.6 / 2.1–2.6 are `[x]` with SHAs `d5ee285` / `b7d92d5`. Re-ran after F1: scoped plan tests 50 passed; `npm test` 191 passed, 2 skipped; `npm run lint` exit 0. Manual rows 2.7–2.10 remain `[ ]`.
