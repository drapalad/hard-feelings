# Algorithmic week honors prefs and A–D Implementation Plan

As-built 2026-09-10. This folder was opened after the code existed (cert review). Phases below describe what landed, not a forward schedule.

## Overview

`generatePlan` consumes profile long/rest/mix prefs and race priorities A–D when filling one ISO week. Persist already shipped in `profile-plan-prefs`; this change only teaches the algorithm and the generate persist path.

## Current State Analysis

`GenerateInput` is `{ weeklyKm, races, frozenUnits, weekStart }`. `generatePlan` splits leftover km across empty dates and cycles types; it never emits `long`. `generateAndPersist` reads `profile.weeklyKm` only. `Profile` already has `longWeekdays`, `restWeekdays`, `mixEasy` / `mixThreshold` / `mixSpeed` with `PROFILE_PREF_DEFAULTS` (`sat`, `[]`, 70/20/10). Volume oracle and `NO_A_RACE` stay.

## Desired End State

Generate week: rest weekdays have no unit (unless frozen); preferred long weekdays are type `long` unless that would be consecutive long; mix steers remaining fill into Easy / Threshold / Speed buckets; A required, in-week A day empty, days-to-A tapers speed; in-week B tempo, C recovery, D no pin. `POST /api/plan` uses the member's stored prefs.

## What We're NOT Doing

- Profile UI, migrations, or RLS.
- Chat, Accept, or the purple 14-day generate-via-chat button.
- Changing `validatePlan` hard bounds besides existing consecutive-long / volume.
- Stamping PRD/roadmap in this commit (follow-up group).
- Playwright.

## Implementation Approach

Extend `GenerateInput` with the five pref fields. Add UTC weekday and day-diff helpers. Rewrite fill assignment in `generatePlan`. `buildGenerateInput` / `generateAndPersist` pass profile prefs (defaults when omitted). Tests on `generatePlan` under risk #3.

## Critical Implementation Details

**Rest vs frozen.** Frozen on a rest weekday stays; skip only unoccupied rest dates.

**Long vs consecutive.** If the previous date is already `long` (frozen or assigned), do not place another `long` even on a preferred long weekday.

**A taper.** `daysToA = utcDayDiff(A.date, weekStart)`: ≤6 → mix 100% easy; ≤20 → speed folded into easy; ≥56 and easy ≥10 → +10 speed from easy.

**Mix buckets.** Easy rotates `base` / `recovery`; Threshold `tempo` / `threshold`; Speed is `anaerobic`. Greedy: pick the bucket furthest below its target share.

---

## Phase 1: Types and date helpers

### Overview

Prefs belong on the generate DTO. Weekday and day-diff are shared UTC helpers, not local to the generator.

### Changes Required:

#### 1. GenerateInput

**File**: `src/types.ts`

**Intent**: Callers must pass schedule and mix; generate cannot invent them.

**Contract**: `GenerateInput` includes `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed`.

#### 2. UTC helpers

**File**: `src/lib/dates.ts`, `src/lib/dates.test.ts`

**Intent**: Map ISO dates to `Weekday` and signed day differences the same way the calendar does (UTC).

**Contract**: `weekdayOf("2026-08-10")` is `mon`. `utcDayDiff` is later minus earlier in whole days.

### Success Criteria:

#### Automated Verification:

- Types compile; date helper tests pass.

---

## Phase 2: generatePlan assignment

### Overview

Skip, pin, mix, and A–D live in `generatePlan`. Volume split and `validatePlan` after fill stay.

### Changes Required:

#### 1. Algorithm

**File**: `src/lib/services/generate-plan.ts`

**Intent**: Honor prefs and priorities without going through chat.

**Contract**: Rest omitted; long on preferred days; mix buckets as above; A empty + taper; B tempo; C recovery; D unpinned. `defaultGeneratePrefs()` copies `PROFILE_PREF_DEFAULTS`.

#### 2. Tests

**File**: `src/lib/services/generate-plan.test.ts`

**Intent**: Lock prefs and A–D next to the existing volume oracle.

**Contract**: `describe("risk #3 generatePlan honors profile prefs and A–D priorities")` covers rest/long, 100% speed, in-week A empty, B/C/D, A-within-21 no anaerobic. Existing volume / error cases still pass.

### Success Criteria:

#### Automated Verification:

- Prefs/A–D examples in that describe pass; volume oracle unchanged.

---

## Phase 3: Persist wiring

### Overview

Generate week API must use the stored profile, not DTO-only defaults.

### Changes Required:

#### 1. buildGenerateInput / generateAndPersist

**File**: `src/lib/services/plan.ts`

**Intent**: Profile prefs reach `generatePlan` on `POST /api/plan`.

**Contract**: Optional pref args on `buildGenerateInput` default via `defaultGeneratePrefs()`. `generateAndPersist` passes `profile.longWeekdays` (and rest/mix).

### Success Criteria:

#### Automated Verification:

- `npm test` passes.

#### Manual Verification:

- Profile: Sat long, no rest, 70/20/10. Generate week shows Long on Saturday and mixed types (cert screenshot 06).

## Testing Strategy

Vitest only. No new Playwright; existing `tests/e2e/generate-week-shows-on-calendar.spec.ts` still asserts a generated week appears.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Types and date helpers

#### Automated

- [x] 1.1 `GenerateInput` includes long/rest/mix fields
- [x] 1.2 `weekdayOf` / `utcDayDiff` tests pass

### Phase 2: generatePlan assignment

#### Automated

- [x] 2.1 Rest omitted, long on preferred days, mix buckets, A–D pins/taper
- [x] 2.2 `risk #3 generatePlan honors profile prefs and A–D priorities` plus existing volume oracle

### Phase 3: Persist wiring

#### Automated

- [x] 3.1 `generateAndPersist` passes profile prefs into `buildGenerateInput`
- [x] 3.2 `npm test` passes

#### Manual

- [x] 3.3 Generate week on local dashboard shows Long Saturday and mixed types (cert 06, 2026-09-10)
