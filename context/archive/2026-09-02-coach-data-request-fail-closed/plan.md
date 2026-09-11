# Fail Send when the extra coach completion throws Implementation Plan

## Overview

When the extra (second) coach `complete` throws after allowlisted extras were fetched, fail the Send the same way as a first-call LLM failure: canned `COACH_UNAVAILABLE_REPLY`, empty `mutations`, `loadedKeys: []`. Do not keep or auto-apply the first propose.

## Current State Analysis

`completeSendTurn` in `src/lib/services/chat.ts` already matches first-call LLM failure: `catch` logs `Coach LLM failed:` and sets `raw` to `{ reply: COACH_UNAVAILABLE_REPLY, mutations: [] }`. After allowlisted extras fetch, a second `complete` catch only clears `loadedKeys` and keeps the first `raw`. `sendMessage` then sanitizes that first result and auto-applies mutations when hard is empty.

`src/lib/services/chat.test.ts` encodes keep-first: second throw, first JSON `{ reply: "first", mutations: [{ date: "2026-08-14", distanceKm: 9 }], dataRequestKeys: ["races"] }`, asserts `result.ok`, `loadedKeys: []`, and Friday `distanceKm === 9`.

First-shot JSON can include `mutations` and `dataRequest` together. Keep-first therefore writes a propose the model asked to revise after extra context.

HTTP Send stays 200 on first-call failure: user row is already inserted, assistant canned reply is inserted, calendar unchanged. `ServerError` in `PlanChat` is only for `!response.ok`. The canned bubble is the existing “coach unavailable” surface.

### Key Discoveries:

- Second-throw catch is `src/lib/services/chat.ts` `completeSendTurn` (~323–325): `loadedKeys = []` only; `raw` is left as the first propose.
- First-call catch is the same function (~310–313) plus `proposeAdaptation` (~189–192): canned reply, empty mutations, `console.error("Coach LLM failed:", …)`.
- Auto-apply lives after `completeSendTurn` returns (`sendMessage` `applyMutations` when `proposed.mutations.length > 0`). Replacing `raw` before `sanitizeProposeResult` is enough; do not change auto-apply-when-hard-empty.
- Seed week in `seedSendClient` is 5 km every day (`CURRENT`). Fail-closed must leave Friday at 5, not 9.
- Chip is empty when `loadedKeys` is `[]` (`formatLoadedChip` → `null`). No `PlanChat` / `PlanWorkspace` edit.

## Desired End State

Keyed Send that fetched allowlisted extras and then threw on the second `complete` behaves like a first-call LLM failure: HTTP 200, assistant content `COACH_UNAVAILABLE_REPLY`, no mutations applied, `loadedKeys: []`, calendar rows unchanged. The inverted `chat.test.ts` case is the lock. Successful two-pass, unknown-only keys, extra-fetch omit-key, auto-apply, chip copy, allowlist, generate, Accept/Reject, Welcome, and Profile are unchanged.

## What We're NOT Doing

- Changing the allowlist, chip copy, auto-apply-when-hard-empty, generate button, Accept/Reject routes, Welcome copy, or Profile.
- Returning HTTP 4xx/5xx / `ServerError` for this path (first-call does not).
- Changing extra-fetch throws (still omit that key; skip second complete if none remain).
- Looping a third completion; new allowlist keys; UI POST for extras; a `chat_messages` column.
- Playwright / jsdom / Testing Library.
- Closing unrelated FUs (FU-094–FU-121, FU-123–FU-124) or DEP-020. Stamping roadmap done. Writing `lessons.md`. Next new FU would be FU-125; this change only closes FU-122.

## Implementation Approach

One phase: invert the keep-first test to fail-closed, then make the second-`complete` catch replace `raw` the same way as the first-call catch. Mark FU-122 done pointing at this change-id.

LOCKED: `change.md` Notes + orchestrator locked decisions.

## Critical Implementation Details

**Replace `raw`, do not only clear `loadedKeys`.** First-shot JSON may include `mutations` and `dataRequest` together. Leaving first `raw` in place is today’s bug. After the second throw, set `raw = { reply: COACH_UNAVAILABLE_REPLY, mutations: [] }` and `loadedKeys = []`, then the existing `sanitizeProposeResult` / persist path. Log with the same `console.error("Coach LLM failed:", …)` as the first-call catch (including the eslint-disable comment). Do not extract a helper.

---

## Phase 1: Fail-closed second complete

### Overview

Second `complete` throw after extras fetched matches first-call LLM failure. The existing keep-first test is inverted. FU-122 is closed.

### Changes Required:

#### 1. Second-complete catch

**File**: `src/lib/services/chat.ts`

**Intent**: A failed extra completion must not keep or auto-apply the first propose.

**Contract**: In `completeSendTurn`, when `fetchedKeys.length > 0` and the second `complete({ ...firstRequest, extra })` throws: log `Coach LLM failed:` like the first-call catch; set `raw` to `{ reply: COACH_UNAVAILABLE_REPLY, mutations: [] }`; set `loadedKeys` to `[]`. Do not change the first-call catch, `filterAllowlistedKeys`, `fetchCoachExtra`, auto-apply, or the unkeyed `proposeAdaptation` path.

#### 2. Invert keep-first test

**File**: `src/lib/services/chat.test.ts`

**Intent**: The suite locks fail-closed, not keep-first.

**Contract**: Keep the fixture that first `complete` returns `mutations: [{ date: "2026-08-14", distanceKm: 9 }]` plus `dataRequestKeys: ["races"]` and the second throws. Invert expectations: `result.ok === true`; two `complete` calls; `loadedKeys: []`; assistant message content is `COACH_UNAVAILABLE_REPLY` (import from `propose-adaptation`); Friday in `listWeek` stays `distanceKm: 5` (not 9); `result.data.units` does not carry Friday 9 (undefined or unchanged seed). Rename the `it` so it no longer says “keeps the first reply”. Leave other `sendMessage` tests as they are.

#### 3. Close FU-122

**File**: `context/backlog.md`

**Intent**: This change is the promotion of FU-122; do not leave the keep-first question open.

**Contract**: Set FU-122 `Status: done`, tick the checkbox, **Done:** 2026-09-02, **Notes** name change-id `coach-data-request-fail-closed`. Do not close FU-123, FU-124, or DEP-020. Do not open a new FU unless a later review finding requires one (next id FU-125).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/services/chat.test.ts`: the inverted second-throw case passes (canned unavailable reply, empty `loadedKeys`, Friday still 5 km, two `complete` calls); other cases in that file still pass (two-pass `loadedKeys`, unknown-only keys skip second call, auto-apply when hard empty, skip persist when hard non-empty)
- Source-scan `src/lib/services/chat.ts`: `completeSendTurn` assigns `COACH_UNAVAILABLE_REPLY` to `raw` in **two** `catch` blocks (first `complete` and second `complete` after `fetchCoachExtra`); the second catch is not `loadedKeys = []` alone
- `context/backlog.md` FU-122 is `Status: done` and names `coach-data-request-fail-closed`
- `npm test`
- `npm run lint`

---

## Testing Strategy

### Unit Tests:

- Invert the existing second-throw `sendMessage` case to fail-closed (canned reply, no apply, empty chip keys)
- Leave first-call throw coverage in `propose-adaptation.test.ts` as-is

### Integration Tests:

- Memory-supabase seed already in `chat.test.ts`; do not mock persist services (test-plan §6.2)

## Performance Considerations

None. Same at-most-two completions; the throw path does not add fetches.

## Migration Notes

None. No SQL.

## References

- Locked notes: `context/changes/coach-data-request-fail-closed/change.md`
- Prior slice: `context/changes/coach-data-request/` (FU-122 keep-first)
- First-call pattern: `src/lib/services/chat.ts` `completeSendTurn` first `catch`; `src/lib/services/propose-adaptation.ts` `COACH_UNAVAILABLE_REPLY`
- Test-plan §6: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fail-closed second complete

#### Automated

- [x] 1.1 `npx vitest run src/lib/services/chat.test.ts`: the inverted second-throw case passes (canned unavailable reply, empty `loadedKeys`, Friday still 5 km, two `complete` calls); other cases in that file still pass (two-pass `loadedKeys`, unknown-only keys skip second call, auto-apply when hard empty, skip persist when hard non-empty) — ed7451e
- [x] 1.2 Source-scan `src/lib/services/chat.ts`: `completeSendTurn` assigns `COACH_UNAVAILABLE_REPLY` to `raw` in **two** `catch` blocks (first `complete` and second `complete` after `fetchCoachExtra`); the second catch is not `loadedKeys = []` alone — ed7451e
- [x] 1.3 `context/backlog.md` FU-122 is `Status: done` and names `coach-data-request-fail-closed` — ed7451e
- [x] 1.4 `npm test` — ed7451e
- [x] 1.5 `npm run lint` — ed7451e
