# Critical-path ownership and bounds — Plan Brief

> Full plan: `context/changes/testing-critical-path-ownership-and-bounds/plan.md`
> Research: `context/changes/testing-critical-path-ownership-and-bounds/research.md`

## What & Why

Rollout Phase 1 of `context/foundation/test-plan.md`: prove Member B cannot read or mutate Member A's plan/logs, an out-of-bounds chat proposition cannot land on Accept, and logged-out plan/chat/log APIs return 401 JSON with no member data. Product already does this; nothing in Vitest proves it at persist or handler boundaries.

## Starting Point

Fourteen `src/lib` unit files, no fake client, no handler imports, CI `npm test` without Supabase. Isolation is `.eq("user_id")` + RLS; Accept re-checks live bounds before `replaceWeek`; JSON 401 is per-handler, pages 302 via middleware.

## Desired End State

`npm test` fails if those three gates regress. Cookbook §6.2 / §6.4 tell the next author how to copy the oracles (snapshot isolation, persist-skip, handler 401), not happy paths.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Persist layer | In-memory query-builder, not real DB | CI has no Supabase; fake must leak unless `.eq("user_id")` runs | Research |
| Harness | Shared `createMemorySupabase` | One filter semantics for #1 and #2 | Plan |
| #1 surface | listWeek, setFrozen, editUnit, listLogs, upsertLog, deleteLog | Named risk is plan **and** logs, including mutate | Plan |
| #1 oracle | Distinctive payload + A's snapshot; never 403 | B on A's dates is 200 with B's week | Research |
| #2 fixture | Constructed volume `> weeklyKm * 1.2` + soft control | Independent of generate/proposer; control proves Accept can write | Plan |
| Live weeklyKm | Drop between seed and accept must block | Accept must re-check live profile, not stored validation | Plan |
| #6 matrix | All 12 plan*/chat* methods | Marginal cost is low after one `astro:env` mock | Plan |
| #6 oracle | 401 JSON `UNAUTHORIZED`; not `/dashboard` | Handlers own API gate; pages are 302 | Research |
| Browser / JWT | None in this phase | Playwright cannot click disabled Accept; real RLS is Phase 3 | Research |
| Phase order | Harness → #6 → #1 → #2 → cookbook | Cheapest signal first; cookbook last as required | Plan |

## Scope

**In scope:** Memory fake; handler 401 table; two-user persist isolation; `acceptProposition` persist-skip + soft control + weeklyKm drop; cookbook §6.2/§6.4/§6.6; AGENTS.md pointer to §6.

**Out of scope:** Playwright; real Supabase; races/profile/admin; 401 on `/dashboard`; pending-store-as-bug; validator-internal tests as landing proof; HTTP 409 Accept mapping; Risk #5 forged body; rewriting test-plan §1/§2.

## Architecture / Approach

Seed both members in one table store. Services keep talking fluent Supabase. Isolation tests fail if the chain omits `.eq("user_id")`. Accept tests insert an illegal pending row and assert `training_units` unchanged. Handler tests call exported methods with `user: null` after mocking `astro:env/server`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Memory query-builder | Shared fake + leak-without-filter pin | Tautological pre-scoped double |
| 2. Logged-out 401s | All 12 plan/chat methods | Mock/import graph; wrong 302 oracle |
| 3. Two-user isolation | B cannot read/mutate A's units/logs | `editUnit` NOT_FOUND before UPDATE |
| 4. Accept persist-skip | Hard pending does not land; soft does | Trusting stored validation |
| 5. Cookbook | §6.2 / §6.4 / §6.6 + §3 complete | Next tests ignore the oracles |

**Prerequisites:** Research complete; Vitest already in CI; product gates already implemented.
**Estimated effort:** ~2 sessions across 5 phases (harness is the costly one).

## Open Risks & Assumptions

- Current product should already pass; if a test fails, inspect the fake before changing handlers.
- The fake only needs the chains Phases 3–4 call, not a complete supabase-js.
- RLS remains unproven until a later real-DB phase; application `.eq("user_id")` is the belt this suite owns.

## Success Criteria (Summary)

- B's persist calls do not yield or alter A's distinctive rows.
- Hard (and live-ceiling) Accept leaves `training_units` unchanged; soft Accept lands.
- Logged-out plan/chat/log methods return 401 `UNAUTHORIZED` JSON with no member collections.
