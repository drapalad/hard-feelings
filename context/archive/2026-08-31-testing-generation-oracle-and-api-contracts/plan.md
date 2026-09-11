# Generation oracle and API contracts Implementation Plan

## Overview

Close test-plan rollout Phase 2 (`context/foundation/test-plan.md` §3): prove a successful generate is executable against declared weekly km using an independent 1-decimal oracle, and prove plan/log JSON mutations reject invalid bodies and do not persist a client-supplied owner. No Playwright, no product-behavior changes unless a new test fails on current code (then stop and report).

## Current State Analysis

FU-015 already rounds fill-split km and `validatePlan` volume compare via `roundKm`. `generate-plan.test.ts` asserts a 50 km week sums to 50 and has empty hard/soft, but hardcodes 50 without `roundKm`, does not cover remainder weekly km (40.5), and does not inspect persist. `plan-revisions.test.ts` `generateAndPersist` proves snapshot/undo, not volume. `validatePlan` emptiness is **not** an executable-week oracle: under-target is silent.

Plan/log handlers `safeParse` Zod object schemas then persist `user_id` from `locals.user.id`. Unknown keys are **stripped**, not rejected. Schema unit tests exist (`unitEditSchema`, `workoutLogWriteSchema`); no logged-in handler test sends a hostile body. Phase 1 `product-gates.test.ts` only covers `locals.user = null`. Client `UnitEditPayload` is TypeScript-only.

Logged-in handler tests must mock `@/lib/supabase` `createClient` to return memory-supabase. Do not mock persist services. Do not pre-scope the memory client to `userId`.

## Desired End State

`npm test` fails if:

1. `generatePlan` (or `POST /api/plan` persist) reports success with ≥1 fill day and frozen km ≤ target but `roundKm(sum of distances)` ≠ `roundKm(declared weeklyKm)`.
2. Invalid unit/log JSON is persisted, or a valid mutation with extra `userId`/`user_id` writes a row owned by that id (or changes another member’s rows).
3. A log POST with extra `type` stores that type instead of the planned unit’s type.

Cookbook §6.1 documents the weekly-km oracle. §6.4 documents forged-owner / invalid-body contracts. §3 Phase 2 is `complete`. AI-native judges stay unused.

### Key Discoveries:

- Fill split + last-day remainder in `generate-plan.ts`; persist in `generateAndPersist` → `replaceWeek` (`plan.ts`). Research.md Risk #3.
- `validatePlan` under-target is not a miss — the oracle is sum vs profile weeklyKm, not empty `validation.soft`. Research.md Risk #3.
- Owner is never a body field; Zod strips extras. Research.md Risk #5.
- Handler 401 returns before `createClient`; logged-in tests need a factory mock. Research.md Architecture Insights 4.
- Phase 1 deferred forged-owner HTTP to this phase (`testing-critical-path-ownership-and-bounds` plan What We're NOT Doing).

## What We're NOT Doing

- Playwright, jsdom, browser generate/edit flows.
- Real Supabase, RLS, migrate-over-fixture (Phase 3), CI job wiring (Phase 4).
- Changing `roundKm`, fill-split, `.strict()` on Zod schemas, or handler parse unless a new test fails — then stop; do not weaken the oracle.
- Snapshotting generated per-day km/types as expected volume.
- Using `validatePlan` / empty `validation.soft` as the generate volume oracle.
- Importing `unitEditSchema` / `workoutLogWriteSchema` in contract tests to classify payloads.
- Mocking `generateAndPersist`, `editUnit`, `upsertLog`, or pre-scoping memory-supabase to `userId`.
- `/api/profile`, `/api/races*`, `/api/admin*`, chat accept/reject as this phase’s mutation surface.
- Treating extra JSON keys as 400 (product strips them).
- Opening Phase 3/4 or rewriting test-plan §1. §2 cells already backported from research.

## Implementation Approach

Cost × signal: unit generate oracle first (no HTTP), then one handler file that reuses Phase 1 mock style plus `createClient` → memory store for persist volume and mutation contracts, then cookbook.

Complexity: **LOW**. Test-only; harness and handler-call pattern already exist.

## Critical Implementation Details

**Oracle (do not copy fill-split).** With ≥1 empty day in the week and in-week frozen km ≤ declared weeklyKm: `roundKm(units.reduce((s,u) => s + u.distanceKm, 0)) === roundKm(weeklyKm)`. Use `roundKm` from `@/lib/km` so `50.00000000000001` is not a fail. Include weeklyKm **40.5** so last-day remainder is exercised without asserting per-day values.

**HTTP 200 is not enough.** Handler generate must read **stored** `training_units` (unfiltered select, then filter in the assertion by session `user_id`) and apply the same oracle. `plan.units.length === 7` is not the proof.

**Logged-in `createClient` mock.** `vi.hoisted` holder `{ client }` assigned per test from `createMemorySupabase(...)`. `vi.mock("@/lib/supabase")` returns that client. Also `vi.mock("astro:env/server")` like `product-gates.test.ts`. Persist functions stay real. Context `locals` is `{ user: { id: sessionId }, isAdmin: false }` (handlers only read `.id`).

**Pin `weekStart`.** Every generate/edit/log request uses a fixture Monday (`2026-08-10`), never omitted body/`utcToday()`. Omitting `weekStart` would make the suite date-dependent.

**Forged owner.** Seed session user **and** another member on the store. Extra `userId`/`user_id` on PUT/POST must not create or alter the other member’s rows. Assert stored `user_id` equals `locals.user.id`.

**Invalid body.** 400 `{ error: { code: "VALIDATION_ERROR", ... } }` before persist; snapshot the relevant table first.

---

## Phase 1: Weekly-km generate oracle (Risk #3 unit)

### Overview

Lock the independent volume oracle on `generatePlan` for even and remainder weekly km, plus an under-target frozen fill. Do not snapshot per-day fill distances.

**Behavior asserted:** After `ok: true` with ≥1 empty day and frozen km ≤ target, rounded week total equals rounded declared weeklyKm.

**Regression caught:** Fill-split or last-day remainder that undershoots/overshoots the profile target while still returning `ok: true` and empty `validation.hard`.

**Research source:** research.md Risk #3 cheapest layer item 1; FU-015 remainder note.

**Edge/error/boundary:** weeklyKm 50 (IEEE dust if rounding regresses) and 40.5 (last day remainder). One frozen in-week unit under target; remaining days fill so total still hits weeklyKm. Do not fail the existing soft-band frozen-over-target case.

**Anti-pattern avoided:** Expected km copied from `generatePlan` per-day output; `validation.soft === []` as the oracle.

### Changes Required:

#### 1. Generate unit tests

**File**: `src/lib/services/generate-plan.test.ts`

**Intent**: Replace the hardcoded `sum === 50` success assertion with a shared oracle using `roundKm`, and add 40.5 plus frozen-under-target fill.

**Contract**: Import `roundKm` from `@/lib/km`. Helper takes units + declared weeklyKm; asserts `roundKm(sum) === roundKm(weeklyKm)`. Existing 7-date / empty-hard checks may stay. Do not `toEqual` a full units array of expected distances. Keep existing input-error and unsatisfiable-frozen tests.

### Success Criteria:

#### Automated Verification:

- `generate-plan.test.ts` asserts `roundKm(sum of distanceKm) === roundKm(weeklyKm)` for weeklyKm 50 and 40.5 with no frozen units
- That file does not use generated per-day distances as expected km
- One in-week frozen unit under target with remaining empty days still satisfies the same sum oracle
- `npm test` passes
- `npm run lint` passes

---

## Phase 2: Handler generate persist and mutation contracts (Risks #3, #5)

### Overview

Handler-level Vitest: successful `POST /api/plan` persists a week that passes the same oracle; invalid unit/log bodies 400 without persist; extra owner/type fields do not become stored owner/type.

**Behavior asserted:** 200 generate ⇒ stored sum matches profile weeklyKm. Invalid mutation ⇒ 400 and store unchanged. Forged `userId` ⇒ session-owned row only.

**Regression caught:** Handler returns 200 with empty/wrong-km rows; persist copies body `user_id`; invalid JSON still upserts.

**Research source:** research.md Risk #3 item 2; Risk #5 matrix.

**Edge/error/boundary:** Seed A-priority race + profile or generate 400s `NO_A_RACE` / `MISSING_WEEKLY_KM`. PUT edit needs an existing unit on that date (`editUnit` NOT_FOUND otherwise). Log POST needs a planned unit on that date. Extra keys must **succeed** (strip), not 400.

**Anti-pattern avoided:** Mirroring handler `safeParse`; mocking persist services; asserting 403; treating extra keys as validation errors.

### Changes Required:

#### 1. Handler contract tests

**File**: `src/pages/api/plan-contracts.test.ts` (new)

**Intent**: One file, Phase 1 mock style, memory store as the fake DB, exported `POST`/`PUT` handlers as the system under test.

**Contract**: Mock `astro:env/server` (`SUPABASE_URL`, `SUPABASE_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`) and `@/lib/supabase` `createClient` via a hoisted client holder. Build a minimal `APIContext` with `locals: { user: { id: sessionId }, isAdmin: false }` (cast as Phase 1). JSON bodies are literals and include `weekStart`/`date` on fixture Monday `2026-08-10`. Do not import `unitEditSchema` or `workoutLogWriteSchema`. Do not mock `generateAndPersist` / `editUnit` / `upsertLog`. Memory seed includes another member’s rows so a leaked owner would be visible. Reuse `roundKm` oracle on stored `distance_km` for generate. Invalid cases: negative `distanceKm`, unknown workout `type`. Forged cases: extra `userId` and `user_id` on PUT units; extra `userId` and `type` on POST logs.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/plan-contracts.test.ts` mocks `astro:env/server` and `@/lib/supabase` `createClient` to the test’s memory client and does not mock persist services
- `POST /api/plan` as a logged-in user with seeded weeklyKm + A race returns 200 and stored `training_units` for that user pass the roundKm sum oracle (not merely row count)
- `PUT /api/plan/units` with negative km or unknown type returns 400 `VALIDATION_ERROR` and does not change stored units
- `PUT /api/plan/units` with a valid edit plus extra `userId`/`user_id` of another member returns 200; persisted `user_id` is the session user; the other member’s rows are unchanged
- `POST /api/plan/logs` with extra `userId` and `type` persists `user_id` as the session user and `type` from the planned unit
- `POST /api/plan/logs` with negative `distanceKm` returns 400 and inserts no log
- The test file does not import `unitEditSchema` or `workoutLogWriteSchema` to classify payloads
- `npm test` passes
- `npm run lint` passes

---

## Phase 3: Cookbook §6.1 / §6.4 and Phase 2 complete

### Overview

Write the patterns this phase shipped into the test-plan cookbook so the next author copies the oracle and contract, not happy-path snapshots. Mark rollout Phase 2 complete. Do not open Phase 3.

**Behavior asserted:** A later agent adding a generate or plan/log test can follow §6.1 / §6.4 without re-deriving the oracles.

**Regression caught:** Next tests snapshot generated units or import the handler schema as the contract.

**Research source:** test-plan §6 placeholders; research.md response-guidance verdict.

**Anti-pattern avoided:** File:line anchors in test-plan §2; filling §6.3/§6.5 (Phase 4 / Phase 3).

### Changes Required:

#### 1. Cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.1 TBD with the weekly-km oracle pattern. Extend §6.4 with Risk #5 notes (invalid body, forged owner strip, no schema import). Add a Phase 2 line under §6.6. Set §3 Phase 2 Status to `complete`. Update the Last-updated blurb.

**Contract**: §6.1 names `roundKm(sum) === roundKm(weeklyKm)`, remainder weeklyKm, persist-the-same-oracle, reference `generate-plan.test.ts` and `plan-contracts.test.ts`. §6.4 keeps the 401 pattern and adds: send literal JSON; extra `userId` is ignored and owner is session; 400 VALIDATION_ERROR leaves store unchanged; do not `safeParse` the handler schema in the test. No file:line in §1/§2.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.1 documents the declared-weekly-km oracle (independent of generator per-day output) with reference test paths
- §6.4 documents forged-owner / invalid plan-log body contracts (strip extras; session owner; 400 does not persist)
- §6.6 notes Phase 2 (200 + rows is not executable; extra keys are stripped not 400)
- §3 Phase 2 Status is `complete`
- `npm test` passes
- `npm run lint` passes

---

## Testing Strategy

This change **is** the unit + contract suite.

### Unit Tests:

- Volume oracle on `generatePlan` (Phase 1). Leave `validate-plan.test.ts` `roundKm` dust cases as they are.

### Integration Tests:

- Handler generate persist + mutation contracts against memory-supabase (Phase 2).

### Manual Testing Steps:

Omit — no running UI to observe.

## Performance Considerations

None. Vitest Node, in-memory store, no network.

## Migration Notes

Not applicable. No schema or product API change.

## References

- Research: `context/changes/testing-generation-oracle-and-api-contracts/research.md`
- Test plan: `context/foundation/test-plan.md` (§2 Risks #3/#5, §3 Phase 2, §6.1 TBD, §6.4)
- Phase 1 patterns: `src/pages/api/product-gates.test.ts`, `src/lib/test/memory-supabase.ts`
- FU-015: `context/changes/weekly-volume-float-round/`
- Progress format: `.cursor/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Weekly-km generate oracle (Risk #3 unit)

#### Automated

- [x] 1.1 `generate-plan.test.ts` asserts `roundKm(sum of distanceKm) === roundKm(weeklyKm)` for weeklyKm 50 and 40.5 with no frozen units — bb25689
- [x] 1.2 That file does not use generated per-day distances as expected km — bb25689
- [x] 1.3 One in-week frozen unit under target with remaining empty days still satisfies the same sum oracle — bb25689
- [x] 1.4 `npm test` passes — bb25689
- [x] 1.5 `npm run lint` passes — bb25689

### Phase 2: Handler generate persist and mutation contracts (Risks #3, #5)

#### Automated

- [x] 2.1 `src/pages/api/plan-contracts.test.ts` mocks `astro:env/server` and `@/lib/supabase` `createClient` to the test’s memory client and does not mock persist services — 00c2a77
- [x] 2.2 `POST /api/plan` as a logged-in user with seeded weeklyKm + A race returns 200 and stored `training_units` for that user pass the roundKm sum oracle (not merely row count) — 00c2a77
- [x] 2.3 `PUT /api/plan/units` with negative km or unknown type returns 400 `VALIDATION_ERROR` and does not change stored units — 00c2a77
- [x] 2.4 `PUT /api/plan/units` with a valid edit plus extra `userId`/`user_id` of another member returns 200; persisted `user_id` is the session user; the other member’s rows are unchanged — 00c2a77
- [x] 2.5 `POST /api/plan/logs` with extra `userId` and `type` persists `user_id` as the session user and `type` from the planned unit — 00c2a77
- [x] 2.6 `POST /api/plan/logs` with negative `distanceKm` returns 400 and inserts no log — 00c2a77
- [x] 2.7 The test file does not import `unitEditSchema` or `workoutLogWriteSchema` to classify payloads — 00c2a77
- [x] 2.8 `npm test` passes — 00c2a77
- [x] 2.9 `npm run lint` passes — 00c2a77

### Phase 3: Cookbook §6.1 / §6.4 and Phase 2 complete

#### Automated

- [x] 3.1 `context/foundation/test-plan.md` §6.1 documents the declared-weekly-km oracle (independent of generator per-day output) with reference test paths — fb01c01
- [x] 3.2 §6.4 documents forged-owner / invalid plan-log body contracts (strip extras; session owner; 400 does not persist) — fb01c01
- [x] 3.3 §6.6 notes Phase 2 (200 + rows is not executable; extra keys are stripped not 400) — fb01c01
- [x] 3.4 §3 Phase 2 Status is `complete` — fb01c01
- [x] 3.5 `npm test` passes — fb01c01
- [x] 3.6 `npm run lint` passes — fb01c01
