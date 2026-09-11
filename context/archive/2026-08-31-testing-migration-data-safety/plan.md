# Migration data safety Implementation Plan

## Overview

Close test-plan rollout Phase 3 (`context/foundation/test-plan.md` §3): prove a new schema file applied onto existing member rows does not destroy or rewrite those rows, and that the owner can still read them. Default `npm test` uses a SQL migrate-over-fixture harness (CI-cheap). Local Docker Postgres is opt-in. No Playwright, no hosted `db push`, no Phase 4 CI wiring.

## Current State Analysis

Seven dated files under `supabase/migrations/` are all expand (`CREATE TABLE` + indexes + RLS + `CREATE POLICY`). None mutate existing member data. Latest is `20260831194000_project_llm_settings.sql` (`project_settings` singleton). It is already applied locally and hosted — that is not a regression test.

No Vitest file reads those SQL files. `createMemorySupabase` seeds a JS store and cannot execute SQL or `auth.uid()`. CI (`.github/workflows/ci.yml`) runs `npm test` with no Docker. Phase 2 explicitly deferred this surface.

Owner-readable member tables (SELECT `auth.uid() = user_id`): `profiles`, `races`, `training_units`, `chat_messages`, `plan_propositions`, `plan_revisions`, `workout_logs`, `user_roles`. Distinctive fixture shape already exists in `ownership.test.ts` (Member A long 42 km, `structure: "member-a-monday"`).

## Desired End State

`npm test` fails if a file in `supabase/migrations/` (applied after a seeded baseline) drops or rewrites distinctive member payloads, or drops owner SELECT policy text. Synthetic canary SQL (`DROP TABLE training_units`, unqualified `DELETE FROM training_units`, `DROP POLICY` select-own) fails the harness — the live all-expand corpus alone is not the oracle.

`HF_MIGRATION_PG=1` against local Docker (throwaway database, not `db reset`) asserts Member A can `SELECT` those payloads under RLS. Default CI does not need Docker.

Cookbook §6.5 documents that pattern. §3 Phase 3 is `complete`. Phase 4 stays `not started`.

### Key Discoveries:

- All seven migrations are expand-only; `project_llm_settings.sql` is the live “new table over existing members” candidate (`supabase/migrations/20260831194000_project_llm_settings.sql:4`).
- memory-supabase is not a migration engine (`src/lib/test/memory-supabase.ts:275`).
- CI has no Docker (`.github/workflows/ci.yml:19-22`); local DB port 54322 (`supabase/config.toml:29`).
- Superuser bypasses RLS unless `FORCE ROW LEVEL SECURITY` + a non-superuser role (research.md Architecture Insights 6).
- Phase 2 deferred this work (`context/changes/testing-generation-oracle-and-api-contracts/plan.md` What We're NOT Doing).

## What We're NOT Doing

- Playwright, jsdom, e2e, or any UI test.
- Phase 4 CI job / Docker-in-Actions / adding these tests to a new workflow.
- Hosted `db push` / `db reset` of the developer’s `postgres` database as the fixture story.
- pglite or a second embedded engine; real Postgres is `npx supabase` local Docker only.
- Using memory-supabase or a schema-only dump (`pg_dump --schema-only`, `information_schema` snapshot) as the oracle.
- Changing product tables, RLS, or services unless a new test fails on current SQL — then stop; do not weaken the oracle.
- Reopening FU-011/012/013/014/015/022/030/031.
- Opening Phase 4 or rewriting test-plan §1. §2 Risk #4 cells already backported from research.

## Implementation Approach

Cost × signal: ship the harness that can go red on destructive SQL in default `npm test`, including canaries. Then a skippable Postgres file that reuses fixture + file order. Cookbook last.

Complexity: **MEDIUM**. Test-only, but statement classification and throwaway-DB RLS are easy to get tautological.

## Critical Implementation Details

**Oracle.** Distinctive Member A payloads after apply must equal the pre-apply seed (`user_id`, `weekly_km` / `distance_km`, `date`, `structure` where those columns exist). Not “migration listed,” not table still exists, not CREATE TABLE text unchanged.

**Walk.** Sort `supabase/migrations/*.sql` by filename. File 1 creates the first member tables — no prior rows. For each later file: apply previous files into a logical schema, seed every **already created** owner-readable member table, apply the candidate, assert seed payloads and select-own policy text remain.

**Canaries.** Independent of on-disk files: after a full expand baseline + seed, applying synthetic `DROP TABLE training_units`, `DELETE FROM training_units`, and `DROP POLICY training_units_select_own ON training_units` must throw. Otherwise the suite is green only because today’s SQL is additive.

**Postgres opt-in.** `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`. When the flag is set, fail if port 54322 is down — do not skip on connection error. `CREATE DATABASE` unique name; stub `auth.users` + `auth.uid()` from `request.jwt.claim.sub`; apply SQL files; seed; apply newest; `FORCE ROW LEVEL SECURITY`; `SELECT` as a non-superuser with Member A’s uuid. `DROP DATABASE` in teardown. Never `supabase db reset`.

**Default `npm test`.** Must pass without Docker and without `HF_MIGRATION_PG`.

**CHECK-safe seeds.** Rows inserted for Postgres (and stored in the harness) must satisfy on-disk CHECKs: `user_roles.role = 'admin'`; `races.priority` in `A|B|C|D` (one A-race); `training_units` / `workout_logs` `type` in the workout enum; `chat_messages.role` in `user|assistant`; `plan_propositions.status` in `pending|accepted|rejected`; `profiles.weekly_km` in `(0, 300]`. Use `42` / `long` / date `2026-08-10` as the distinctive payload.

---

## Phase 1: CI-cheap migrate-over-fixture harness (Risk #4)

### Overview

Logical schema + distinctive member fixture applied file-by-file. Canaries prove the oracle can fail. No Docker.

**Behavior asserted:** After applying migration `k` onto rows seeded at schema `k-1`, those rows still have the same distinctive payloads and owner SELECT policy text.

**Regression caught:** A new or edited `.sql` that drops/truncates/deletes member tables, drops distinctive columns, rewrites `user_id`/km/dates, or drops select-own.

**Research source:** research.md cheapest layer CI-cheap; canary vs corpus.

**Edge/error/boundary:** Newest on-disk file is expand (`project_settings`) and must keep `profiles` / `training_units` / `workout_logs` seeds. First file has no prior rows. `project_settings` / `agent_reports` are not the owner-read oracle.

**Anti-pattern avoided:** Schema dump as oracle; memory-supabase as engine; suite that only runs the all-expand corpus with no canary.

### Changes Required:

#### 1. Harness

**File**: `src/lib/test/migration-safety.ts` (new)

**Intent**: Load dated SQL files, classify statements enough to create/drop tables and policies and to reject destructive member-data statements, seed distinctive rows, apply a candidate file.

**Contract**: Export a function that, given SQL text (file or synthetic) and a seeded baseline, either returns surviving member rows + policies or throws. Owner-readable table list matches research (not `project_settings`). Distinctive seed uses Member A uuid + 42 km / `member-a-monday` / date `2026-08-10` (same spirit as `ownership.test.ts`). Do not shell out to Postgres. Do not import `createMemorySupabase`.

#### 2. Vitest

**File**: `src/lib/test/migration-safety.test.ts` (new)

**Intent**: Walk on-disk migrations; assert payload survival; assert canaries fail.

**Contract**: Tests live under `src/**/*.test.ts` (already included). Oracle compares distinctive payload fields, not a serialized schema. Include an explicit test that the newest on-disk file does not remove Member A’s training unit / log / profile seed.

### Success Criteria:

#### Automated Verification:

- `src/lib/test/migration-safety.ts` loads `supabase/migrations/*.sql` in filename order and does not use `createMemorySupabase` as the engine
- After each on-disk file following the first, distinctive seeded member payloads still match the pre-apply seed
- Owner-readable member tables that existed before that file still have a FOR SELECT policy whose USING includes `auth.uid() = user_id`
- Synthetic `DROP TABLE training_units`, unqualified `DELETE FROM training_units`, and `DROP POLICY training_units_select_own` fail the harness after a seeded baseline
- Applying the newest on-disk migration over a seeded baseline keeps distinctive `profiles` / `training_units` / `workout_logs` payloads
- The test file does not use a schema dump or `information_schema` snapshot as the expected value
- `npm test` passes
- `npm run lint` passes

---

## Phase 2: Skippable local Postgres owner-read (Risk #4)

### Overview

Throwaway database on local Supabase Postgres. Same fixture and newest-file apply. RLS `SELECT` as Member A. Skipped unless `HF_MIGRATION_PG=1`.

**Behavior asserted:** After the newest migration, Member A’s distinctive rows still exist and a non-superuser session with A’s `auth.uid()` can read them.

**Regression caught:** SQL that leaves tables but breaks RLS / `auth.uid()` so the owner’s SELECT is empty, or that wipes rows in real Postgres in a way the harness missed.

**Research source:** research.md skippable Postgres path; Architecture Insights 4 and 6.

**Edge/error/boundary:** Flag unset → skip (CI green). Flag set and Docker down → fail. Teardown drops the throwaway DB even on failure.

**Anti-pattern avoided:** `db reset` as the fixture; superuser SELECT as “owner-read”; hosted URL.

### Changes Required:

#### 1. Optional PG test

**File**: `src/lib/test/migration-pg.test.ts` (new)

**Intent**: When `HF_MIGRATION_PG=1`, create a unique database on `127.0.0.1:54322`, stub `auth`, apply baseline SQL, seed, apply newest file, `SELECT` as owner, drop database.

**Contract**: `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`. Connection defaults to local supabase (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) unless `HF_MIGRATION_PG_URL` is set. Must not invoke `supabase db reset`. Must not target a hosted hostname. Use `FORCE ROW LEVEL SECURITY` and a non-superuser role for the owner `SELECT`. Add `pg` and `@types/pg` as devDependencies; dynamic-import `pg` inside the opted-in suite so skipped runs do not connect.

### Success Criteria:

#### Automated Verification:

- `src/lib/test/migration-pg.test.ts` uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")` and does not call `db reset`
- The file creates and drops a uniquely named database and does not use a hosted connection string by default
- Default `npm test` (flag unset) skips this file and still passes
- The skipped-in suite still contains assertions that owner `SELECT` returns distinctive Member A `profiles` / `training_units` / `workout_logs` payloads after the newest migration
- `npm run lint` passes

#### Manual Verification:

- With local `npx supabase start` and `HF_MIGRATION_PG=1`, the Postgres test is green and Member A’s distinctive rows are returned by owner `SELECT` after the newest migration

---

## Phase 3: Cookbook §6.5 and Phase 3 complete

### Overview

Write the migrate-over-existing-member-rows pattern into the test-plan cookbook. Mark rollout Phase 3 complete. Do not open Phase 4.

**Behavior asserted:** A later agent adding a dated `.sql` can follow §6.5 without treating “applied” or a schema dump as the proof.

**Regression caught:** Next migration tests snapshot `CREATE TABLE` text or skip canaries.

**Research source:** research.md cookbook intent; test-plan §6.5 TBD.

**Anti-pattern avoided:** File:line in test-plan §2; filling §6.3 (Phase 4); opening Phase 4.

### Changes Required:

#### 1. Cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.5 TBD. Add a Phase 3 line under §6.6. Set §3 Phase 3 Status to `complete`. Update the Last-updated blurb.

**Contract**: §6.5 names: seed distinctive member rows on schema-before-the-new-file; apply the file; assert payloads + owner-read; canaries required; default `npm test` is the harness; `HF_MIGRATION_PG=1` is skippable local Docker; do not `db reset`; do not schema-dump; reference `src/lib/test/migration-safety.test.ts` (and the PG file). No file:line in §1/§2. Phase 4 remains `not started`.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.5 documents migrate-over-existing-member-rows survival (payload oracle, canaries, skippable `HF_MIGRATION_PG=1`, no schema dump, no `db reset`)
- §6.6 notes Phase 3 (applied ≠ preserved; harness in default `npm test`)
- §3 Phase 3 Status is `complete` and Phase 4 is still `not started`
- `npm test` passes
- `npm run lint` passes

---

## Testing Strategy

This change **is** the migrate-over-fixture suite.

### Unit Tests:

- Statement/canary behavior in the harness (Phase 1).

### Integration Tests:

- On-disk migration walk over seeded member rows (Phase 1).
- Optional real Postgres (Phase 2), skipped in default `npm test`.

### Manual Testing Steps:

1. Start local Supabase (`npx supabase start`).
2. Run `HF_MIGRATION_PG=1 npm test -- src/lib/test/migration-pg.test.ts` and confirm owner `SELECT` still returns Member A’s 42 km unit/log/profile after the newest file.

## Performance Considerations

Harness is in-process and cheap. Optional Postgres creates/drops one database per run — only when flagged.

## Migration Notes

Not applicable as product SQL. Tests must not apply anything to hosted Supabase. Local throwaway DB only when `HF_MIGRATION_PG=1`.

## References

- Research: `context/changes/testing-migration-data-safety/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 Risk #4, §3 Phase 3, §6.5 TBD)
- Fixture shape: `src/lib/services/ownership.test.ts`
- Progress format: `.cursor/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: CI-cheap migrate-over-fixture harness (Risk #4)

#### Automated

- [x] 1.1 `src/lib/test/migration-safety.ts` loads `supabase/migrations/*.sql` in filename order and does not use `createMemorySupabase` as the engine — a430bef
- [x] 1.2 After each on-disk file following the first, distinctive seeded member payloads still match the pre-apply seed — a430bef
- [x] 1.3 Owner-readable member tables that existed before that file still have a FOR SELECT policy whose USING includes `auth.uid() = user_id` — a430bef
- [x] 1.4 Synthetic `DROP TABLE training_units`, unqualified `DELETE FROM training_units`, and `DROP POLICY training_units_select_own` fail the harness after a seeded baseline — a430bef
- [x] 1.5 Applying the newest on-disk migration over a seeded baseline keeps distinctive `profiles` / `training_units` / `workout_logs` payloads — a430bef
- [x] 1.6 The test file does not use a schema dump or `information_schema` snapshot as the expected value — a430bef
- [x] 1.7 `npm test` passes — a430bef
- [x] 1.8 `npm run lint` passes — a430bef

### Phase 2: Skippable local Postgres owner-read (Risk #4)

#### Automated

- [x] 2.1 `src/lib/test/migration-pg.test.ts` uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")` and does not call `db reset` — 93d9b0a
- [x] 2.2 The file creates and drops a uniquely named database and does not use a hosted connection string by default — 93d9b0a
- [x] 2.3 Default `npm test` (flag unset) skips this file and still passes — 93d9b0a
- [x] 2.4 The skipped-in suite still contains assertions that owner `SELECT` returns distinctive Member A `profiles` / `training_units` / `workout_logs` payloads after the newest migration — 93d9b0a
- [x] 2.5 `npm run lint` passes — 93d9b0a

#### Manual

- [ ] 2.6 With local `npx supabase start` and `HF_MIGRATION_PG=1`, the Postgres test is green and Member A’s distinctive rows are returned by owner `SELECT` after the newest migration

### Phase 3: Cookbook §6.5 and Phase 3 complete

#### Automated

- [x] 3.1 `context/foundation/test-plan.md` §6.5 documents migrate-over-existing-member-rows survival (payload oracle, canaries, skippable `HF_MIGRATION_PG=1`, no schema dump, no `db reset`) — c8bfac1
- [x] 3.2 §6.6 notes Phase 3 (applied ≠ preserved; harness in default `npm test`) — c8bfac1
- [x] 3.3 §3 Phase 3 Status is `complete` and Phase 4 is still `not started` — c8bfac1
- [x] 3.4 `npm test` passes — c8bfac1
- [x] 3.5 `npm run lint` passes — c8bfac1
