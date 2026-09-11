<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Generation oracle and API contracts

- **Plan**: context/changes/testing-generation-oracle-and-api-contracts/plan.md
- **Mode**: Deep
- **Date**: 2026-08-31
- **Verdict**: SOUND
- **Findings**: 0 critical 1 warning 0 observations (warning fixed in-plan)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 paths ✓ (`km.ts`, `generate-plan.ts`, `generate-plan.test.ts`, `plan.ts` handler, `plan/units.ts`, `plan/logs.ts`, `supabase.ts`, `memory-supabase.ts`, `product-gates.test.ts`, `test-plan.md`), 8/8 symbols ✓ (`roundKm`, `generatePlan`, `generateAndPersist`, `editUnit`, `upsertLog`, `createClient`, `unitEditSchema`, `workoutLogWriteSchema`), brief↔plan ✓. No `docs/reference/contract-surfaces.md`.

Riskiest claims checked in-repo: fill split uses last-day `roundKm` remainder; `validatePlan` under-target is silent (oracle must be sum vs weeklyKm); Zod object schemas have no `.strict()`; persist writes `user_id: userId` from the session argument; log `type` comes from the planned unit; Phase 1 handler tests return before `createClient`.

## Findings

### F1 — Handler generate would be date-dependent if weekStart is omitted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Handler contract tests
- **Detail**: `resolveWeekStart(undefined)` uses `utcToday()`. A generate POST with `{}` would pin the week to whatever day the suite runs, so stored-row assertions could flake or seed the wrong dates. The draft contract did not require a fixture Monday.
- **Fix**: Pin every generate/edit/log request to `weekStart`/`date` `2026-08-10` in Critical Implementation Details and the Phase 2 file contract.
- **Decision**: FIXED — PLAN-FIX: fixture Monday `2026-08-10`; `locals` includes `isAdmin: false`
