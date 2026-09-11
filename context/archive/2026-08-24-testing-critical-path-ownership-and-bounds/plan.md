# Critical-path ownership and bounds — Implementation Plan

## Overview

Close test-plan rollout Phase 1 (`context/foundation/test-plan.md` §3): CI-runnable Vitest integration tests for Risks #1, #2, and #6, then fill cookbook §6 with the patterns that actually shipped. Product code already enforces these gates; this change proves them at persist and handler boundaries. No Playwright, no real Supabase in `npm test`.

## Current State Analysis

The 14-file suite is all under `src/lib/`. Nothing calls `listWeek` / `replaceWeek` / `acceptProposition` with a client, and nothing imports a plan/chat/log handler. CI `npm test` has no `SUPABASE_URL` / `SUPABASE_KEY`. API modules transitively import `astro:env/server`, which standalone Vitest cannot resolve without a mock.

Ownership is session id into services plus RLS. Plan/log HTTP has no owner UUID; the resource key is `(user_id, date)`. B `GET`ing A's Monday as B is **200 with B's week**, not 403. Chat may **store** a hard pending row; only `acceptProposition` → `replaceWeek` writes `training_units`, after a live `acceptDecision` on current `weeklyKm` and frozen flags. Product JSON 401s in each handler; middleware 302s only `/dashboard` and `/admin`.

Existing `acceptDecision` / `gateAccept` / `validatePlan` / `unauthorized()` tests do not close these risks (research.md Summary and per-risk Existing tests).

## Desired End State

`npm test` (CI, no DB) fails if:

1. Member B's persist calls return or mutate Member A's `training_units` / `workout_logs`.
2. `acceptProposition` upserts `training_units` for a pending week whose constructed volume is above the live hard ceiling, or when live `weeklyKm` has dropped enough to make a previously-soft snapshot hard.
3. Any current plan/chat/log handler method returns member data (or anything other than 401 `UNAUTHORIZED` JSON) when `locals.user` is null.

Cookbook §6.2 and §6.4 describe those three proofs so a later agent adding a persist function or JSON route copies the right oracle. §3 Phase 1 is `complete`. AI-native judges stay unused (test-plan §4, checked 2026-08-18).

### Key Discoveries:

- Isolation lives in services + RLS, not handlers (`src/pages/api/plan.ts` passes `locals.user.id` into `listWeek` / `listLogs`). Research.md Risk #1.
- `acceptProposition` is the landing gate (`src/lib/services/chat.ts:177-221`); `insertPending` has no `hard.length` check. Research.md Risk #2.
- Middleware does not 401 APIs (`src/middleware.ts:6-31`). Research.md Risk #6.
- Persist access is fluent `.from().select().eq()…` — a chainable fake is required. A fake that pre-scopes to the `userId` argument is tautological (test-plan §2 anti-pattern).
- `editUnit` returns `NOT_FOUND` from the in-memory week **before** UPDATE (`src/lib/services/plan.ts:343-350`). B-with-empty-week `editUnit` does not exercise `.eq("user_id")`.
- F-01 forbids `astro:` imports in Vitest and forbids `getViteConfig()`. Handler tests unlock with one `vi.mock("astro:env/server")`. Hard ceiling is `weeklyKm * 1.2` (`src/lib/services/validate-plan.ts:9-12`).

## What We're NOT Doing

- Playwright, jsdom, or any browser login e2e (including Accept clicks).
- Real Supabase, two JWTs, Docker, or migrate-over-fixture (rollout Phase 3).
- Race UUID IDOR, `/api/profile`, `/api/races*`, `/api/admin*`, auth form routes.
- Asserting 401 on `/dashboard` or using public 200 on `/` as proof product APIs are gated.
- Putting `/api/*` on `PROTECTED_ROUTES`.
- Proving a hard pending row cannot be stored; treating `PUT /api/plan/units` landing hard as Risk #2 (FR-005).
- New `validatePlan` / `gateAccept` / `acceptDecision` cases as the landing proof; mocking `gateAccept` always-ok; oracles copied from `generatePlan` / `proposeAdaptation` / stub phrases.
- Consecutive-longs or freeze-drop as extra landing tests (F-01 already units them; volume is the constructed input).
- Inverse (weeklyKm **rises** so a hard snapshot becomes legal and lands).
- Thin handler test that B's `locals.user` plus a body `userId` is rejected (no such field; Risk #5 / rollout Phase 2).
- HTTP 409 mapping for Accept (service persist-skip is the oracle).
- Switching Vitest to Astro `getViteConfig()`, adding a model judge, or rewriting test-plan §1/§2.
- Changing product handlers/services unless a new test fails on current code — then stop and report; do not weaken the oracle.

## Implementation Approach

Cost × signal, then risk priority: stand up a shared memory query-builder; prove the cheapest independent gate (logged-out 401s); then two-user isolation (#1, High/High); then Accept persist-skip (#2, High/High, heavier fixture); then cookbook.

All new tests are Vitest `src/**/*.test.ts`, Node environment, `npm test`. Product remains the system under test; the fake is only the shared table. Tests should pass against current code.

## Critical Implementation Details

**Fake must leak without a user filter.** Isolation tests are worthless if `createMemorySupabase` hides other users' rows whenever a service passes `userId` in JS. Hide rows only when the chain invoked `.eq("user_id", …)`. The harness phase pins that with a direct builder call, not via `listWeek`.

**`editUnit` is a weak probe unless B has a row.** Give B their own unit on a shared date so UPDATE runs; use `setFrozen` / `deleteLog` on a date where **only A** has a row so a missing `.eq("user_id")` would mutate A's snapshot.

**Handler 401 is before `createClient`.** `vi.mock("astro:env/server")` must stub `SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL` because `src/pages/api/chat/messages.ts` imports OpenAI env at module top. Call exported `GET`/`POST`/… with `locals.user = null`. Cast the partial `APIContext` if Astro's type is too wide.

**Oracles.** #1: distinctive km/type + store snapshot, never 403. #2: `listWeek` deep-equals the pre-accept snapshot; pending status stays `pending` on hard. #6: 401 JSON `UNAUTHORIZED`, no `Location`, body is not units/logs/messages. Soft Accept **must** change units (negative control).

---

## Phase 1: Shared memory query-builder

### Overview

Add one in-memory Supabase query-builder that both ownership and accept tests import. Pin leak-without-filter so later phases cannot accidentally ship a tautological double.

**Behavior asserted:** A select on a two-user `training_units` table returns A's rows when `.eq("user_id")` is omitted, and does not return A's rows when `.eq("user_id", B)` is applied.

**Regression caught:** A helper that pre-filters by the JS `userId` argument (test-plan §2 anti-pattern: mock that always returns own rows).

**Research source:** research.md Risk #1 cheapest layer; Architecture Insights 3 and 7; Code References `plan.ts` `listWeek` / `replaceWeek`.

**Edge/error/boundary:** `maybeSingle` on 0 rows → `{ data: null, error: null }` (used by `setFrozen`, `loadPending`, `getProfile`). `delete`+`select` returning `[]` is `NOT_FOUND` for `deleteLog`.

**Anti-pattern avoided:** Happy-path owner-only fake; full supabase-js clone; real DB in CI.

### Changes Required:

#### 1. Memory client factory

**File**: `src/lib/test/memory-supabase.ts` (new)

**Intent**: Shared table store plus a chainable `from(table)` builder so persist functions run unchanged. Isolation is a property of recorded `.eq("user_id")`, not of who called the service.

**Contract**: Export `createMemorySupabase(seed)` returning a value services can use as `SupabaseClient`. Seed tables: `training_units`, `workout_logs`, `plan_propositions`, `profiles`, `plan_revisions`. Support the terminals those tables use in Phases 3–4: thenable `{ data, error }`, `.select`, `.eq`, `.in`, `.order`, `.maybeSingle`, `.insert`, `.update`, `.upsert` (conflict `user_id,date` / `user_id`), `.delete`, and `.select` after update/delete. Column lists may be ignored (return full row objects). Unknown tables: empty success so swallowed `plan_revisions` paths do not become `DB_ERROR`. Do not implement JWT/RLS.

```ts
// Harness invariant later tests rely on:
// from("training_units").select(...)                    → includes other users' rows
// from("training_units").select(...).eq("user_id", bId) → excludes them
```

#### 2. Harness characterization test

**File**: `src/lib/test/memory-supabase.test.ts` (new)

**Intent**: Prove the double is not tautological before any service test depends on it.

**Contract**: Seed A and B rows on the same date. Assert unfiltered select includes A's row; `.eq("user_id", B)` does not. Do not call `listWeek` here — that would hide a pre-scoped fake behind a service that always passes `userId`.

### Success Criteria:

#### Automated Verification:

- `src/lib/test/memory-supabase.ts` exports `createMemorySupabase` and seeds the five tables listed above
- Harness test proves unfiltered select returns the other member's rows and `.eq("user_id", B)` does not
- Builder implements the fluent terminals used by `listWeek`, `setFrozen`, `editUnit`, `listLogs`, `upsertLog`, `deleteLog`, `acceptProposition` (`loadPending` / `getProfile` / `replaceWeek` / `clearRevisions` / `setPropositionStatus`)
- `npm test` passes
- `npm run lint` passes

---

## Phase 2: Logged-out product API 401s (Risk #6)

### Overview

Prove every current plan/chat/log handler method returns 401 JSON and no member payload when `locals.user` is null. Cheapest independent signal; only needs the env mock, not the memory store.

**Behavior asserted:** Logged-out calls to gated plan/chat/log APIs return 401 `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no `Location`, body is not units/logs/messages.

**Regression caught:** A new method on an existing plan/chat/log module ships without `if (!locals.user) return unauthorized()`, so a logged-out caller gets empty 200 or member-shaped JSON.

**Research source:** research.md Risk #6 auth map and cheapest layer; `src/lib/api.ts:15-17`; handlers listed in research.md.

**Edge/error/boundary:** Auth runs before zod and `createClient` — invalid/missing body still 401. `/dashboard` is 302 (do not assert 401). `/` is public (do not use it as the gate proof).

**Anti-pattern avoided:** Full browser login e2e to prove a 401; asserting 401 on `/dashboard`; treating another `unauthorized()` unit test as closing #6; listing `/api/plan` on `PROTECTED_ROUTES`.

### Changes Required:

#### 1. Env mock + table-driven handler calls

**File**: `src/pages/api/product-gates.test.ts` (new)

**Intent**: Import each product handler module and call the exported methods with a null session so the proof is the handler, not the 401 helper.

**Contract**: `vi.mock("astro:env/server")` in this file only (do not add a global Vitest `setupFiles`). Table-drive all 12 methods:

| Module | Methods |
|--------|---------|
| `src/pages/api/plan.ts` | GET, POST |
| `src/pages/api/plan/units.ts` | PATCH, PUT |
| `src/pages/api/plan/undo.ts` | POST |
| `src/pages/api/plan/logs.ts` | POST, DELETE |
| `src/pages/api/chat.ts` | GET |
| `src/pages/api/chat/messages.ts` | POST |
| `src/pages/api/chat/accept.ts` | POST |
| `src/pages/api/chat/reject.ts` | POST |

Each row: `locals: { user: null, isAdmin: false }`, a `Request` / `URL` (query unused on the 401 path). Assert status 401, JSON error code `UNAUTHORIZED`, `Location` null, parsed body has no `units` / `logs` / `messages` / `plan` collections. Do not import `unauthorized` as the assertion target. Do not fetch `/dashboard` or `/`. Do not add JSON routes to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/product-gates.test.ts` table-drives all 12 plan*/chat* methods with `locals.user = null`
- Each case returns 401, JSON `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no Location header, and the body is not units/logs/messages
- Test file mocks `astro:env/server` once; does not import `unauthorized` as the proof; does not request `/dashboard` or `/`
- `npm test` passes
- `npm run lint` passes

---

## Phase 3: Two-user plan and log isolation (Risk #1)

### Overview

Using the shared store, prove B cannot read or mutate A's calendar units or workout logs. Session + DB-filter ownership; same dates, two owners.

**Behavior asserted:** B requesting A's calendar dates as B does not return A's distinctive units/logs and does not mutate A's stored rows. Empty or B-owned payload is success, not a leak.

**Regression caught:** Dropping `.eq("user_id", userId)` on select/update/delete/upsert so a shared-date query returns or writes A's rows (historically real on propositions: chat F3).

**Research source:** research.md Risk #1 failure path, service filters, "Denied is the wrong HTTP oracle"; test-plan §2 Risk #1 guidance (post-research wording).

**Edge/error/boundary:** Shared `(date)` with different owners; `setFrozen`/`deleteLog` where only A has a row; `editUnit`/`upsertLog` where B has their own row on that date. Do not treat service `NOT_FOUND` as "another member" unless A's snapshot is also unchanged.

**Anti-pattern avoided:** Owner-only happy path; mock that always returns own rows; asserting 403; stolen plan/log UUID (API has none).

### Changes Required:

#### 1. Ownership integration tests

**File**: `src/lib/services/ownership.test.ts` (new)

**Intent**: One fixture, two members, same Monday week, distinctive A's km/type and at least one of A's logs. Call persist functions as B; oracle is payload identity plus A's store snapshot.

**Contract**: Seed via `createMemorySupabase`. Reuse week `2026-08-10` (existing suite Monday). A and B both have units on the week; A's Monday km/type must be unmistakable vs B's. A has a `workout_logs` row. Then:

- `listWeek(client, B, monday)` / `listLogs(client, B, monday)` do not contain A's distinctive km/type.
- `setFrozen(client, B, dateOnlyA)` does not change A's `frozen` (missing `user_id` filter would).
- `editUnit(client, B, patchOnSharedDate)` may change B's row; A's type/km/frozen/structure on that date stay put.
- `upsertLog(client, B, listWeek(B), { date })` does not change A's log row (B may gain B's own log).
- `deleteLog(client, B, dateOnlyALog)` leaves A's log in the store.

Snapshot A's `training_units` and `workout_logs` before B's writes; deep-equal after. Do not assert 403/401. Do not add race IDOR. Do not go through HTTP.

### Success Criteria:

#### Automated Verification:

- Two users share the same week dates; A's units have distinctive km/type and A has at least one log
- `listWeek`/`listLogs` as B do not return A's distinctive km/types (empty or B's own week is success)
- `setFrozen`, `editUnit`, `upsertLog`, and `deleteLog` as B leave A's store snapshot unchanged
- Tests do not assert 403 or HTTP denial
- `npm test` passes
- `npm run lint` passes

---

## Phase 4: Accept persist-skip for hard bounds (Risk #2)

### Overview

Prove an out-of-bounds **pending** proposition cannot be accepted: `training_units` stay put. Storing pending is allowed and is how the fixture is built.

**Behavior asserted:** `acceptProposition` refuses a pending week with constructed `sum(distanceKm) > live weeklyKm * 1.2`; that user's `training_units` snapshot is unchanged; proposition status stays `pending`. A soft-band pending **does** land. If live `weeklyKm` drops between seed and accept so the same snapshot exceeds the new ceiling, accept also refuses and rows stay put.

**Regression caught:** Accept upserts before/without `if (!decision.ok)` (`src/lib/services/chat.ts:205-215`), or trusts stored `validation` instead of live `weeklyKm` / frozen flags.

**Research source:** research.md Risk #2 accept path, hard vs soft table, "What calendar unchanged means", cheapest layer; F-01 volume band; S-03 server re-check.

**Edge/error/boundary:** Hard vs soft band (`<= weeklyKm * 1.2` may land); live `weeklyKm` drop; pending remains `pending` on hard (not `accepted`). Frozen flags are re-read from current `listWeek` — do not mock them away. Do not require `sendMessage`.

**Anti-pattern avoided:** Validator internals as the proof; oracle copied from generate/proposer output; Playwright Accept (UI disables the button); treating stored pending as the bug; mocking `gateAccept` always-ok.

### Changes Required:

#### 1. Accept persist integration tests

**File**: `src/lib/services/accept-proposition.test.ts` (new)

**Intent**: Drive `acceptProposition` against seeded current week + profile + pending row. Construct distances from the F-01 ceiling formula; do not import generator/proposer output as expected km.

**Contract**: Use `createMemorySupabase`. Seed `profiles.weekly_km = W` (e.g. 50 → hard ceiling 60). Current `training_units` sum well under W. Insert `plan_propositions` with `status: "pending"` and `proposed_units` as camelCase `TrainingUnit[]` (that is the stored shape). Stored `validation` may be empty or wrong — accept must not trust it.

Cases:

1. **Hard volume:** `sum(proposed) > W * 1.2` → result `ok: false`, `error.code === "HARD_BOUNDS"`; `listWeek` equals the pre-call snapshot; proposition `status` still `"pending"`.
2. **Soft control:** `W < sum(proposed) ≤ W * 1.2` → `ok: true`; `listWeek` equals the proposed units (calendar **must** change).
3. **Live weeklyKm drop:** seed pending with a sum that is soft at W=50; set `profiles.weekly_km` to a lower W whose ceiling the sum exceeds; accept → `HARD_BOUNDS`; `training_units` unchanged.

Do not call `validatePlan` to build expected `message` strings. Do not mock `gateAccept` / `acceptDecision`. Do not use stub phrase `"make Friday 200 km"` as the only fixture. Do not hit `PUT /api/plan/units`. Do not import `src/pages/api/chat/accept.ts` (409 mapping is out of scope).

### Success Criteria:

#### Automated Verification:

- `acceptProposition` against a pending row with constructed `sum(distanceKm) > weeklyKm * 1.2` returns HARD_BOUNDS; that user's `training_units` snapshot is unchanged; proposition status stays pending
- Soft-band pending (`weeklyKm < sum ≤ weeklyKm * 1.2`) does change `training_units`
- Pending that is soft at a higher weeklyKm becomes HARD_BOUNDS after lowering live `profiles.weekly_km`, and `training_units` stay unchanged
- Fixture is not generate/proposer output; `gateAccept` is not mocked; `validatePlan` is not asserted as internals
- `npm test` passes
- `npm run lint` passes

---

## Phase 5: Cookbook patterns for Phase 1

### Overview

Write down how to add the next ownership, accept-landing, or gated-API test so later slices copy oracles instead of happy paths. This is the rollout's §6 fill-in, not a rewrite of strategy.

**Behavior asserted:** A contributor opening `context/foundation/test-plan.md` §6.2 / §6.4 gets location, mocking policy, reference tests, run command, and the three oracles (snapshot isolation, persist-skip, handler 401) without file:line product anchors in §1–§2.

**Regression caught:** Next agent adds an owner-only persist test, another `validatePlan` case labeled as Risk #2, or a Playwright login for 401 because §6 was still TBD.

**Research source:** test-plan.md §6 placeholders; `/10x-test-plan` constraint that the final sub-phase fills the cookbook; research.md Open Questions (no Playwright / no real DB for this phase).

**Edge/error/boundary:** §6 may grow; §1–§2 stay frozen except status. Cookbook names failure modes, not `src/lib/services/chat.ts:205`.

**Anti-pattern avoided:** File:line anchors in §2; filling §6.1 (unit oracle, rollout Phase 2), §6.3 (e2e, Phase 4), or §6.5 (migrations, Phase 3); duplicating the whole suite in the cookbook.

### Changes Required:

#### 1. Cookbook §6.2, §6.4, §6.6

**File**: `context/foundation/test-plan.md`

**Intent**: Replace Phase 1 TBD stubs with the patterns this change shipped. Mark rollout Phase 1 complete.

**Contract**:

- **§3 row 1** Status → `complete` (change folder path unchanged).
- **§6.2 Adding an integration test** — fill the schema fields (`Location`, `Mocking policy`, `Reference test`, `Run locally`) plus the two Phase 1 behaviors:
  - Two-user shared store: hide other members only when the query filters by owner; oracle is "not A's distinctive payload **and** A's rows unchanged"; 200/empty week is not a leak; do not assert 403.
  - Accept persist-skip: construct volume `> weeklyKm * 1.2`; call `acceptProposition`; calendar snapshot unchanged; storing pending is allowed; include a soft-band control that **does** land.
  - Location: colocated `src/**/*.test.ts`; helper `src/lib/test/memory-supabase.ts`; references `src/lib/services/ownership.test.ts` and `src/lib/services/accept-proposition.test.ts`.
  - Mocking policy: do not mock persist services; do not pre-scope the fake; no real Supabase in `npm test`.
- **§6.4 Adding a test for a new API endpoint** — handler-level Vitest, `vi.mock("astro:env/server")`, `locals.user = null`, 401 `UNAUTHORIZED` JSON, body is not member data. Do not put JSON routes on `PROTECTED_ROUTES`. `/dashboard` is 302 not 401. Logged-in-but-not-owner for plan/logs is §6.2 (no client owner id). Forged-owner body remains rollout Phase 2 (Risk #5). Reference: `src/pages/api/product-gates.test.ts`. E2e only if a later phase shows HTTP cannot see the failure — not for 401.
- **§6.6** — 2–3 lines: memory store is the CI-cheap persist; isolation proof is "filter omitted ⇒ leak"; Accept proof is persist-skip not validator units; JSON 401 is per-handler.
- Do **not** edit §1, §2 risk wording, or Response Guidance in this phase.
- Do **not** fill §6.1 / §6.3 / §6.5.

#### 2. Point AGENTS.md at the cookbook

**File**: `AGENTS.md`

**Intent**: Make §6 discoverable so a new endpoint test does not skip the cookbook.

**Contract**: In **Build, Test, and Development Commands**, add one sentence: before writing tests, read `context/foundation/test-plan.md` §6. Do not paste oracles into AGENTS.md.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.2 documents the two-user shared-store ownership pattern and the accept persist-skip pattern, with reference test paths
- §6.4 documents handler-level 401 table-drive for new plan/chat/log endpoints
- §6.6 notes Phase 1 lessons (200 is not a leak; pending store is allowed; 401 vs 302)
- §3 Phase 1 Status is `complete`
- `AGENTS.md` Build/Test section points at `context/foundation/test-plan.md` §6
- `npm test` passes

---

## Testing Strategy

This change **is** the integration suite. Do not add a second layer of tests for the tests.

### Unit Tests:

- No new product unit tests. Leave `validate-plan.test.ts`, `plan-adaptation.test.ts`, `chat.test.ts` (`acceptDecision`), and `api.test.ts` (`unauthorized` helper) as they are — they do not close Phase 1 risks.

### Integration Tests:

- Harness leak-without-filter (`memory-supabase.test.ts`).
- Handler 401 table (`product-gates.test.ts`).
- Two-user persist isolation (`ownership.test.ts`).
- Accept persist-skip + soft control + live `weeklyKm` drop (`accept-proposition.test.ts`).

## References

- Research: `context/changes/testing-critical-path-ownership-and-bounds/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 Risks #1/#2/#6, §3 Phase 1, §4 stack, §6 placeholders)
- F-01 Vitest lock + volume band: `context/changes/plan-gen-bounds-contract/plan.md`
- S-03 accept re-check, JSON APIs not `PROTECTED_ROUTES`: `context/changes/chat-gated-plan-adaptation/plan.md`
- Chat F3 id-only proposition update: `context/changes/chat-gated-plan-adaptation/reviews/impl-review.md`
- Progress format: `.cursor/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared memory query-builder

#### Automated

- [x] 1.1 `src/lib/test/memory-supabase.ts` exports `createMemorySupabase` and seeds the five tables listed above — 3292d49
- [x] 1.2 Harness test proves unfiltered select returns the other member's rows and `.eq("user_id", B)` does not — 3292d49
- [x] 1.3 Builder implements the fluent terminals used by `listWeek`, `setFrozen`, `editUnit`, `listLogs`, `upsertLog`, `deleteLog`, `acceptProposition` (`loadPending` / `getProfile` / `replaceWeek` / `clearRevisions` / `setPropositionStatus`) — 3292d49
- [x] 1.4 `npm test` passes — 3292d49
- [x] 1.5 `npm run lint` passes — 3292d49

### Phase 2: Logged-out product API 401s (Risk #6)

#### Automated

- [x] 2.1 `src/pages/api/product-gates.test.ts` table-drives all 12 plan*/chat* methods with `locals.user = null` — 712717e
- [x] 2.2 Each case returns 401, JSON `{ error: { code: "UNAUTHORIZED", message: "Sign in required" } }`, no Location header, and the body is not units/logs/messages — 712717e
- [x] 2.3 Test file mocks `astro:env/server` once; does not import `unauthorized` as the proof; does not request `/dashboard` or `/` — 712717e
- [x] 2.4 `npm test` passes — 712717e
- [x] 2.5 `npm run lint` passes — 712717e

### Phase 3: Two-user plan and log isolation (Risk #1)

#### Automated

- [x] 3.1 Two users share the same week dates; A's units have distinctive km/type and A has at least one log — 3aec9d0
- [x] 3.2 `listWeek`/`listLogs` as B do not return A's distinctive km/types (empty or B's own week is success) — 3aec9d0
- [x] 3.3 `setFrozen`, `editUnit`, `upsertLog`, and `deleteLog` as B leave A's store snapshot unchanged — 3aec9d0
- [x] 3.4 Tests do not assert 403 or HTTP denial — 3aec9d0
- [x] 3.5 `npm test` passes — 3aec9d0
- [x] 3.6 `npm run lint` passes — 3aec9d0

### Phase 4: Accept persist-skip for hard bounds (Risk #2)

#### Automated

- [x] 4.1 `acceptProposition` against a pending row with constructed `sum(distanceKm) > weeklyKm * 1.2` returns HARD_BOUNDS; that user's `training_units` snapshot is unchanged; proposition status stays pending — 335b495
- [x] 4.2 Soft-band pending (`weeklyKm < sum ≤ weeklyKm * 1.2`) does change `training_units` — 335b495
- [x] 4.3 Pending that is soft at a higher weeklyKm becomes HARD_BOUNDS after lowering live `profiles.weekly_km`, and `training_units` stay unchanged — 335b495
- [x] 4.4 Fixture is not generate/proposer output; `gateAccept` is not mocked; `validatePlan` is not asserted as internals — 335b495
- [x] 4.5 `npm test` passes — 335b495
- [x] 4.6 `npm run lint` passes — 335b495

### Phase 5: Cookbook patterns for Phase 1

#### Automated

- [x] 5.1 `context/foundation/test-plan.md` §6.2 documents the two-user shared-store ownership pattern and the accept persist-skip pattern, with reference test paths — f1b4694
- [x] 5.2 §6.4 documents handler-level 401 table-drive for new plan/chat/log endpoints — f1b4694
- [x] 5.3 §6.6 notes Phase 1 lessons (200 is not a leak; pending store is allowed; 401 vs 302) — f1b4694
- [x] 5.4 §3 Phase 1 Status is `complete` — f1b4694
- [x] 5.5 `AGENTS.md` Build/Test section points at `context/foundation/test-plan.md` §6 — f1b4694
- [x] 5.6 `npm test` passes — f1b4694
