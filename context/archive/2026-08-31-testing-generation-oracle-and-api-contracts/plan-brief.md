# Generation oracle and API contracts — Plan Brief

> Full plan: `context/changes/testing-generation-oracle-and-api-contracts/plan.md`
> Research: `context/changes/testing-generation-oracle-and-api-contracts/research.md`

## What & Why

Rollout Phase 2 of `context/foundation/test-plan.md`: prove generate honors declared weekly km with an independent 1-decimal oracle, and prove the server rejects invalid plan/log JSON and does not persist a client-supplied owner. Product already behaves; Vitest does not prove persist volume or hostile bodies.

## Starting Point

FU-015 `roundKm` is in the fill split and validator. Generate tests hardcode `sum === 50` and skip persist. Handler tests are logged-out 401 only. Zod strips unknown keys; owner is `locals.user.id`. Memory-supabase and `product-gates.test.ts` exist from Phase 1.

## Desired End State

`npm test` fails if a successful generate’s stored week total is not `roundKm`-equal to profile weekly km, or if invalid/forged plan/log JSON writes the wrong owner or persists garbage. Cookbook §6.1 / §6.4 tell the next author how to copy those oracles.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Complexity | LOW | Test-only; harness and handler-call pattern already exist | Unattended |
| Volume oracle | `roundKm(sum) === roundKm(weeklyKm)` when ≥1 fill day and frozen ≤ target | Independent of per-day fill; `validatePlan` silence is not executable | Research |
| Remainder target | Include weeklyKm 40.5 | Exercises last-day remainder without snapshotting per-day km | Research |
| HTTP 200 challenge | Handler `POST /api/plan` plus stored-row oracle | Seven rows / 200 is the assumption to challenge | Research |
| Extra JSON keys | 200 + session owner, not 400 | Zod strips; `.strict()` is out of scope | Research |
| Mutation surface | PUT units + POST logs | Named risk is plan/log mutation, not races/profile | Research |
| Persist mocking | Mock `createClient` only | Do not mock `generateAndPersist` / `editUnit` / `upsertLog` | Plan |
| Schema in tests | Literal JSON bodies; no `safeParse` of handler schemas | Anti-pattern: mirroring the parse | Research |
| Cookbook | Last phase; fill §6.1 and extend §6.4 / §6.6 | Test-plan required; AGENTS.md already points at §6 | Plan |

## Scope

**In scope:** `generate-plan.test.ts` oracle; `plan-contracts.test.ts` generate persist + invalid/forged unit/log; cookbook §6.1/§6.4/§6.6; §3 Phase 2 `complete`.

**Out of scope:** Playwright; real DB; Phase 3/4; `.strict()`; product code unless a test fails; chat/profile/races; snapshot per-day km; opening FU-011.

## Architecture / Approach

Unit oracle on `generatePlan` first. Then one handler file: hoisted memory client, real persist services, literal JSON, two members in the store so a leaked owner is visible. Cookbook last.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Weekly-km unit oracle | 50 + 40.5 + frozen-under-target fill | Copying per-day fill as expected km |
| 2. Handler contracts | Persist volume + 400/forged-owner | Mocking persist; extra keys as 400 |
| 3. Cookbook | §6.1 / §6.4 / Phase 2 complete | Next tests ignore the oracles |

**Prerequisites:** Phase 1 harness; FU-015 `roundKm`; research complete.
**Estimated effort:** one session, three short phases.

## Open Risks & Assumptions

- Current product should already pass; if a test fails, inspect the mock/seed before changing handlers.
- All-days-frozen under target cannot fill (oracle exception) — not tested as a fail in this phase.
- RLS remains unproven (Phase 3). Application owner-from-session is the belt this suite owns.

## Success Criteria (Summary)

- Generate success with fill days hits `roundKm(profile weeklyKm)` in memory and after `POST /api/plan`.
- Invalid unit/log JSON is 400 with no persist; extra `userId` does not change row owner.
- Cookbook §6.1 is the weekly-km pattern; §3 Phase 2 is `complete`.
