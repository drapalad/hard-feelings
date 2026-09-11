# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-07 (M3L4: local Playwright seed + config; still not in CI)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `supabase/migrations`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Logged-in Member B can read or change Member A’s plan or workout logs | High | High | interview Q1, Q4; PRD Access Control + NFR isolation; hot-spot dirs `src/lib/services`, `supabase/migrations` (API folder churn was misleading) |
| 2 | A chat/LLM calendar change lands even though it violates hard algorithmic bounds | High | High | PRD FR-008 / NFR hard-bounds; roadmap north star S-03; hot-spot dir `src/lib/services` (accept/persist path; proposer/LLM is not the landing gate) |
| 3 | Generate reports success, but the week is not executable against declared weekly km | High | Medium | interview Q1; PRD guardrail + primary success criterion; hot-spot dir `src/lib/services` |
| 4 | A schema/migration (or similar DB change) destroys or rewrites existing member rows | High | Medium | interview Q3; new SQL per shipped slice; scope `supabase/migrations` |
| 5 | Server persists a plan/log mutation from untrusted client input (forged owner, extra fields, invalid body) | Medium | High | AGENTS.md: API handlers must validate input; abuse lens (untrusted input); hot-spot dir `src/pages/api` |
| 6 | Unauthenticated caller reaches gated plan, chat, or log routes | High | Medium | PRD no-guest access control; AGENTS.md protected-route rule; hot-spot dir `src/pages/api` (JSON product routes; middleware page redirects are not the API gate) |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | B requesting A’s calendar dates as B does not return A’s units/logs and does not mutate A’s rows (HTTP 200 with B’s own week is not a leak) | “Logged in” equals “authorized”; GET 200 means a leak; “denied” means 403 | How ownership is enforced (session vs body vs DB policy); two-member fixture; resource key is (owner, date), not a client plan/log id | Integration (two users, shared store that only hides A’s rows when the query filters by owner; real DB optional later) | Happy-path owner-only tests; mock that always returns “own rows”; asserting 403 |
| #2 | Out-of-bounds chat mutations do not land on the training calendar (`training_units` unchanged). Pending profile/freeze Accept is a different path. | Happy-path send implies the gate works; an LLM reply implies a safe write; UI hiding Accept implies the NFR | `sendMessage` persist path; `acceptDecision` / `gateAccept` / `gateByIsoWeek`; hard-bound vs soft warning; live weekly km and frozen flags; `acceptProposition` is profile/freeze only | Integration around send persist-skip via `acceptDecision` (not another validator unit test) | Assert validator internals; oracle copied from generate/proposer output; Playwright click on a disabled control |
| #3 | After generate, total week volume is coherent with declared weekly km (independent oracle) | HTTP 200 + some calendar rows means executable | Executable means: with ≥1 fill day and frozen km ≤ target, roundKm(week total) equals roundKm(profile weeklyKm); persisted rows must match; frozen already over target may succeed with a soft warning | Unit/integration with a volume oracle from the profile, not from generator output | Snapshot of generated units as expected km |
| #4 | Apply the new migration onto a DB that already has member rows; those rows still exist and remain readable by the owner | “Migration applied” means data preserved | Expand vs rewrite; destructive statements; seed/fixture of existing member rows; memory persist cannot apply SQL; CI `npm test` has no Docker | CI-cheap SQL migrate-over-fixture harness in `npm test`; skippable local Postgres for RLS owner-read | Schema dump snapshot as the oracle |
| #5 | Invalid or forged mutation is rejected; persisted row does not take a client-supplied owner | Client-side schema equals server contract | Owner is session id (Zod strips unknown keys including userId); log type comes from the planned unit; client has TypeScript payload types only | API/contract tests | Mirror the handler’s parse in the test |
| #6 | Logged-out request to gated plan/chat/log APIs returns 401 JSON and no member data (`/dashboard` is 302, not 401) | Public 200 on `/` implies product routes are public; middleware page list is the API gate | Cookie/session vs middleware vs handler auth; JSON APIs must not use HTML redirects | Integration (no cookie / null user) at the handler | Full browser login e2e to prove a 401; asserting 401 on `/dashboard` |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path ownership and bounds | Prove B cannot touch A’s data, and out-of-bounds chat cannot land | #1, #2, #6 | integration | complete | context/changes/testing-critical-path-ownership-and-bounds |
| 2 | Generation oracle and API contracts | Prove generate honors declared weekly km; server rejects forged/invalid mutations | #3, #5 | unit + integration/contract | complete | context/changes/testing-generation-oracle-and-api-contracts |
| 3 | Migration data safety | Prove schema changes do not destroy existing member rows | #4 | integration (migrate-over-fixture) | complete | context/changes/testing-migration-data-safety |
| 4 | Quality-gates wiring | Fail CI if Phase 1–3 suites fail; add browser only if research shows HTTP tests miss a real accept-in-UI failure | cross-cutting | CI gates; Playwright only if still needed | complete | context/changes/testing-quality-gates-wiring |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

Test-base profile: **sparse** — Vitest configured, 14 test files clustered in `src/lib/`; pages, API routes, and components are bare. Include pattern is `src/**/*.test.ts` (Node environment). Standalone `vitest/config` is an AGENTS.md lock — do not switch to Astro `getViteConfig()` in this rollout.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 4.1.10 | `npm test` / `npm run test:watch`; already in CI |
| API mocking | none yet | — | Prefer real persist + two users for #1; mock only the network edge if research requires it |
| e2e | Playwright | 1.62 | Local `npm run test:e2e`; seed `tests/e2e/seed.spec.ts`. **Not in CI.** |
| accessibility | none yet | — | Not in this rollout unless a listed risk needs it |
| AI-native | none — not used | n/a | Classic validator/IDOR tests are cheaper than a model judge on chat |

**Stack grounding tools (current session):**
- Docs: none (no Context7 / framework docs MCP) — not available in current session; checked: 2026-08-18
- Search: WebSearch — Astro testing guide (Vitest, Playwright `webServer` + preview); Cloudflare adapter skips workerd under Vitest (Node unit tests are the intended Vitest path); checked: 2026-08-18
- Runtime/browser: cursor-ide-browser — ad-hoc verification only, not a suite runner; checked: 2026-08-18
- Provider/platform: none — not available in current session; checked: 2026-08-18

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase \<N\>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint | local + CI | required | syntactic / lint drift |
| lint after agent edit of `*.{ts,tsx,astro}` | Cursor `afterFileEdit` (`.cursor/hooks/lint.sh`) | local (not CI) | lint drift in the agent loop; `--fix` on the edited file |
| related tests on staged `src/**/*.{ts,tsx}` | pre-commit (lint-staged) | required | regressions in tests that import the files being committed |
| related tests after agent edit of `src/lib/services` / `src/pages/api` | Cursor `afterFileEdit` | local (not CI) | same signal, in the agent loop, scoped to risks #1 / #2 / #6 |
| typecheck | pre-commit (`npx astro check`) | local (not CI) | type errors before commit; kept off `afterFileEdit` because whole-project check is too slow per edit |
| unit + integration | local + CI (`npm test`) | required | logic, ownership, bounds, volume oracle, migration safety, quality-gates floor |
| production build | CI | required | adapter/SSR build breakage |
| CI includes Phase 1–3 tests | CI on PR (`npm test` + `src/lib/test/quality-gates.test.ts`) | required | silent omission of named Phase 1–3 files, include drift, dropping `npm test`, or adding Playwright / `HF_MIGRATION_PG` to CI |
| e2e on accept-in-UI (Playwright) | — | not required (Phase 4 research: HTTP sees the persist-skip) | UI accept path that HTTP tests cannot see. Local Playwright suite exists for other UI risks; do not add a disabled-control click as a substitute for `sendMessage` / `acceptDecision` persist-skip tests |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase \<N\>."

### 6.1 Adding a unit test

Location: colocated `src/**/*.test.ts`. Node environment. Run locally:
`npm test`.

**Declared weekly-km oracle (Risk #3).** After `generatePlan` (or
persisted `POST /api/plan` rows) reports success with at least one
empty day and in-week frozen km ≤ the profile target, assert
`roundKm(sum of distanceKm) === roundKm(declared weeklyKm)` using
`roundKm` from `@/lib/km`. Include a remainder target (e.g. 40.5) so
last-day fill is exercised. Do **not** snapshot generated per-day km
as expected values. Empty `validation.soft` is not the oracle —
under-target is silent in `validatePlan`. HTTP 200 + seven calendar
rows is not executable. Frozen already in the 100–120% band may
succeed with leftover 0 km days and a soft warning.

Reference tests: `src/lib/services/generate-plan.test.ts` (unit);
`src/pages/api/plan-contracts.test.ts` (persisted rows after generate).

### 6.2 Adding an integration test

Location: colocated `src/**/*.test.ts`. Shared persist helper:
`src/lib/test/memory-supabase.ts`.

Mocking policy: do not mock persist services. Do not pre-scope the
memory client to the `userId` argument — hide other members' rows only
when the query chain calls `.eq("user_id", …)`. No real Supabase in
`npm test`.

Reference test: `src/lib/services/ownership.test.ts` (two-user plan/log
isolation); `src/lib/services/chat.test.ts` (`sendMessage` persist-skip);
`src/lib/services/plan-adaptation.test.ts` (`gateAccept`);
`src/lib/services/accept-proposition.test.ts` (profile/freeze Accept, not
calendar).

Run locally: `npm test`.

**Two-user shared store (Risk #1).** Seed both members on the same
calendar dates. The oracle is "not A's distinctive payload **and** A's
stored rows unchanged." Empty or B-owned week is success, not a leak;
do not assert 403. A helper that always returns the caller's own rows
is tautological.

**Calendar persist-skip (Risk #2).** The landing gate is `acceptDecision`
(via `gateAccept` / `gateByIsoWeek`), called from `sendMessage` before
`persistProposedUnits`. Construct proposed volume
`sum(distanceKm) > weeklyKm * 1.2`. Drive `sendMessage` (or call
`acceptDecision` for the in-memory gate). The calendar snapshot must stay
put. Include a soft-band control (`weeklyKm < sum ≤ weeklyKm * 1.2`) that
**does** land. `acceptProposition` accepts pending profile/freeze rows
only; it is not the calendar write path.

### 6.3 Adding an e2e test

Local Playwright lives under `tests/e2e/`. Model every new spec on
`tests/e2e/seed.spec.ts`. Drive generation with `/10x-e2e` (PLAN →
GENERATE → REVIEW → VERIFY). Rules: `.cursor/rules/e2e.mdc`.

Auth: `tests/e2e/auth.setup.ts` writes `playwright/.auth/user.json`.
Optional `E2E_EMAIL` / `E2E_PASSWORD`; if unset, setup signs up a
fresh local member. Specs use `storageState` — do not log in through
the UI in the test body.

Run one spec: `npx playwright test tests/e2e/<file>.spec.ts`. Full
local suite: `npm run test:e2e`. Chromium only.

The listed risk (out-of-bounds calendar rows **landing**) stays on
`acceptDecision` / `gateAccept`, proven by `src/lib/services/chat.test.ts`
(`sendMessage` persist-skip) and `src/lib/services/plan-adaptation.test.ts`.
A Playwright click on a disabled Accept control never reaches persist
and would mask a skipped server re-check. Do **not** add that click as
E2E coverage for risk #2. `acceptProposition` is profile/freeze Accept,
not the calendar gate.

Do not add Playwright to `.github/workflows/ci.yml`. The quality-gates
floor (`src/lib/test/quality-gates.test.ts`) locks `npm test` as Vitest
without a Playwright job.

Reference: `tests/e2e/seed.spec.ts`.

### 6.4 Adding a test for a new API endpoint

For a new plan/chat/log JSON method: handler-level Vitest with
`vi.mock("astro:env/server")` in that test file (not a global
setupFile). Call the exported method with `locals.user = null`. Assert
401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`,
no `Location`, body is not units/logs/messages.

Do not add JSON routes to `PROTECTED_ROUTES`. `/dashboard` is 302, not
401 — do not use it as the API gate proof. Logged-in-but-not-owner for
plan/logs is §6.2 (the API has no client owner id).

**Invalid / forged mutation (Risk #5).** Logged-in handler test:
`vi.mock("astro:env/server")` and `vi.mock("@/lib/supabase")`
`createClient` returning `createMemorySupabase` (do not mock persist
services). Send literal JSON — do not `safeParse` `unitEditSchema` /
`workoutLogWriteSchema` in the test. Negative km or unknown type → 400
`VALIDATION_ERROR` and the store snapshot unchanged. Extra `userId` /
`user_id` on a valid body → 200; persisted `user_id` is
`locals.user.id`; another member's rows stay put. Extra `type` on a
log POST is stripped; stored type comes from the planned unit. Extra
keys are stripped, not 400.

Reference tests: `src/pages/api/product-gates.test.ts` (401);
`src/pages/api/plan-contracts.test.ts` (generate persist + forged /
invalid plan-log bodies). Do not add Playwright for 401 or contracts.
See §6.3 — Accept landing stays on Vitest; other UI risks may use local E2E.

### 6.5 Adding a test for a schema/migration change

When you add a dated file under `supabase/migrations/`, prove it
does not destroy existing member rows. The oracle is distinctive
payloads (Member A `user_id`, `weekly_km` / `distance_km` 42,
`structure: "member-a-monday"`, date `2026-08-10`) still present
and still owner-readable — not “migration applied,” not a schema
dump, not `information_schema`.

**Default `npm test` (CI):** the harness in
`src/lib/test/migration-safety.test.ts` walks files in filename
order. After each file following the first it seeds those payloads
on the schema-before-the-file, applies the candidate, and asserts
the seed still matches and `FOR SELECT` / `auth.uid() = user_id`
policy text remains. Canaries (`DROP TABLE training_units`,
unqualified `DELETE FROM training_units`, `DROP POLICY
training_units_select_own`) must fail the harness — today’s
all-expand corpus is not enough. Do not use `createMemorySupabase`
as the engine (it cannot execute SQL).

**Local Docker (skippable):** `HF_MIGRATION_PG=1 npm test --
src/lib/test/migration-pg.test.ts` against `npx supabase start`
(port 54322). It creates and drops a throwaway database
(`TEMPLATE template0`); it does **not** `db reset` and must not
use a hosted URL. Owner `SELECT` as a non-superuser LOGIN role
with `request.jwt.claim.sub` = Member A is the RLS proof. Default
CI does not set the flag (the file is skipped).

Do not run hosted `db push` from this pattern. Hosted apply stays
`DEP-*`.

Reference tests: `src/lib/test/migration-safety.test.ts`;
`src/lib/test/migration-pg.test.ts` (opt-in).

### 6.6 Per-rollout-phase notes

Phase 1: the memory store is the CI-cheap persist; isolation proof is
"filter omitted ⇒ leak" (HTTP 200 / empty week is not a leak). Accept
proof is persist-skip, not validator units; storing pending is allowed.
JSON 401 is per-handler; `/dashboard` is 302.

Phase 2: generate volume is `roundKm(sum) === roundKm(weeklyKm)`, not
per-day snapshots and not HTTP 200 + row count. Extra JSON keys are
stripped, not 400; owner is the session id.

Phase 3: applied ≠ preserved. Default `npm test` is the SQL
migrate-over-fixture harness plus canaries. `HF_MIGRATION_PG=1` is
skippable local Docker for RLS owner-read; not `db reset`, not a
schema dump.

Phase 4: the existing `ci` job’s `npm test` is the floor. Named
Phase 1–3 files + include + YAML shape are locked by
`src/lib/test/quality-gates.test.ts`. Playwright is local-only
(`tests/e2e/`, not in CI). HTTP still sees the accept failure — do
not replace that with an Accept-button click. Do not set
`HF_MIGRATION_PG` in CI.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **None from interview Q5** — the question was skipped. Do not invent exclusions (including Admin UI).
- **External workout-tracking sync (PRD FR-010, parked)** — not in the primary path. Re-evaluate if that slice is un-parked.
- **Full LLM-written planner (PRD Non-Goals)** — chat proposes; algorithms generate and bound. Test the gate (Risk #2), not a planner that must not exist.
- **Visual snapshots of calendar layout** — not a listed risk; high churn, low signal.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-08-18
- Stack versions last verified: 2026-08-18
- AI-native tool references last verified: 2026-08-18

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
