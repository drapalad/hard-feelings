# Migration data safety — Plan Brief

> Full plan: `context/changes/testing-migration-data-safety/plan.md`
> Research: `context/changes/testing-migration-data-safety/research.md`

## What & Why

Rollout Phase 3 of `context/foundation/test-plan.md`: prove a new migration applied onto existing member rows does not destroy those rows and that the owner can still read them. “Migration applied” is not the oracle. Product SQL is currently all expand; Vitest never checks that.

## Starting Point

Seven additive files in `supabase/migrations/`. Latest `project_llm_settings` already applied locally/hosted (not a test). memory-supabase cannot run SQL. CI `npm test` has no Docker. Phase 2 deferred this surface.

## Desired End State

Default `npm test` fails on destructive SQL against a distinctive member fixture (with canaries so the all-expand corpus cannot green-wash). Opt-in local Postgres proves RLS owner-read. Cookbook §6.5 is the pattern. Phase 4 stays closed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Complexity | MEDIUM | Test-only, but SQL classification + throwaway RLS are easy to make tautological | Unattended |
| CI path | SQL migrate-over-fixture harness in default `npm test` | CI has no Docker; memory store cannot apply `.sql` | Research |
| Postgres | `HF_MIGRATION_PG=1` skippable throwaway DB on local 54322 | RLS `auth.uid()` needs real Postgres; `npx supabase` not pglite | Research + constraints |
| Reset | Never `db reset` as the fixture | Reset applies all files then seed — no gap to insert existing rows; wipes local data | Research |
| Oracle | Distinctive payloads + owner-read, not schema dump | Challenge: applied ≠ preserved | Research / test-plan §2 |
| Canaries | Synthetic DROP TABLE / DELETE / DROP POLICY must fail | Live corpus is all expand and would never go red | Research |
| Engine | Not memory-supabase | It cannot execute SQL or RLS | Research |
| Cookbook | Last phase; fill §6.5 / §6.6; Phase 3 complete; Phase 4 untouched | Test-plan required | Plan |

## Scope

**In scope:** harness + on-disk walk + canaries; skippable PG test + `pg` devDependency; cookbook §6.5.

**Out of scope:** Playwright; Phase 4 CI; hosted push; pglite; `db reset`; product SQL changes; schema-dump oracle.

## Architecture / Approach

Walk migrations in filename order; seed Member A (42 km / `member-a-monday`) on schema-before-candidate; apply candidate; assert payloads and select-own text. Same story on a throwaway DB when flagged, with `FORCE ROW LEVEL SECURITY`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. CI-cheap harness | File walk + canaries in `npm test` | Green-only because SQL is additive |
| 2. Skippable Postgres | RLS owner-read on throwaway DB | Superuser bypass; `db reset` |
| 3. Cookbook | §6.5 + Phase 3 complete | Next tests dump schema |

**Prerequisites:** research complete; Vitest include already `src/**/*.test.ts`.
**Estimated effort:** one session, three phases.

## Open Risks & Assumptions

- Current on-disk SQL should already pass the harness; if it fails, fix the parser, not the migrations.
- Optional PG path may be unverified in environments without Docker; Manual row 2.5 owns that check.
- `pg` as a devDependency is unused in default CI runs except install size.

## Success Criteria (Summary)

- Harness + canaries in default `npm test`.
- Postgres tests skip unless `HF_MIGRATION_PG=1`.
- §6.5 is migrate-over-fixture; §3 Phase 3 is `complete`.
