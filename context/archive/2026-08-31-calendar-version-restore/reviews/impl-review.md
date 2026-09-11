<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Calendar Version Restore

- **Plan**: context/changes/calendar-version-restore/plan.md
- **Scope**: Phase 1 of 3 + Phase 2 of 3 + Phase 3 of 3
- **Date**: 2026-08-31
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

## Findings

(none)

## Evidence

- `generateAndPersist` / `acceptProposition` snapshot via `snapshotWeekIfChanged` then `replaceWeek`; no `clearRevisions` anywhere under `src/`.
- Failed generate and hard Accept insert no `plan_revisions` row (tests). Soft Accept snapshots `CURRENT`.
- `replaceWeek` upserts then deletes in-window dates not in the payload; empty→generate→undo→empty is tested.
- `restoreWeek` loads by `id` + `user_id` + `week_start`; 404-shaped `NOT_FOUND`; snapshots live if different; does not delete chosen/later rows. Cap 10 trims oldest.
- `POST /api/plan/restore`: `prerender = false`, zod `revisionId` uuid, `unauthorized()`, `rejectPending` in the handler. Not on `PROTECTED_ROUTES` (`/dashboard`, `/admin` only). Product-gates: logged-out 401 JSON.
- Ownership: B cannot list or restore A’s revisions.
- PUT `/api/plan/units` still has no 409; only Accept uses 409 for `HARD_BOUNDS`. FU-002 body unchanged.
- Calendar native `<select>` labeled from `createdAt` (UTC ISO-derived); “Undo last edit” remains pop-latest.
- FU-001 Status: done under `## Done`, Done: 2026-08-31. FU-020 / FU-021 left open. FU-018/019 unused.
- Extra `PlanCalendar.test.ts` only pins `formatRevisionLabel`; no Playwright / CSS locators.
- Automated: `npm test` 111 passed; Manual 3.4 still `[ ]`.

Phase commits: `b67badc` (p1), `d8cda01` (p2), `615188c` (p3). Epilogue: `2228309`.
