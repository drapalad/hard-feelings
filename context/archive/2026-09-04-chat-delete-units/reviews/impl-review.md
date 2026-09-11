<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Coach and day panel can delete a calendar workout

- **Plan**: context/changes/chat-delete-units/plan.md
- **Scope**: Phase 1 of 3 through Phase 3 of 3
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

`63a783d..HEAD`: `23a6098` (p1), `7db0daa` (p2), `0192def` (p3), `78a4b46` (epilogue). Product files: `src/types.ts`, `openai-chat.ts` + test, `propose-adaptation.ts` + test, `plan-adaptation.ts` + test, `chat.ts` + test, `plan.ts` + test, `src/pages/api/plan/units.ts`, `product-gates.test.ts`, `plan-contracts.test.ts`, `PlanCalendar.tsx` + test, `PlanWorkspace.tsx` + test. Context: change.md, plan.md, plan-brief.md, plan-review.md, backlog FU-144. No migration.

## Plan drift

| File | Plan | Actual | Verdict |
| ---- | ---- | ------ | ------- |
| `src/types.ts` | `UnitMutation.delete?: true`; `TrainingUnit` unchanged | Matches | MATCH |
| `openai-chat.ts` | zod optional boolean; JSON schema required boolean `delete`; one-date delete prompt; keep “Never emit a full replacement week.” | Matches (`required` includes `"delete"`; prompt lines 322–323) | MATCH |
| `propose-adaptation.ts` | copy `delete: true` in sanitize and `toRawProposeResult`; null type+km ≠ delete | Matches | MATCH |
| `plan-adaptation.ts` | `Map.delete` when `delete === true`; skip frozen unless `skipFrozen: false`; no 0 km upsert | Matches | MATCH |
| `chat.ts` | explicit `deletedDates` from `mutation.delete`; default `[]` on persist; `mondaysToPersist` unions deleted Mondays; `incomingForWeek` skips deleted existing/proposed | Matches; `acceptProposition` still calls persist without deleted dates | MATCH |
| `plan.ts` | `deleteUnit`: NOT_FOUND if missing; `skipFrozen: false`; `replaceWeek` leftover; no snapshot; no log delete | Matches | MATCH |
| `units.ts` DELETE | auth first; `weekStartSchema` on `?date=`; 400/404/500; owner `locals.user.id`; `rejectPending` like PUT | Matches | MATCH |
| `PlanCalendar.tsx` | **Delete workout** only when `unit` defined; `onDeleteUnit`; `cn()`; `size="icon"` stays 2; keep Edit / Make AI / log details / Freeze; panel stays open | Matches (`selectedInMonth` still in-month after Rest) | MATCH |
| `PlanWorkspace.tsx` | `DELETE /api/plan/units?date=`; `mergeWeekSlice`; do not clear logs | Matches | MATCH |
| Tests | product-gates, contracts, calendar/workspace source-scan, `plan.test.ts` leftover absence | Matches | MATCH |
| Out of scope | no `rest` type; no auto-delete logs; no freeze/generate change; no new table; no option (b) | Not in diff | MATCH |

## Safety & patterns

- DELETE is JSON 401 via `unauthorized()` before date parse; persist uses `.eq("user_id", userId).in("date", leftover)` (existing `replaceWeek`); extra `userId` query ignored (contracts).
- Calendar delete mirrors logs DELETE (`?date=`, `credentials: "same-origin"`), not a client filter.
- Frozen chat skip vs calendar `skipFrozen: false` is the planned FU-119/FU-144 split, not drift.

## Success criteria

- Phase 1 scoped tests + `npm test` + touched-file eslint + `npx astro check`: PASS at `23a6098`
- Phase 2 scoped tests + `npm test` + touched-file eslint + `npx astro check`: PASS at `7db0daa`
- Phase 3 scoped tests + `npm test` + touched-file eslint + `npx astro check`: PASS at `0192def`
- Impl-review re-run: `npm test` 390 passed, 2 skipped; touched-file eslint across p1–p3 paths PASS. Repo-wide `npm run lint` remains red at HEAD on untouched training-load / pace-estimate files (ADAPT; not this diff). `npx astro check` 0 errors (pre-existing unused-React hints elsewhere).
- Manual 3.5: still `[ ]` (human-only)

## Findings

None.

## Decisions

No findings to triage.
