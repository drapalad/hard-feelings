---
date: 2026-08-31T18:08:54+00:00
researcher: Cursor Grok 4.6
git_commit: a786bc087b9a6b89840f00fc2a4f01d9e1f3b700
branch: testing-migration-data-safety
repository: hard-feelings
topic: "Ground rollout Phase 3 of context/foundation/test-plan.md (Risk #4)"
tags: [research, codebase, supabase, migrations, vitest, data-safety]
status: complete
last_updated: 2026-08-31
last_updated_by: Cursor Grok 4.6
---

# Research: Ground rollout Phase 3 of context/foundation/test-plan.md (Risk #4)

**Date**: 2026-08-31T18:08:54+00:00
**Researcher**: Cursor Grok 4.6
**Git Commit**: a786bc087b9a6b89840f00fc2a4f01d9e1f3b700
**Branch**: testing-migration-data-safety
**Repository**: hard-feelings

## Research Question

Ground rollout Phase 3 of `context/foundation/test-plan.md` ("Migration data safety").

Risk #4: prove apply-new-migration-over-existing-member-rows; those rows still exist and remain readable by the owner.

Challenge: “migration applied” ≠ data preserved.

Hot-spot evidence (NOT anchors): `supabase/migrations`.

Stack: Vitest 4, include `src/**/*.test.ts`, memory-supabase at `src/lib/test/memory-supabase.ts`. Local Docker Supabase exists (`npx supabase start`); hosted apply is DEP territory, not this test.

AGENTS.md: new tables need dated migrations + RLS + per-operation policies. Do not run hosted `db push` in this change.

Latest product migration on disk: `supabase/migrations/20260831194000_project_llm_settings.sql` (already applied locally and hosted — that is not a substitute for a migrate-over-fixture test).

Locate existing tests around migrations. Identify cheapest useful layer. Flag if a real Postgres migrate-over-fixture is needed vs a SQL-parse/fixture harness. Fill cookbook intent for §6.5.

## Summary

Risk #4 is a **real coverage gap**, not a live product hole today. Every file in `supabase/migrations/` is an **expand** (`CREATE TABLE` + indexes + `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`). None `DROP` / `TRUNCATE` / `DELETE FROM` / `UPDATE` member data. Nothing in Vitest applies those files, seeds rows, then re-reads them. Hosted/local “already applied” is an ops fact, not a regression oracle.

| Risk | Live hole today? | What would actually break | Cheapest useful layer |
|------|------------------|---------------------------|------------------------|
| **#4** | No demonstrated migrate-over-existing-rows | A new `.sql` that `DROP TABLE` / `TRUNCATE` / unqualified `DELETE` / `DROP COLUMN` of distinctive payload / `DROP POLICY` select-own; or a rewrite that leaves tables but wipes `user_id` / km / dates | **CI-cheap:** SQL migrate-over-fixture harness in `npm test` (logical schema + distinctive member rows; canary destructive SQL must fail). **Skippable:** throwaway local Postgres (`npx supabase` Docker, **not** `db reset`, **not** hosted) for “rows still `SELECT`able as the owner under RLS” |

**Do not drop or reframe this risk.** It is untested. Likelihood stays Medium because every slice adds a dated SQL file (DEP-010…016 pattern) and interview Q3 named this failure.

**Hot-spot evidence is accurate as likelihood, incomplete as failure location** (expected under test-plan §1 principle #3):

- §2 cites `supabase/migrations` — that **is** where a destructive schema change would live.
- `src/lib/test/memory-supabase.ts` is **not** a migration runner. It seeds JS rows; it never executes SQL, RLS, or `auth.uid()`. Using it as the Risk #4 oracle would be tautological (the store cannot apply a `.sql` file).
- Application services (`src/lib/services/`) do not run migrations. Hosted apply is `context/deployment/deferred.md` (`DEP-*`), out of this change.

**Response-guidance verdict:**

- **Keep the challenge.** “`npx supabase db push` / migration listed in `schema_migrations`” is not “member rows survived.”
- **Keep the anti-pattern.** A `pg_dump --schema-only` snapshot (or “the CREATE TABLE text still matches”) is not the oracle. Distinctive **row payloads** must survive; owner **SELECT** policy (CI-cheap) / RLS `SELECT` as the owner (local Postgres) must remain.
- **Correct the cheapest layer.** The written hypothesis “integration against local DB + fixture rows” is the **high-fidelity** path, not the CI path. `.github/workflows/ci.yml` is `npm ci` → lint → `npm test` → build. No Docker, no `supabase start`. `vitest.config.ts` is Node + `src/**/*.test.ts` only. Default `npm test` **cannot** be “the only proof is Docker Postgres.”
- **Real Postgres is still needed for RLS owner-read**, behind an explicit env flag, against local Docker only. A SQL-parse harness cannot evaluate `auth.uid()`. Do **not** add pglite; the user constraint is `npx supabase` when real Postgres is used.
- **Do not `db reset` as the only path.** Reset reapplies *all* files then seed, wiping the developer’s local `public` data and never inserting the fixture *between* baseline and the new file. Throwaway database + stub `auth` + apply files in order + seed + apply newest.

**Cookbook §6.5 intent (to fill in the last Automated sub-phase):** When adding a dated migration, the suite must (1) seed distinctive member rows on the schema *before* that file, (2) apply the file, (3) assert those payloads still exist and owner-SELECT policy / RLS still exposes them to the owner. Canary destructive SQL must fail. `HF_MIGRATION_PG=1` runs the Docker path; default `npm test` runs the harness only. Not a schema dump. Not memory-supabase. Not hosted `db push`.

## Detailed Findings

### Risk #4 — A schema/migration destroys or rewrites existing member rows

#### Failure path

**User terms:** A shipped SQL file runs against a database that already has Member A’s plan/logs/profile; afterwards those rows are gone, rewritten (wrong owner / wiped km), or still stored but A can no longer read them.

**Code terms:** Files under `supabase/migrations/`, applied by the Supabase CLI in filename order. Product tables reference `auth.users (id) ON DELETE CASCADE` and gate reads with `auth.uid() = user_id` (except `agent_reports`, admin-only SELECT, and `project_settings`, authenticated singleton).

#### What is on disk (seven files, all expand)

Ordered by filename:

| File | What it adds | Touches existing member tables? |
|------|----------------|----------------------------------|
| `20260813104727_profiles_and_races.sql` | `profiles`, `races` + RLS select/insert/update/delete own | N/A (creates them) |
| `20260813130000_training_units.sql` | `training_units` + per-op own policies | No |
| `20260813160000_chat_gated_adaptation.sql` | `chat_messages`, `plan_propositions` + own policies | No |
| `20260814140000_plan_revisions.sql` | `plan_revisions` + select/insert/delete own | No |
| `20260815160000_workout_logs.sql` | `workout_logs` + per-op own policies | No |
| `20260817120000_admin_algorithm_feedback.sql` | `user_roles`, `agent_reports` + own/admin policies | No |
| `20260831194000_project_llm_settings.sql` | `project_settings` singleton + authenticated SELECT / admin write | No |

Statement classes present: `CREATE TABLE`, `CREATE INDEX` / `CREATE UNIQUE INDEX`, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`. No `DROP TABLE` / `DROP COLUMN` / `TRUNCATE` / `DELETE FROM` / `UPDATE` / `ALTER … TYPE` / `RENAME`.

Owner-readable member tables (SELECT policy `auth.uid() = user_id`): `profiles`, `races`, `training_units`, `chat_messages`, `plan_propositions`, `plan_revisions`, `workout_logs`, `user_roles`.

Not this risk’s oracle:

- `agent_reports` — members cannot SELECT their own reports (admin policy only). Survival of `source_user_id` rows is optional extra; owner-read does not apply.
- `project_settings` — not member-owned data (`id = 'default'`). Applying this file is the live “expand over existing members” example: it must leave `training_units` / `workout_logs` / `profiles` payloads untouched.

`REFERENCES auth.users` means a blank `createdb` cannot apply product SQL until `auth.users` (and `auth.uid()`) exist. Local `postgres` on port **54322** (`supabase/config.toml` `[db]`) already has Auth. Cloning/resetting **that** database is the wrong fixture story.

#### Existing tests

**None** execute or parse `supabase/migrations/*.sql`. Grep of `src/**/*.test.ts` has no migration runner.

Closest fixtures:

- `src/lib/test/memory-supabase.ts` — in-memory tables including `training_units`, `workout_logs`, `profiles`, `races`, `plan_revisions`, `plan_propositions`, `project_settings`. Filter-only isolation (Phase 1). **Cannot apply SQL.**
- `src/lib/services/ownership.test.ts` — distinctive A/B payloads (`distance_km: 42`, `structure: "member-a-monday"`). Reuse that **shape** as the migration fixture, not the memory client as the engine.
- Phase 2 plan explicitly deferred migrate-over-fixture to Phase 3 (`testing-generation-oracle-and-api-contracts/plan.md` What We're NOT Doing).

`supabase/seed.sql` is referenced in `config.toml` (`sql_paths = ["./seed.sql"]`) but **is not in the repo**. `db reset` would not load a product fixture even if we used it.

#### CI vs local Docker

`.github/workflows/ci.yml`: checkout, Node 22, `npm ci`, `astro sync`, lint, **`npm test`**, build with hosted secrets for compile. No Docker service, no `supabase start`. Phase 4 is CI wiring — **do not add a Docker job here**.

Local Docker is available to developers (`npx supabase start`). That path must be **opt-in** (`HF_MIGRATION_PG=1`) so default `npm test` stays green in CI.

#### Why a SQL-parse/fixture harness still has signal

A harness that (1) walks files in order, (2) after file `k-1` seeds distinctive rows into every **already created** owner-readable member table, (3) applies file `k` as classified statements, (4) asserts payloads equal the seed, (5) asserts each pre-existing member table still has `FOR SELECT` + `auth.uid() = user_id` in a remaining policy, catches:

- `DROP TABLE` / `TRUNCATE` / `DELETE FROM` of member tables
- `DROP COLUMN` of distinctive columns (`user_id`, `distance_km`, `date`, `structure`, `weekly_km`)
- `UPDATE` that rewrites those columns
- `DROP POLICY` (or replacing select-own so owner-read text disappears)

It does **not** catch Postgres-only coercion, `ON DELETE CASCADE` from a deleted `auth.users` row, or RLS that exists as text but is broken at runtime.

**Canary (required):** synthetic SQL (`DROP TABLE training_units`, unqualified `DELETE FROM training_units`, `DROP POLICY training_units_select_own`) must make the harness throw. Without canaries the live corpus (all expand) would keep the suite green forever — the tautology the challenge named.

#### Why real Postgres is still skippable, not skipped-as-design

“Remain readable by the owner” in product terms is RLS + `auth.uid()`, not a JS `.eq("user_id")`. Superuser on a throwaway DB **bypasses RLS** unless `FORCE ROW LEVEL SECURITY` and a non-owner role are used. The optional test must:

1. `CREATE DATABASE` with a unique name on `127.0.0.1:54322` (do not use the developer’s `postgres`/`public` as the guinea pig; do not `supabase db reset`).
2. Stub `auth.users` + `auth.uid()` reading `request.jwt.claim.sub` (the throwaway DB has no GoTrue).
3. `CREATE EXTENSION` as needed for `gen_random_uuid()`.
4. Apply files `1..n-1`, `INSERT` fixture as table owner, apply file `n` (today: `project_llm_settings.sql`).
5. `FORCE ROW LEVEL SECURITY` on member tables; `SET request.jwt.claim.sub` to Member A’s uuid; `SELECT` as a non-superuser role.
6. Oracle: distinctive payloads returned for A; not a `information_schema` dump.
7. `DROP DATABASE` in `after`.

Skip unless `HF_MIGRATION_PG=1`. Fail hard if the flag is set and Docker/Postgres is down — do not skip-on-connection-error (that hides misconfig).

Hosted `db push` stays DEP. Do not open a new DEP unless this change invents leftover hosted work (it should not).

### memory-supabase vs migrations

`createMemorySupabase` (`src/lib/test/memory-supabase.ts:275`) clones seed rows into a JS store. `MEMORY_TABLES` lists persist names used by services; it does not load `.sql`. A test that “migrates” by calling `createMemorySupabase` again would never see a `DROP TABLE` in a new file. **Out of scope as the Risk #4 engine.**

### Speculative-risk check

This is not “describe the implementation.” The failure (destructive SQL against existing members) can happen on the next slice without adding a new product safeguard first. Current files being additive does not prove the next file will be.

## Code References

- `supabase/migrations/20260813104727_profiles_and_races.sql:4-58` — first member tables + select-own RLS
- `supabase/migrations/20260813130000_training_units.sql:4-36` — calendar units + select-own
- `supabase/migrations/20260815160000_workout_logs.sql:4-35` — logs + select-own
- `supabase/migrations/20260831194000_project_llm_settings.sql:4-46` — latest expand (`project_settings`); must not touch member tables
- `src/lib/test/memory-supabase.ts:3-11` — JS persist tables; not a SQL runner
- `src/lib/services/ownership.test.ts:13-20` — distinctive A payload to copy as fixture shape
- `vitest.config.ts:4-5` — `environment: "node"`, `include: ["src/**/*.test.ts"]`
- `.github/workflows/ci.yml:19-22` — `npm test` only; no Docker
- `supabase/config.toml:27-36` — local DB port 54322, Postgres 17
- `context/deployment/deferred.md` — hosted apply is `DEP-*`, not this suite
- `context/foundation/test-plan.md` §2 Risk #4, §3 Phase 3, §6.5 TBD
- `AGENTS.md` — dated migrations + RLS + per-operation policies; no hosted secrets in client

## Architecture Insights

1. **Expand vs rewrite.** This repo’s convention is new `CREATE TABLE` files, not `ALTER` of old member tables. The dangerous future file is a rewrite (`DROP` + recreate, backfill `DELETE`, policy drop). The test must treat **the newest file** (and each incremental file after the first member tables exist) as the candidate applied *over* a seeded baseline.
2. **Two oracles, one risk.** (a) Payload survival (distinctive `user_id` + km/date/structure). (b) Owner-read (SELECT policy text in the harness; RLS `SELECT` as A in Postgres). Schema identity is neither.
3. **Canary vs corpus.** Corpus is currently all-expand and will pass a weak test. Canaries are the proof the oracle can go red.
4. **Throwaway DB, not reset.** `db reset` applies everything then optional seed — no gap to insert fixture rows. It also destroys local data. Unique `CREATE DATABASE` + stub `auth` is the local-Postgres pattern.
5. **Do not add CI Docker in this phase.** Phase 4 owns quality-gates wiring.
6. **Superuser bypass.** A Postgres test that `SELECT`s as `postgres` after `ENABLE ROW LEVEL SECURITY` does not prove owner-read. `FORCE ROW LEVEL SECURITY` + non-superuser is mandatory for that assertion.

## Historical Context (from prior changes)

- `context/changes/testing-generation-oracle-and-api-contracts/plan.md` — Phase 2 explicitly out-of-scoped real Supabase, RLS, and migrate-over-fixture to Phase 3.
- `context/changes/testing-generation-oracle-and-api-contracts/research.md` — memory store is the CI persist; RLS unproven.
- `context/changes/admin-llm-model-picker/plan.md` — latest SQL is local `db reset` / apply; hosted is DEP-016. Worker rollback does not undo SQL.
- Slice plans generally: new table + RLS + “Worker rollback does not undo this SQL” — same class of risk, never a migrate-over-fixture test.

## Related Research

- `context/changes/testing-generation-oracle-and-api-contracts/research.md` — Phase 2; defers this surface
- `context/changes/testing-critical-path-ownership-and-bounds/` — Phase 1 ownership; app-layer isolation, not SQL

## Open Questions

None that block planning. Locked by this research + the Phase 3 constraints:

- CI-cheap harness in default `npm test`; Postgres behind `HF_MIGRATION_PG=1`.
- No pglite, no hosted push, no `db reset` as the fixture story, no Playwright, no Phase 4 CI job.
- Oracle is distinctive member payloads + owner-read, not a schema dump.

## Test-plan §2 backport (cells only)

Research corrects **Likely cheapest layer** and **Context** for Risk #4. Source column and risk wording stay. No file:line in §2.

- **Context:** expand vs rewrite; destructive statements; seed/fixture of existing member rows; the memory persist cannot apply SQL; CI `npm test` has no Docker.
- **Likely cheapest layer:** CI-cheap SQL migrate-over-fixture harness in `npm test`; skippable local Postgres for RLS owner-read.
