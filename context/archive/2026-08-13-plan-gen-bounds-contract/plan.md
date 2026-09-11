# Plan Generation and Hard-Bound Validator Contract Implementation Plan

## Overview

Add an in-process TypeScript contract for algorithmic plan generation and hard-bound validation so later slices (S-02 calendar generate, S-03 chat accept/reject) share one bound surface. F-01 is a scaffold: a deterministic one-week stub generator, a validator with a small locked rule set, and Vitest coverage — not HTTP, not persistence, not training-science quality.

## Current State Analysis

The app is still auth/bootstrap for product UI (no plan HTTP, no product migrations, no zod-backed JSON APIs). Auth routes still use `formData` + redirects. Domain vocabulary lives in `context/foundation/prd.md` and `context/foundation/roadmap.md` (F-01 / FR-004 / FR-008 / NFR hard bounds).

Phases 1–2 of this change already landed on disk: `vitest.config.ts` (standalone `vitest/config`, not `getViteConfig`), `src/types.ts` DTOs, CI `npm test`, AGENTS.md Vitest docs. Phase 3 files also exist (`src/lib/services/validate-plan.ts` + colocated tests) and match the locked rule set; Progress 3.x is still unchecked — the next implement pass must **re-verify and tick**, not rewrite the validator. `generatePlan` (Phase 4) is not implemented. Astro 6 + `getViteConfig()` remains a known Vitest crash path; keep the runner off the Astro config helper.

## Desired End State

Callers can `generatePlan(input)` and `validatePlan(plan, context)` from `src/lib/services/` without touching the database or HTTP. Valid input yields a 7-day plan whose hard violations are empty. Invalid input yields a typed error. Chat-era consumers can refuse accept when `validation.hard.length > 0`, and can surface `validation.soft` without blocking. `npm test` is the automated proof.

### Key Discoveries:

- `src/types.ts` and `src/lib/services/validate-plan.ts` already exist; AGENTS.md names those paths as the home (`AGENTS.md:33`). Do not recreate them.
- Roadmap F-01 is explicitly a contract/scaffold — algorithm quality is S-02/S-06 (`context/foundation/roadmap.md` F-01 risk).
- Hard vs soft UX is locked in the PRD (FR-008, NFR): hard bounds must never land even if a member tries to accept.
- Astro 6 `getViteConfig()` pulls `astro:server` into Vitest and can crash; a standalone `vitest/config` file is the safe path for node unit tests.
- Workers free-tier 10ms CPU (DEP-002) is not a F-01 trigger: this slice is a week-sized in-process function, not chat/SSR.

## What We're NOT Doing

- HTTP routes (`/api/plan/*`) or zod request parsing — S-02 owns the generate API.
- Supabase tables, migrations, or RLS for plans/workouts — S-02 (calendar persist) and S-01 (profile/races).
- Calendar UI, chat, accept/reject, or freeze UX.
- Full training-science generation (taper, progression, intensity stacking, season horizon).
- Soft warnings other than the weekly-volume band.
- Adding `zod` (no API in this slice).
- Playwright / component tests / `jsdom`.
- Closing or expanding DEP-002 (Workers Paid) — not required for this CPU budget.
- Changing auth routes to JSON/zod (out of F-01 scope).

## Implementation Approach

Pure functions, no I/O. Types in `src/types.ts`. Validator and generator as sibling services. Generator always runs the validator before returning `ok: true`. Tests are colocated `*.test.ts`. Vitest uses `environment: "node"` and the `@/*` alias, without Astro's Vite helper.

Result shapes (locked):

- `validatePlan` → `{ hard: BoundViolation[]; soft: BoundViolation[] }` — accept-gating is `hard.length === 0`; soft never blocks.
- `generatePlan` → `{ ok: true, plan, validation } | { ok: false, error: { code, message } }`.

## Critical Implementation Details

**Vitest vs Astro 6.** Do not import `getViteConfig` from `astro/config`. Use `defineConfig` from `vitest/config`, `test.environment: "node"`, and a `resolve.alias` that matches `tsconfig.json` `@/*` → `./src/*`. F-01 tests must not import `astro:` modules.

**Calendar dates.** Unit `date` and `weekStart` are `YYYY-MM-DD` strings. Consecutive longs means two `type === "long"` units whose calendar dates differ by exactly one day — not adjacent array indexes. Do not use local `Date` parsing (`new Date("YYYY-MM-DD")`, `setDate`) that can shift the day in non-UTC timezones (Workers). Enumerate and compare days with `Date.UTC` on split `Y-M-D` parts. Duplicate this in `generate-plan.ts` (validator already has private `utcDayNumber`); do not add a shared dates module in F-01.

**Volume band.** Sum `distanceKm` vs `weeklyKm`: at or under → no volume violation; `(weeklyKm, weeklyKm * 1.2]` → soft `WEEKLY_VOLUME_EXCEEDED`; `> weeklyKm * 1.2` → hard, same code. Under-volume is not a warning in F-01.

**Frozen identity and generate invariant.** A frozen anchor is preserved iff the plan has a unit on that date with `frozen === true` and the same `type` and `distanceKm`. `generatePlan` may return `ok: true` only when `validation.hard` is empty. Frozen units whose date falls outside the stub week are ignored by generate; validate checks every `frozenUnits` entry it is given. If in-week frozen anchors already make a hard-valid plan impossible (consecutive frozen longs, or frozen km sum `> weeklyKm * 1.2`), generate returns `ok: false` with `UNSATISFIABLE_BOUNDS`.

---

## Phase 1: Vitest harness

### Overview

Introduce Vitest and wire it into scripts, CI, and AGENTS.md so later phases can add real tests.

### Changes Required:

#### 1. Vitest config and scripts

**File**: `vitest.config.ts` (new), `package.json`

**Intent**: Add a node-only Vitest runner with the existing `@/` alias, without loading Astro's Vite plugins.

**Contract**: Dev-dep `vitest`. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`. Config uses `defineConfig` from `vitest/config` (not `astro/config`). `test.include` covers `src/**/*.test.ts`. Alias `@` → `./src`.

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
```

#### 2. CI and agent docs

**File**: `.github/workflows/ci.yml`, `AGENTS.md`

**Intent**: Make `npm test` a required check and tell future agents the runner exists.

**Contract**: CI runs `npm test` after `npm run lint` and before `npm run build`. AGENTS.md “Build, Test, and Development Commands” replaces “No test runner or test suite is configured yet” with Vitest via `npm test` / `npm run test:watch`.

#### 3. Smoke test

**File**: `src/lib/services/plan-contract.smoke.test.ts` (new)

**Intent**: Give phase 1 a green suite so CI does not fail on “no tests”. Replace or delete this file in later phases once real tests exist — do not leave a tautology next to production tests if it is redundant.

**Contract**: One passing `expect` so `npm test` exits 0. Prefer deleting this file in Phase 3 or 4 once validator/generator tests exist.

### Success Criteria:

#### Automated Verification:

- `vitest.config.ts` uses `vitest/config` `defineConfig` and does not import `getViteConfig` from `astro/config`
- `package.json` defines `test` (`vitest run`) and `test:watch` (`vitest`)
- `.github/workflows/ci.yml` runs `npm test` after lint and before build
- `AGENTS.md` documents Vitest (`npm test`) instead of stating there is no test runner
- `npm test` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- `npm test` output is readable in a local terminal

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Domain types

### Overview

Lock the shared DTOs and result unions that S-02/S-03 will import.

### Changes Required:

#### 1. Shared entity and result types

**File**: `src/types.ts` (new)

**Intent**: Put the plan/unit/bound contract in the AGENTS-mandated shared types module so services and later API layers import one shape.

**Contract**: Export at least:

- `WorkoutType`: `"base" | "recovery" | "tempo" | "threshold" | "anaerobic" | "long"`
- `RacePriority`: `"A" | "B" | "C" | "D"`
- `TrainingUnit`: `{ date: string; type: WorkoutType; distanceKm: number; structure?: string; frozen: boolean }` — `date` is `YYYY-MM-DD`
- `RaceInput`: `{ date: string; priority: RacePriority; goal?: string }`
- `Plan`: `{ units: TrainingUnit[] }`
- `GenerateInput`: `{ weeklyKm: number; races: RaceInput[]; frozenUnits: TrainingUnit[]; weekStart: string }`
- `BoundCode`: `"WEEKLY_VOLUME_EXCEEDED" | "CONSECUTIVE_LONGS" | "FROZEN_ANCHOR_DROPPED"`
- `BoundViolation`: `{ code: BoundCode; severity: "hard" | "soft"; message: string; dates?: string[] }`
- `ValidateResult`: `{ hard: BoundViolation[]; soft: BoundViolation[] }`
- `GenerateErrorCode`: `"MISSING_WEEKLY_KM" | "INVALID_WEEKLY_KM" | "NO_A_RACE" | "UNSATISFIABLE_BOUNDS"`
- `GenerateResult`: `{ ok: true; plan: Plan; validation: ValidateResult } | { ok: false; error: { code: GenerateErrorCode; message: string } }`

Use camelCase field names. Do not persist these; they are in-memory DTOs.

### Success Criteria:

#### Automated Verification:

- `src/types.ts` exports `TrainingUnit`, `Plan`, `GenerateInput`, `GenerateResult`, `ValidateResult`, `BoundViolation`, `WorkoutType`, `RacePriority`, `BoundCode`, and `GenerateErrorCode`
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- `WorkoutType` includes `long` plus the five PRD types (`base`, `recovery`, `tempo`, `threshold`, `anaerobic`) when reading `src/types.ts`

---

## Phase 3: Hard-bound validator

### Overview

Implement `validatePlan` with the locked small rule set and fixture tests for pass, soft, and hard cases. The service and tests are already on disk — re-run the suite and tick Progress; do not replace a matching implementation.

### Changes Required:

#### 1. Validator service

**File**: `src/lib/services/validate-plan.ts` (exists — re-verify, do not rewrite if it still matches the contract below)

**Intent**: Single function S-02 (post-generate) and S-03 (post-diff) will call so bound rules cannot diverge.

**Contract**: `validatePlan(plan: Plan, context: { weeklyKm: number; frozenUnits: TrainingUnit[] }): ValidateResult`.

Rules:

1. Volume — sum of `plan.units[].distanceKm` vs `context.weeklyKm` using the band in Critical Implementation Details. Same `BoundCode` for soft and hard; distinguish via `severity`.
2. Consecutive longs — hard `CONSECUTIVE_LONGS` when two units with `type === "long"` fall on calendar dates one day apart. Longs two or more days apart are allowed. Same-day duplicate longs are out of scope for this rule (do not invent a fourth code).
3. Frozen anchors — for each entry in `context.frozenUnits`, the plan must contain a unit with the same `date`, `type`, `distanceKm`, and `frozen === true`. Missing or mutated → hard `FROZEN_ANCHOR_DROPPED` (include the anchor `date` in `dates`).

`hard` / `soft` arrays may contain multiple violations. Do not throw on a violating plan.

If this file exists, delete `plan-contract.smoke.test.ts` from Phase 1 so the suite is domain tests only.

#### 2. Validator tests

**File**: `src/lib/services/validate-plan.test.ts` (exists — same re-verify rule)

**Intent**: Pin the bound contract with fixtures so S-02 cannot “fix” a failing stub by loosening rules.

**Contract**: Colocated Vitest file covering the cases listed under Automated Verification below. Fixtures use explicit `YYYY-MM-DD` dates.

### Success Criteria:

#### Automated Verification:

- `src/lib/services/validate-plan.ts` exports `validatePlan(plan, context)`
- Tests cover: at-or-under volume (no volume violation); over and ≤120% (soft `WEEKLY_VOLUME_EXCEEDED`); over 120% (hard, same code); adjacent longs (hard `CONSECUTIVE_LONGS`); longs separated by a day (no consecutive-long violation); frozen unit preserved (no freeze violation); frozen missing (hard `FROZEN_ANCHOR_DROPPED`); frozen `type` or `distanceKm` changed (hard `FROZEN_ANCHOR_DROPPED`)
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 4: Deterministic generate stub

### Overview

Implement `generatePlan` as a bound-aware one-week stub that fails closed on bad input and never returns `ok: true` with hard violations.

### Changes Required:

#### 1. Generator service

**File**: `src/lib/services/generate-plan.ts` (new)

**Intent**: Prove the FR-004 generation entrypoint exists as a callable function without stealing S-02 algorithm quality.

**Contract**: `generatePlan(input: GenerateInput): GenerateResult`.

Input errors (no `plan` on these paths):

- `weeklyKm` not a finite number → `MISSING_WEEKLY_KM`
- finite `weeklyKm <= 0` → `INVALID_WEEKLY_KM`
- no race with `priority === "A"` → `NO_A_RACE`

Success path:

- Emit a `Plan` covering the 7 calendar days `weekStart` … `weekStart + 6` days, using UTC day arithmetic (duplicate/inline; no `src/lib/dates` module):

```ts
const MS_PER_DAY = 86_400_000;

function addUtcDays(isoDate: string, n: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + n * MS_PER_DAY;
  return new Date(utcMs).toISOString().slice(0, 10);
}

const weekDates = [0, 1, 2, 3, 4, 5, 6].map((n) => addUtcDays(weekStart, n));
```

- Copy in-week `frozenUnits` onto those dates unchanged (`frozen: true`).
- Fill remaining days so the plan is hard-valid: total km at or under `weeklyKm`, at most one long or longs not adjacent, mix of `WorkoutType` values as needed.
- Ignore frozen units whose `date` is outside the stub week.
- Call `validatePlan` with the produced plan and the in-week frozen list. Return `{ ok: true, plan, validation }` only when `validation.hard.length === 0`. Soft warnings are allowed on `ok: true` (e.g. frozen km already in the 100–120% band and leftover days add no km).
- If in-week frozen anchors already violate hard bounds, return `{ ok: false, error: { code: "UNSATISFIABLE_BOUNDS", message } }` — do not return a hard-violating plan as success.
- Deterministic: same input → same output. No `Math.random`, no uninjected `Date.now()`.

#### 2. Generator tests

**File**: `src/lib/services/generate-plan.test.ts` (new)

**Intent**: Lock input errors, the 7-day shape, freeze copy, unsatisfiable frozen cases, and determinism.

**Contract**: Colocated Vitest file covering the cases listed under Automated Verification. Include a repeated-call equality assertion for the happy path.

### Success Criteria:

#### Automated Verification:

- `src/lib/services/generate-plan.ts` exports `generatePlan(input)` returning `GenerateResult`
- Tests cover: non-finite `weeklyKm` → `MISSING_WEEKLY_KM`; `weeklyKm <= 0` → `INVALID_WEEKLY_KM`; no A-priority race → `NO_A_RACE`; valid input → `ok: true`, 7 days from `weekStart`, `validation.hard` empty; in-week frozen units copied; consecutive frozen longs or frozen km sum `> weeklyKm * 1.2` → `UNSATISFIABLE_BOUNDS`; frozen km in `(weeklyKm, weeklyKm * 1.2]` → `ok: true`, `hard` empty, soft `WEEKLY_VOLUME_EXCEEDED`, leftover days 0 km; same valid input twice → deep-equal plans
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Testing Strategy

### Unit Tests:

- Validator: volume band boundaries (exactly `weeklyKm`, just above, exactly `* 1.2`, just above `* 1.2`); consecutive vs non-consecutive longs; freeze preserve / drop / mutate.
- Generator: three input errors; unsatisfiable frozen; frozen km in the 100–120% band → `ok: true` with soft volume warning and leftover days 0 km; happy path length and hard-empty; freeze copy; determinism.
- Do not test S-02 algorithm quality (taper, race-priority periodization).

### Integration Tests:

- None in this slice (no HTTP, no DB). The generate→validate handoff is covered by generator tests asserting `validation.hard` on the success path.

### Manual Testing Steps:

1. Run `npm test` and confirm the suite name list matches validator + generator (no leftover smoke tautology).
2. Open `src/types.ts` and confirm `BoundCode` / `GenerateErrorCode` match the strings used in tests.
3. Confirm `npm run lint` and `npm run build` still pass with the new files.

## Performance Considerations

Week-sized CPU is negligible on Workers; do not treat F-01 as a reason to close DEP-002. Keep the validator a single pass over units (sort dates once for consecutive-long checks). No caching.

## Migration Notes

No database. No backwards-compatible API. Types may grow in S-02 (extra unit fields); additive optional fields are fine. Bound codes introduced here are a public contract for S-03 — do not rename them later without a dedicated change.

## References

- Roadmap F-01: `context/foundation/roadmap.md`
- PRD: FR-004, FR-008, FR-013 (freeze as input), NFR hard bounds — `context/foundation/prd.md`
- AGENTS layout: `src/types.ts`, `src/lib/services/` — `AGENTS.md`
- Workers CPU / DEP-002 (not in scope): `context/deployment/deferred.md`, `context/foundation/infrastructure.md`
- Astro 6 + `getViteConfig` Vitest crash: https://github.com/withastro/astro/issues/15847

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest harness

#### Automated

- [x] 1.1 `vitest.config.ts` uses `vitest/config` `defineConfig` and does not import `getViteConfig` from `astro/config` — 4794cc7
- [x] 1.2 `package.json` defines `test` (`vitest run`) and `test:watch` (`vitest`) — 4794cc7
- [x] 1.3 `.github/workflows/ci.yml` runs `npm test` after lint and before build — 4794cc7
- [x] 1.4 `AGENTS.md` documents Vitest (`npm test`) instead of stating there is no test runner — 4794cc7
- [x] 1.5 `npm test` exits 0 — 4794cc7
- [x] 1.6 `npm run lint` exits 0 — 4794cc7

#### Manual

- [x] 1.7 `npm test` output is readable in a local terminal — 4794cc7

### Phase 2: Domain types

#### Automated

- [x] 2.1 `src/types.ts` exports `TrainingUnit`, `Plan`, `GenerateInput`, `GenerateResult`, `ValidateResult`, `BoundViolation`, `WorkoutType`, `RacePriority`, `BoundCode`, and `GenerateErrorCode` — 12028ae
- [x] 2.2 `npm run lint` exits 0 — 12028ae
- [x] 2.3 `npm run build` exits 0 — 12028ae

#### Manual

- [x] 2.4 `WorkoutType` includes `long` plus the five PRD types (`base`, `recovery`, `tempo`, `threshold`, `anaerobic`) when reading `src/types.ts` — 12028ae

### Phase 3: Hard-bound validator

#### Automated

- [x] 3.1 `src/lib/services/validate-plan.ts` exports `validatePlan(plan, context)` — 5fcf5a7
- [x] 3.2 Tests cover: at-or-under volume (no volume violation); over and ≤120% (soft `WEEKLY_VOLUME_EXCEEDED`); over 120% (hard, same code); adjacent longs (hard `CONSECUTIVE_LONGS`); longs separated by a day (no consecutive-long violation); frozen unit preserved (no freeze violation); frozen missing (hard `FROZEN_ANCHOR_DROPPED`); frozen `type` or `distanceKm` changed (hard `FROZEN_ANCHOR_DROPPED`) — 5fcf5a7
- [x] 3.3 `npm test` exits 0 — 5fcf5a7
- [x] 3.4 `npm run lint` exits 0 — 5fcf5a7

### Phase 4: Deterministic generate stub

#### Automated

- [x] 4.1 `src/lib/services/generate-plan.ts` exports `generatePlan(input)` returning `GenerateResult` — 11377e3
- [x] 4.2 Tests cover: non-finite `weeklyKm` → `MISSING_WEEKLY_KM`; `weeklyKm <= 0` → `INVALID_WEEKLY_KM`; no A-priority race → `NO_A_RACE`; valid input → `ok: true`, 7 days from `weekStart`, `validation.hard` empty; in-week frozen units copied; consecutive frozen longs or frozen km sum `> weeklyKm * 1.2` → `UNSATISFIABLE_BOUNDS`; frozen km in `(weeklyKm, weeklyKm * 1.2]` → `ok: true`, `hard` empty, soft `WEEKLY_VOLUME_EXCEEDED`, leftover days 0 km; same valid input twice → deep-equal plans — 11377e3
- [x] 4.3 `npm test` exits 0 — 11377e3
- [x] 4.4 `npm run lint` exits 0 — 11377e3
- [x] 4.5 `npm run build` exits 0 — 11377e3
