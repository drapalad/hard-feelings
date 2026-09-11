# Weekly volume float round Implementation Plan

## Overview

Stop binary float dust from a just-generated 50 km week looking like a soft `WEEKLY_VOLUME_EXCEEDED`. Round kilometres to one decimal in the generate fill split and in `validatePlan` volume compare + warning text. The hard ceiling stays `weeklyKm * 1.2` (60 km when the target is 50).

## Current State Analysis

`generatePlan` splits leftover km evenly: `perDay = remainingKm / emptyDates.length` and writes that raw float onto every empty day. Summing seven copies of `50 / 7` in JS is `50.00000000000001`. `validatePlan` then does `totalKm > weeklyKm` and interpolates `totalKm` into `Weekly volume ${totalKm} km is over the ${weeklyKm} km target…`.

`weeklyKm` from the profile is already at most one decimal (`weeklyKmSchema` + `hasAtMostOneDecimal` in `src/lib/services/profile-races.ts`). The calendar UI already shows `distanceKm.toFixed(1)`. Frozen-anchor identity in `validatePlan` still uses raw `===` on `distanceKm` — that is a different rule and stays exact.

Existing generate success tests only assert `validation.soft` is an array, so a 50 km fill currently warns and still passes.

## Desired End State

A generated 50 km week (no frozen over-target) has empty `validation.soft` for volume, stored fill km at one decimal, and no `50.00000000000001` in bound messages. Real over-target weeks still get soft `WEEKLY_VOLUME_EXCEEDED`; over `weeklyKm * 1.2` still hard. FU-015 is Status: done.

### Key Discoveries:

- `src/lib/services/generate-plan.ts` even split: `remainingKm / emptyDates.length` written onto each empty day, then `validatePlan` on the result.
- `src/lib/services/validate-plan.ts` volume band: `totalKm > weeklyKm * 1.2` hard, else `totalKm > weeklyKm` soft; messages interpolate raw numbers.
- Seven stored copies of `50/7` reduce to `50.00000000000001` (`>` is true); ` (50/7)*7 ` is `50` — the bug is the reduce of the array, not the closed-form product.
- Profile weekly km is already one decimal; UI already `toFixed(1)`.

## What We're NOT Doing

- Changing the 1.2 hard multiplier or treating 60 km as a new constant.
- Rounding frozen-anchor identity (`distanceKm ===`).
- Product UI / landing copy (FU-016).
- Widening cookbook / test-plan phase 2 (that is queue item 7; this change only removes the float lie those oracles would see).

## Implementation Approach

One shared `roundKm` (`Math.round(km * 10) / 10`). `validatePlan` compares and prints rounded total / target / ceiling. `generatePlan` writes one-decimal fill km, with the last empty day taking the remainder so the week still aims at the remaining budget.

## Phase 1: Round volume compare and messages

### Overview

Add `roundKm` and use it in `validatePlan` so float dust is not a volume violation and messages never print a long binary expansion.

### Changes Required:

#### 1. Shared rounder

**File**: `src/lib/km.ts`

**Intent**: One rounding rule for km so generate and validate cannot drift.

**Contract**: Export `roundKm(km: number): number` as `Math.round(km * 10) / 10`. Do not re-use or move `hasAtMostOneDecimal` from `profile-races.ts` in this change.

#### 2. Validator

**File**: `src/lib/services/validate-plan.ts`

**Intent**: Volume band decisions and warning copy use one-decimal km.

**Contract**: `comparedTotal = roundKm(sum of unit.distanceKm)`, `comparedTarget = roundKm(context.weeklyKm)`, `comparedCeiling = roundKm(context.weeklyKm * 1.2)`. Use those three for `>` compares and interpolate them in both `WEEKLY_VOLUME_EXCEEDED` messages. Consecutive-long and frozen-anchor checks stay on raw fields.

#### 3. Tests

**File**: `src/lib/services/validate-plan.test.ts`

**Intent**: Lock the 50 km float-dust case and keep the real soft/hard band.

**Contract**: A week of seven units each `50/7` has no `WEEKLY_VOLUME_EXCEEDED`. `50.1` is still soft; `weeklyKm * 1.2 + 0.1` is still hard. A soft message for a real overage does not contain `000000`. Existing at-target / under / at-ceiling cases stay.

### Success Criteria:

#### Automated Verification:

- `src/lib/km.ts` exports `roundKm`; `roundKm(50.00000000000001)` is `50`
- `validatePlan` on seven units of `50/7` has no `WEEKLY_VOLUME_EXCEEDED` in hard or soft; `50.1` is still soft; `60.1` (weeklyKm 50) is still hard
- Soft volume message for a real overage does not contain `000000`
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 2: Round generate fill split

### Overview

Write one-decimal fill km so a 50 km generate does not store dust, then close FU-015.

### Changes Required:

#### 1. Fill split

**File**: `src/lib/services/generate-plan.ts`

**Intent**: Empty days receive one-decimal km that still spend the remaining budget.

**Contract**: `remainingKm = roundKm(Math.max(0, weeklyKm - frozenKm))`. If there are empty days, `perDay = roundKm(remainingKm / emptyDates.length)` on all but the last; the last empty day is `roundKm(remainingKm - perDay * (n - 1))`. Frozen units stay copied as-is. Still call `validatePlan` after assembly. Do not import `astro:`.

#### 2. Generate tests

**File**: `src/lib/services/generate-plan.test.ts`

**Intent**: A default 50 km week is not a soft volume warning.

**Contract**: `generatePlan(validInput())` (`weeklyKm: 50`, no frozen) is `ok: true`, `validation.hard` empty, `validation.soft` has no `WEEKLY_VOLUME_EXCEEDED`, every `distanceKm` has at most one decimal, and the sum of `distanceKm` equals `50`. Existing frozen-band / unsatisfiable cases stay.

#### 3. Backlog

**File**: `context/backlog.md`

**Intent**: FU-015 is why this change exists; close it when the 50 km week is clean.

**Contract**: Move `### FU-017` stays done; `### FU-015` → Status: done, checkbox ticked, Notes that generate fill + validatePlan round to 1 decimal. Do not edit other FU items except the frontmatter `updated:` date.

### Success Criteria:

#### Automated Verification:

- `generatePlan` for `weeklyKm: 50` and no frozen units: `ok: true`, no `WEEKLY_VOLUME_EXCEEDED` in `validation.soft` or `hard`, unit km at most one decimal, sum of `distanceKm` is `50`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Testing Strategy

### Unit Tests:

- `roundKm` on the known `50.00000000000001` value.
- `validatePlan` volume: seven×`(50/7)` silent; `50.1` soft; `60.1` hard; no `000000` in a real soft message.
- `generatePlan(weeklyKm: 50)` silent volume + 1-decimal fill summing to 50.

### Integration Tests:

- None new. Existing chat/accept volume tests stay; they use constructed 50.1 / 200 km, not the fill split.

## References

- `context/backlog.md` → FU-015
- `src/lib/services/generate-plan.ts`, `src/lib/services/validate-plan.ts`
- Archived F-01 / S-02: `context/archive/2026-08-13-plan-gen-bounds-contract/`, `context/archive/2026-08-13-algorithmic-plan-generation/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Round volume compare and messages

#### Automated

- [x] 1.1 `src/lib/km.ts` exports `roundKm`; `roundKm(50.00000000000001)` is `50` — 3b8c4b5
- [x] 1.2 `validatePlan` on seven units of `50/7` has no `WEEKLY_VOLUME_EXCEEDED` in hard or soft; `50.1` is still soft; `60.1` (weeklyKm 50) is still hard — 3b8c4b5
- [x] 1.3 Soft volume message for a real overage does not contain `000000` — 3b8c4b5
- [x] 1.4 `npm test` exits 0 — 3b8c4b5
- [x] 1.5 `npm run lint` exits 0 — 3b8c4b5

### Phase 2: Round generate fill split

#### Automated

- [x] 2.1 `generatePlan` for `weeklyKm: 50` and no frozen units: `ok: true`, no `WEEKLY_VOLUME_EXCEEDED` in `validation.soft` or `hard`, unit km at most one decimal, sum of `distanceKm` is `50` — 5725547
- [x] 2.2 `npm test` exits 0 — 5725547
- [x] 2.3 `npm run lint` exits 0 — 5725547
- [x] 2.4 `npm run build` exits 0 — 5725547
