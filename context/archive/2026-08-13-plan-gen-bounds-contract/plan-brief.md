# Plan Generation and Hard-Bound Validator Contract — Plan Brief

> Full plan: `context/changes/plan-gen-bounds-contract/plan.md`

## What & Why

Ship a shared in-process generation entrypoint and hard-bound validator so plan mutations can be rejected before they land. F-01 exists so S-02 (algorithmic generate into the calendar) and S-03 (chat accept/reject) do not invent divergent bound rules. Full algorithm quality stays out of this slice.

## Starting Point

The app is still auth/bootstrap for product UI. This change already has Vitest, `src/types.ts`, and `validatePlan` on disk; `generatePlan` is the remaining gap. Product rules live in the PRD (FR-004, FR-008, NFR hard bounds) and roadmap F-01 (“contract/scaffold”).

## Desired End State

`generatePlan` and `validatePlan` are importable services. Valid input yields a 7-day stub plan with empty `validation.hard`. Chat-era code can refuse accept on hard violations and show soft volume warnings. `npm test` proves the contract.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Surface | In-process services only (no HTTP, no DB) | Keeps F-01 a scaffold parallel with S-01; S-02 owns persist/API | Plan |
| Hard rules | Volume vs weekly km; no two longs in a row; freeze anchors must not be dropped/mutated | Enough to prove NFR “hard bounds never land” without becoming S-02 | Plan |
| Volume band | Soft if over weekly km up to +20%; hard beyond | Member can accept a modest overage; 21%+ cannot land | Plan |
| Unit schema | date, type, distanceKm, optional structure, frozen | Matches km/type/structure sketch; paces/HR wait | Plan |
| Workout types | PRD set + `long` | Consecutive-long rule is `type === "long"`, not a heuristic | Plan |
| Generator | Deterministic 7-day stub from weeklyKm + races + weekStart | Proves the entrypoint; S-02 replaces quality | Plan |
| Bad input | Typed `GenerateResult` errors, not throws | Callers (S-02) branch on `ok` without try/catch | Plan |
| Unsatisfiable freeze | `UNSATISFIABLE_BOUNDS` | Frozen longs in a row or frozen km > 120% cannot yield `ok: true` | Plan |
| Tests | Add Vitest now (node, no `getViteConfig`) | Pure functions are the right first suite; Astro 6 helper can crash Vitest | Plan |

## Scope

**In scope:** Vitest + CI; `src/types.ts` DTOs; `validatePlan`; `generatePlan` stub; bound codes; generate→validate invariant.

**Out of scope:** HTTP/zod APIs; plan tables; calendar/chat UI; training-science algorithm; extra soft rules; DEP-002 Workers Paid.

## Architecture / Approach

Callers pass a `GenerateInput` DTO (not DB rows). `generatePlan` fills one week, copies in-week frozen units, then runs `validatePlan`. Success is `{ ok: true, plan, validation }` with `hard.length === 0`. `validatePlan` is the only bound implementation — S-03 applies a diff, then calls the same function on the resulting plan.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Vitest harness | Runner, scripts, CI, AGENTS.md | Using Astro `getViteConfig` and crashing the suite |
| 2. Domain types | Locked DTOs/unions in `src/types.ts` | Field names that S-02 must live with |
| 3. Hard-bound validator | Three rules + volume band + fixtures | Consecutive-long defined on array order instead of calendar dates |
| 4. Generate stub | 7-day deterministic generate + input errors | Returning `ok: true` while frozen anchors already violate |

**Prerequisites:** None (parallel with S-01). Node 22 per `.nvmrc`.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Stub week will be rewritten in S-02; bound codes and `TrainingUnit` should not be.
- `UNSATISFIABLE_BOUNDS` was added beyond the three planned input errors so generate never succeeds with hard violations.
- Under-volume is not a warning; only overage uses the soft/hard band.

## Success Criteria (Summary)

- A later slice can import `generatePlan` / `validatePlan` and gate accept on `validation.hard`.
- The three hard rules and the +20% volume band are pinned by Vitest.
- No HTTP or database leaked into F-01.
