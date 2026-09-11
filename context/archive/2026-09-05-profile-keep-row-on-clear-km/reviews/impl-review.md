<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Keep last race and notes when weekly km is cleared

- **Plan**: `context/changes/profile-keep-row-on-clear-km/plan.md`
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-05
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

None.

## Evidence

- Migration `20260905120000_profile_weekly_km_nullable.sql`: `weekly_km` DROP NOT NULL; CHECK `NULL OR (0 < km ≤ 300)`. No hosted apply; DEP-029 open.
- `profileWriteSchema.weeklyKm` is `weeklyKmSchema.nullable()`; 0 / negatives still fail. `upsertProfile` uses `Omit<Profile, "weeklyKm"> & { weeklyKm: number | null }`. `asProfileRow` accepts SQL null. `deleteProfile` and `DELETE /api/profile` are gone.
- SetupForm empty Save PUTs `weeklyKm: trimmed === "" ? null` plus long/rest/mix; no profile DELETE; one **Save weekly km**. Coach notes Save still requires km (FU-146).
- Tests: PUT null keeps last race/notes/prefs; GET null km; PATCH on null-km row 200; no-row PATCH 404; SetupForm source-read locks PUT-null.
- Automated Progress all `[x]` with SHAs `b60e84b` / `0a80ea5` / `4aada30`. Manual 3.5 remains `[ ]`.
- Extra files vs Notes (`migration-safety.ts`, tests, DEP/FU) are required by the plan.

## Decision notes

No in-scope CRITICAL or LOW-impact leftover to fix. FU-146 and DEP-029 stay open as planned, not review deferrals.
