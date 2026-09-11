<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Keep last race and notes when weekly km is cleared

- **Plan**: `context/changes/profile-keep-row-on-clear-km/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: SOUND
- **Findings**: 0 critical 0 warnings 0 observations (2 findings triaged and FIXED in-plan)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 13/13 paths ✓ (`SetupForm.tsx`, `profile.ts`, `profile-races.ts`, `profile.ts` API, `profile.test.ts`, `migration-safety.ts`, `migration-safety.test.ts`, `SetupForm.test.ts`, `profile-races.test.ts`, `types.ts`, `20260813104727_profiles_and_races.sql`, `deferred.md`, `backlog.md`), 6/6 symbols ✓ (`asProfileRow`, `upsertProfile`, `deleteProfile`, `DELETE` on `/api/profile`, `weeklyKmSchema`, `profiles_weekly_km_bounds`), brief↔plan ✓.

Blast radius: `deleteProfile` / profile `DELETE` only in `profile.ts`, `profile.test.ts`, and `SetupForm.tsx`. `product-gates.test.ts` does not list `/api/profile`. Chat freeze already rejects null km. Generate already no-ops on `weeklyKm === null`.

## Findings

### F1 — upsertProfile intersection type would reject null

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Profile service Contract
- **Detail**: Plan first wrote `Profile & { weeklyKm: number | null }`. `Profile.weeklyKm` is `number`, so the intersection stays `number` and TypeScript would reject `weeklyKm: null` on PUT. S-134.1 would not typecheck.
- **Fix**: Use `Omit<Profile, "weeklyKm"> & { weeklyKm: number | null; coachNotes?: string | null }`. Chat freeze still passes a `Profile` (number).
- **Decision**: FIXED — plan and brief now use `Omit<Profile, "weeklyKm">`.

### F2 — Phase 1 eslint listed a .sql file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria 1.3 / Progress 1.3
- **Detail**: `npx eslint …/20260905120000_profile_weekly_km_nullable.sql` can fail or no-op depending on eslint ignore; a red gate on SQL is a false stop.
- **Fix**: Drop the `.sql` path from the eslint command; keep TS files only.
- **Decision**: FIXED — 1.3 eslint command is TS-only.

## Notes

PLAN-FIX: F1 (upsert type), F2 (eslint paths). No FU opened for these — both are mechanical. FU-146 (notes Save still requires km) and DEP-029 remain as planned.
