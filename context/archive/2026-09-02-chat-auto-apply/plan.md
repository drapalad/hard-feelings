# Coach Send auto-applies when hard bounds pass Implementation Plan

## Overview

When Coach Send (including the purple canned 14-day turn) produces mutations and `validation.hard` is empty, persist those units on the same keep-merge path as today’s Accept — no confirm step. Hard bounds still refuse the write. Drop Accept/Reject and the Proposed changes card from the Week UI. Keep `POST /api/chat/accept` and `reject` for 401 gates.

## Current State Analysis

`sendMessage` (`src/lib/services/chat.ts`) proposes, inserts a `plan_propositions` row with `status: "pending"`, and returns `ChatList` (messages + proposition). Calendar rows change only in `acceptProposition`, which re-runs `acceptDecision` / `gateByIsoWeek`, then `replaceWeek`s each overlapping Monday with the 14-day keep-merge from `generate-via-chat`. Soft overage can land; hard volume/longs/frozen does not. Neither path calls `snapshotWeekIfChanged` / `insertRevision` (manual **Save snapshot** is the archive).

`POST /api/chat/messages` returns `{ weekStart, messages, proposition, logs }`. `POST /api/chat/accept` returns `{ weekStart, units, validation, undoAvailable, revisions }`. `PlanWorkspace.send` only `applyChatBody`s. `accept()` `mergeReturnedUnits`s and `setWarnings(asSoft)`. `PlanChat` renders Proposed changes + Accept/Reject; Accept is disabled when `hard.length > 0`. Soft and hard lists live on that card. Calendar already has an amber `warnings` list (`PlanCalendar`, `text-amber-200/90`).

`product-gates.test.ts` asserts 401 JSON on accept/reject. Test-plan §6.2 Accept persist-skip is `accept-proposition.test.ts`. UI tests are `readFileSync` source-scans. Playwright is not a suite.

## Desired End State

After Send, if there were mutations and hard is empty, the calendar already shows the new week — no Accept. Soft warnings appear as the calendar amber banner with the plan already written. If hard is non-empty, training_units are unchanged, the chat shows a red violation list, and nothing is applied. Coach chat has no Proposed changes card and no Accept/Reject. Assistant text may mention what changed; the model reply is enough (no second synthetic message, no diff card). Accept/reject routes still 401 when logged out. Save snapshot / generate button wiring / Profile / cell density stay as they are.

### Key Discoveries:

- Persist already exists in `acceptProposition` (`mondaysToPersist` + `incomingForWeek` + `replaceWeek`). Auto-apply must reuse that loop, not a second `replaceWeek(weekStart, proposed)` that leftover-deletes dates outside the horizon (`chat.ts` ~179–232).
- `sendMessage` already computes `gateByIsoWeek(...).validation` before insertPending (`chat.ts` ~143–149) but does not branch on `acceptDecision`. The new gate is that same decision: persist only when `ok` and `mutations.length > 0`.
- `replaceWeek` does not snapshot. `snapshotWeekIfChanged` is on the unit-edit path (`plan.ts`). Do not add it here.
- `PlanWorkspace.send` ignores `units` even if the API started returning them. Merge must move onto send (same `mergeReturnedUnits` as today’s accept).
- Calendar amber list is already the “amber banner.” Soft after apply belongs there (`asSoft`), not on a removed chat card.
- Risk #2 (test-plan): out-of-bounds chat must not land. The landing gate moves onto `sendMessage`; `acceptProposition` persist-skip tests stay because the route stays.

## What We're NOT Doing

- Dropping hard bounds or letting the island persist when `hard` is non-empty.
- Deleting `src/pages/api/chat/accept.ts` or `reject.ts` (or their 401 tests).
- Calling `snapshotWeekIfChanged` / `insertRevision` from send persist.
- Re-wiring the purple generate button, Profile, List tab, races overlay, or calendar cell density.
- Screenshot fixtures; Playwright / jsdom / Testing Library; `"use client"`; concatenating Tailwind with `+`.
- Closing FU-094–FU-119 or DEP-020. Stamping roadmap done. Writing `lessons.md`.
- Coach-data-request. Changing `generatePlan` / `POST /api/plan`.

## Implementation Approach

Inside `sendMessage`, after propose/apply and `acceptDecision` / `gateByIsoWeek`: if there are mutations and the decision is ok, persist with the shared Accept keep-merge and do not insert a pending proposition. Return `units` + `validation` so `POST /api/chat/messages` can add the revision stack and the island can merge. If hard is non-empty, skip persist, skip pending insert, still store the assistant reply, still capture a hard-bound agent report, return `validation` without `units`. Strip Accept/Reject and the Proposed card from `PlanChat`; `PlanWorkspace.send` becomes the merge site; do not fetch accept/reject from the Week UI.

LOCKED: files and behaviors in `change.md` Notes (human override of FR-006: no confirm when hard is empty).

## Critical Implementation Details

**Gate then persist.** After `applyMutations`, call `acceptDecision` (same `gateByIsoWeek` + frozen-from-affected-weeks pattern as Accept). Frozen units for the decision must come from each persist Monday’s `listWeek`, not only the request week — otherwise a week-2 frozen anchor is invisible. Do not persist, then validate.

**Shared write.** Extract the Accept write loop (`mondaysToPersist` / `incomingForWeek` / `replaceWeek` / concatenated written units) so `sendMessage` and `acceptProposition` cannot drift. `acceptProposition` still loads a pending row, re-gates, then calls that helper. Auto-apply never goes through a pending row.

**Proposition rows.** On apply and on hard: `rejectPending` so an older pending cannot linger; do **not** `insertPending`. `listChat` then returns `proposition: null`. Do not insert `status: "accepted"` from Send. Log-only and explain-only stay as today (no proposition, no unit persist).

**HTTP.** Mutation Send stays **200** even when hard blocks. Body includes `validation`. Do not 409 on messages (that is Accept’s contract). The island must not `mergeReturnedUnits` unless `units` is present and `hard` is empty.

**No snapshot.** The shared persist calls `replaceWeek` only.

**Client.** `send()`: `applyChatBody`; if `validation.hard.length > 0`, set a hard-violations list for `PlanChat` and do not merge units; if applied, `mergeReturnedUnits`, `setWarnings(asSoft)`, `applyStack`, clear hard list. Remove `accept()` / `reject()` and their fetches.

---

## Phase 1: Auto-apply persist in `sendMessage`

### Overview

Share Accept’s keep-merge write. `sendMessage` persists when mutations pass hard bounds and never leaves a pending proposition for that turn.

### Changes Required:

#### 1. Shared persist helper

**File**: `src/lib/services/chat.ts`

**Intent**: One write path for Accept and auto-apply so 14-day keep-merge and leftover-delete rules cannot fork.

**Contract**: Helper used by `acceptProposition` (after a successful `acceptDecision`) and by `sendMessage` (when mutations exist and `acceptDecision` is ok). Same Mondays, keep-merge, and returned unit concatenation as today’s Accept. No `snapshotWeekIfChanged` / `insertRevision`.

#### 2. `sendMessage` gate + persist

**File**: `src/lib/services/chat.ts`

**Intent**: Send lands the week when hard is empty; hard and non-mutation turns do not write `training_units`.

**Contract**: After `applyMutations`, `acceptDecision` with frozen units from each persist Monday. Mutations + ok → persist, `rejectPending`, do not `insertPending`, include `units` and `validation` on `SendMessageResult` data. Mutations + hard → no persist, `rejectPending`, no `insertPending`, omit `units`, include `validation` (hard populated); still insert the assistant message; still `shouldCaptureHardBoundReport`. Zero mutations / log-only: unchanged aside from not inventing a pending row. `SendMessageResult` stays `ok: true` for these chat turns (errors remain weeklyKm / DB / log NOT_FOUND).

#### 3. Service tests

**Files**: `src/lib/services/chat.test.ts`, `src/lib/services/accept-proposition.test.ts`

**Intent**: Lock Risk #2 on the new landing gate; keep Accept persist-skip.

**Contract**: Memory-supabase `sendMessage` with a stub `complete` that returns mutations: empty-hard lands `training_units` and leaves no `status: "pending"`; hard volume (`sum > weeklyKm * 1.2`) leaves calendar unchanged and no pending; no `plan_revisions` row from either. Soft-band control lands. Explain (`mutations: []`) does not write units. Existing `acceptProposition` persist-skip + 14-day keep-merge tests still pass.

### Success Criteria:

#### Automated Verification:

- `sendMessage` with mutations and empty `hard` persists via the shared Accept keep-merge path; no `plan_propositions` row is `pending`; `plan_revisions` is unchanged
- `sendMessage` with mutations and non-empty `hard` does not change `training_units` and does not leave a pending proposition
- `sendMessage` with empty mutations or a log-only turn does not write `training_units`
- `acceptProposition` still persist-skips hard pending and still keep-merges 14-day Accept
- Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 2: Messages API returns applied week

### Overview

`POST /api/chat/messages` returns `units`, `validation`, and the revision stack when Send applied, so the island can merge without calling Accept.

### Changes Required:

#### 1. Messages response

**File**: `src/pages/api/chat/messages.ts`

**Intent**: Applied Send looks like today’s Accept payload (units + validation + stack) on the messages route; hard Send still 200 with validation and no units.

**Contract**: On `result.ok`, spread `result.data` as today. When `units` is present, also `readRevisionStack` and include `undoAvailable` + `revisions` (same fields as `accept.ts`). Always pass through `validation` when the service included it. Do not 409. Do not add snapshot writes. Auth/zod/`prerender = false` unchanged. `accept.ts` / `reject.ts` unchanged.

#### 2. Messages source-scan

**File**: `src/lib/services/chat.test.ts`

**Intent**: Lock the messages route contract in CI; `product-gates.test.ts` only covers 401 and would stay green if this payload were omitted.

**Contract**: `readFileSync` of `src/pages/api/chat/messages.ts` asserts `readRevisionStack`, `units`, `validation`, `undoAvailable`, and `revisions`, and asserts the file does not contain a 409 / `hardBounds` helper.

### Success Criteria:

#### Automated Verification:

- `messages.ts` calls `readRevisionStack` and returns `units`, `validation`, `undoAvailable`, and `revisions` when Send applied
- Hard Send remains HTTP 200 from this route (no `hardBounds` / 409 helper copied from `accept.ts`)
- Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/pages/api/product-gates.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 3: Chat UI applies on Send; drop Accept/Reject

### Overview

The Week island merges Send the way it merges Accept today. PlanChat loses the proposition card and the buttons. Soft → calendar amber; hard → red list in chat.

### Changes Required:

#### 1. `PlanWorkspace.send` merge

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: After Send, the month calendar shows the persisted week without a second POST.

**Contract**: In `send()`, after a 200: `applyChatBody` as today. If `validation.hard` is non-empty, set hard-violations state for PlanChat, do not `mergeReturnedUnits`, do not `setWarnings` from soft. If `units` is present (applied): `mergeReturnedUnits` (same helper and arguments as today’s `accept()`), `setWarnings(asSoft(body.validation))`, `applyStack(body)`, clear hard-violations. Remove `accept()`, `reject()`, and fetches to `/api/chat/accept` and `/api/chat/reject`. Stop passing `onAccept` / `onReject`. Purple `onGenerate` still `send(generateHorizonPrompt(...))`. Save snapshot / restore / generate wiring otherwise unchanged.

#### 2. `PlanChat` chrome

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: No confirm UI. Hard failures are a red list. Soft is not duplicated here.

**Contract**: Remove `proposition`, `onAccept`, `onReject`, the Proposed changes card, Accept, and Reject. Add a `hardViolations` list prop; when non-empty, render the existing red `text-red-200/90` messages (no amber list in this component). Do not render diffs. Helper copy, composer, heights, and Enter-to-send stay. Merge classes with `cn()`.

#### 3. Source-scan tests

**Files**: `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock the UI contract without Playwright.

**Contract**: PlanChat source does not contain `Proposed changes`, `onAccept`, `onReject`, or Accept/Reject buttons; does contain the red hard-list class. PlanWorkspace `send` uses `mergeReturnedUnits`; source does not `fetch("/api/chat/accept"` or `fetch("/api/chat/reject"`; still does not POST `/api/plan`; still sends the canned generate prompt. Keep existing layout/copy scans.

### Success Criteria:

#### Automated Verification:

- `PlanChat` has no Proposed changes card and no Accept/Reject; hard violations render in `text-red-200/90`
- `PlanWorkspace.send` merges returned units with `mergeReturnedUnits` and does not call `/api/chat/accept` or `/api/chat/reject`
- Unit tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` Calendar, Send (or the purple 14-day button with a live coach key) updates the month calendar with no Accept click; an amber calendar banner appears when the turn is soft-only
- A hard-bound coach turn leaves the calendar unchanged and shows a red violation list in Coach chat; Accept/Reject and Proposed changes are gone; Save snapshot / Profile / cell density unchanged

---

## Testing Strategy

### Unit Tests:

- `sendMessage` persist vs persist-skip (hard / soft / empty mutations) in `chat.test.ts`; no `plan_revisions` from this path.
- Source-scans: messages stack fields; PlanChat chrome; PlanWorkspace send merge and no accept/reject fetch.

### Integration Tests:

Memory-supabase as today. Keep `accept-proposition.test.ts` persist-skip (route still exists). `product-gates.test.ts` still covers accept/reject 401. Do not add Playwright.

### Manual Testing Steps:

1. Logged-in `/dashboard` Calendar: Send a passing change (or purple generate with a key); calendar updates; no Accept; soft → amber on the calendar.
2. Force a hard turn (e.g. huge km): calendar unchanged; red list in chat; no Proposed card.
3. Confirm Save snapshot, Profile, and cell density look as before.

## Performance Considerations

One extra `listWeek` per persist Monday already happens on Accept. Auto-apply does not add OpenAI calls.

## Migration Notes

None. No SQL. DEP-020 stays open. Stale `pending` rows from before this change are cleared on the next Send (`rejectPending`) and are no longer shown in the UI.

## References

- Change notes: `context/changes/chat-auto-apply/change.md`
- Prior persist: `src/lib/services/chat.ts` (`acceptProposition`, `mondaysToPersist`, `incomingForWeek`)
- Messages / Accept routes: `src/pages/api/chat/messages.ts`, `src/pages/api/chat/accept.ts`
- Island: `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/PlanChat.tsx`
- Test cookbook: `context/foundation/test-plan.md` §6 (Risk #2 persist-skip)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Auto-apply persist in `sendMessage`

#### Automated

- [x] 1.1 `sendMessage` with mutations and empty `hard` persists via the shared Accept keep-merge path; no `plan_propositions` row is `pending`; `plan_revisions` is unchanged — 55fca5e
- [x] 1.2 `sendMessage` with mutations and non-empty `hard` does not change `training_units` and does not leave a pending proposition — 55fca5e
- [x] 1.3 `sendMessage` with empty mutations or a log-only turn does not write `training_units` — 55fca5e
- [x] 1.4 `acceptProposition` still persist-skips hard pending and still keep-merges 14-day Accept — 55fca5e
- [x] 1.5 Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts` — 55fca5e
- [x] 1.6 Full suite passes: `npm test` — 55fca5e
- [x] 1.7 Lint passes: `npm run lint` — 55fca5e

### Phase 2: Messages API returns applied week

#### Automated

- [x] 2.1 `messages.ts` calls `readRevisionStack` and returns `units`, `validation`, `undoAvailable`, and `revisions` when Send applied — 35465f7
- [x] 2.2 Hard Send remains HTTP 200 from this route (no `hardBounds` / 409 helper copied from `accept.ts`) — 35465f7
- [x] 2.3 Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/pages/api/product-gates.test.ts` — 35465f7
- [x] 2.4 Full suite passes: `npm test` — 35465f7
- [x] 2.5 Lint passes: `npm run lint` — 35465f7

### Phase 3: Chat UI applies on Send; drop Accept/Reject

#### Automated

- [x] 3.1 `PlanChat` has no Proposed changes card and no Accept/Reject; hard violations render in `text-red-200/90` — ea643cf
- [x] 3.2 `PlanWorkspace.send` merges returned units with `mergeReturnedUnits` and does not call `/api/chat/accept` or `/api/chat/reject` — ea643cf
- [x] 3.3 Unit tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — ea643cf
- [x] 3.4 Full suite passes: `npm test` — ea643cf
- [x] 3.5 Lint passes: `npm run lint` — ea643cf

#### Manual

- [x] 3.6 On `/dashboard` Calendar, Send (or the purple 14-day button with a live coach key) updates the month calendar with no Accept click; an amber calendar banner appears when the turn is soft-only
- [x] 3.7 A hard-bound coach turn leaves the calendar unchanged and shows a red violation list in Coach chat; Accept/Reject and Proposed changes are gone; Save snapshot / Profile / cell density unchanged
