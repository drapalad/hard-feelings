<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Profile weekly km and race calendar

- **Plan**: context/changes/profile-and-race-calendar/plan.md
- **Scope**: Phase 4 of 4 (full plan)
- **Date**: 2026-08-13
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — DELETE /api/profile is extra vs Phase 3 contract

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/profile.ts:50
- **Detail**: Phase 3 listed GET/PUT only. Phase 4 added DELETE (and `deleteProfile`) so an empty km save can remove the `profiles` row. That matches schema (`weekly_km NOT NULL` ⇒ unset = no row), plan-brief “clearing km = delete the profiles row”, and manual 4.9 empty-state-when-cleared. Not a second product feature.
- **Fix**: Leave as-is; optionally note DELETE in the plan as an addendum so later slices treat it as canonical.
- **Decision**: FIXED

### F2 — POST/PATCH race handlers can throw a non-JSON 500

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/races.ts:38
- **Detail**: GET `/api/races` and all `/api/profile` handlers wrap DB work in try/catch and return JSON `DB_ERROR`. POST `/api/races` and PATCH `/api/races/[id]` do not. `insertRace`/`updateRace` call `listRaces`, which throws on PostgREST failure, so the island can get a non-JSON Worker 500 and show “Request failed”.
- **Fix**: Wrap POST/PATCH/DELETE race handlers in the same try/catch as GET, returning `jsonError(500, "DB_ERROR", message)`.
- **Decision**: FIXED

### F3 — Unique-violation 400s leak the Postgres message

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/races.ts:122
- **Detail**: `23505` is mapped to `DUPLICATE_RACE_DATE` / `SECOND_A_RACE` correctly via index/constraint name, but `message` is still `error.message` from Postgres (constraint names, key tuples). `validateRaceList` already has the user-facing copy; concurrent writes skip that path and `SetupForm` renders the raw string.
- **Fix**: On `uniqueError`, reuse the `validateRaceList` messages for those codes.
- **Decision**: FIXED

### F4 — Manual 4.8/4.9 marked done from a persistence-focused report

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/profile-and-race-calendar/plan.md:321
- **Detail**: Human confirmation was “added, signed out/in, everything stays.” That covers 4.5–4.7 (land on dashboard, km/races persist). 4.8 (second A / duplicate date) and 4.9 (edit/delete/empty states) are implemented in the island and were checked off with the same confirmation. Automated `npm test` / `lint` / `build` all passed (29 tests).
- **Fix**: No code change. Re-hit second-A, duplicate-date, edit/delete, and empty km/list on `/dashboard` if you want those rows fully witnessed.
- **Decision**: FIXED
