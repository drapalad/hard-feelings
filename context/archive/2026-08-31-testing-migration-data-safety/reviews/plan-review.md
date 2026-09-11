<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Migration data safety

- **Plan**: context/changes/testing-migration-data-safety/plan.md
- **Mode**: Deep
- **Date**: 2026-08-31
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 0 observations (warnings fixed in-plan)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 paths ✓ (seven `supabase/migrations/*.sql`, `memory-supabase.ts`, `ownership.test.ts`, `ci.yml`, `config.toml`, `test-plan.md`, change-folder artifacts), 6/6 symbols ✓ (`createMemorySupabase`, `ENABLE ROW LEVEL SECURITY`, `auth.uid()`, `HF_MIGRATION_PG`, `db reset`, Vitest include), brief↔plan ✓. `supabase/seed.sql` missing as research claimed. No `docs/reference/contract-surfaces.md`.

Riskiest claims checked in-repo: all seven migrations are expand-only; CI job is `npm test` without Docker; memory-supabase does not execute SQL; local DB port 54322; `user_roles.role` CHECK is `'admin'` only.

## Findings

### F1 — Phase 2 Automated did not require an owner-SELECT assertion in source

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Success Criteria / Progress
- **Detail**: Desired End State says `HF_MIGRATION_PG=1` proves RLS owner-read. Automated rows only required skipIf, throwaway DB, and lint. An empty `describe.skipIf` would satisfy those checks. Running Docker is correctly Manual; the **presence** of owner-SELECT assertions is agent-verifiable.
- **Fix**: Add Automated criterion 2.4 that the skipped-in suite still contains assertions that owner SELECT returns distinctive Member A profiles/units/logs after the newest migration. Renumber lint to 2.5 and Manual to 2.6.
- **Decision**: FIXED — PLAN-FIX: Progress 2.4 assertion-in-source; 2.5 lint; Manual 2.6

### F2 — Postgres seeds can violate on-disk CHECKs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details
- **Detail**: `user_roles.role` only allows `'admin'`. Workout `type`, race `priority`, chat `role`, proposition `status`, and `weekly_km` bounds would fail real INSERT even when the harness stored a JS object. The distinctive 42 km payload is valid; the plan did not say so.
- **Fix**: Document CHECK-safe seeds (admin role, enum types, weekly_km 42) in Critical Implementation Details.
- **Decision**: FIXED — PLAN-FIX: CHECK-safe seeds paragraph
