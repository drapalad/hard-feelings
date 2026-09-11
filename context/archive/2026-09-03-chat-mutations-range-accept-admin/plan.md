# Coach chat: optimistic send, admin flag, range context, and profile/freeze accept Implementation Plan

## Overview

Implement four tightly coupled chat improvements in the requested order: optimistic send UX, member "Flag for admin", date-range coach context, and accept-required profile/freeze changes. Calendar km/type mutations keep today's auto-apply behavior; only profile/freeze edits become pending review.

## Current State Analysis

`sendMessage` in `src/lib/services/chat.ts` stores the user message, runs one or two propose passes, auto-applies calendar mutations when hard bounds pass, and returns `loadedKeys: string[]`. The first OpenAI pass always receives week JSON, races, and last-14-day logs; the optional second pass is keyed by `dataRequestKeys` from `src/lib/services/openai-chat.ts`. `PlanWorkspace.send` waits for the full response before rendering the user bubble, and `PlanChat` renders only server-backed `messages`, a loaded-keys chip, and hard-bound violations.

Admin reports exist already: `insertAgentReport()` writes `agent_reports`, `listAgentReports()` powers `/admin`, and `markAgentReportReviewed()` flips `status` without any member notification path. Member chat has no manual gap-report control; only hard-bound auto-capture writes `kind: "algorithm_proposal"`.

Profile preferences already live on `profiles`, and freeze state already lives on `training_units.frozen`. The old generic "pending proposition" layer still exists as `plan_propositions`, but after `chat-auto-apply` it no longer drives the member chat UI. Reusing it for profile/freeze would mix two different workflows: auto-applied calendar diffs and accept-required non-calendar patches. `createMemorySupabase()` also does not know about a pending profile/freeze table yet, so any new persistence needs matching test support.

## Desired End State

Sending a chat message immediately shows the user's bubble and a visible assistant placeholder while the server works. If the turn succeeds, the transcript swaps to the canonical server `messages`; if it fails, the user bubble stays, the thinking row disappears, and the error shows through the existing `ServerError` surface.

Members can flag the last assistant reply for admin review, which inserts an open `kind: "gap"` report derived from that turn and flips the local control to `Reported to admin`. Coach data loading becomes range-based: the first completion sees profile plus a compact 7-day current-load summary, may request an inclusive `{ from, to }` window up to 70 days, and the UI chip reads `Loaded: 3 Sep–12 Nov`.

Calendar-only chat edits still auto-apply on Send. When the coach proposes profile or freeze changes, those non-calendar changes are stored as pending work instead of applying immediately. The member sees a review card titled exactly `Accept profile & freeze changes` with `Accept` and `Dismiss`; Accept persists the profile through the existing profile service, applies frozen/unfrozen dates on `training_units`, clears the pending row, and leaves ordinary km/type chat edits unchanged.

### Key Discoveries:

- `sendMessage()` already has the right orchestration point for all four features: it sees the raw turn, loaded extra context, hard-bound validation, and both chat messages before the response is returned.
- `openai-chat.ts` currently couples the model contract to `dataRequest.keys` plus the first-pass `Week JSON`; both must change together so the tests and prompt stay aligned.
- `PlanWorkspace.tsx` owns the week/month state merge and is the right place for optimistic rows, loaded range state, and pending profile/freeze review state; `PlanChat.tsx` should stay presentational.
- `plan_propositions` is still week-scoped pending plan JSON. Profile/freeze accept work needs to coexist with auto-applied calendar writes, so a dedicated `chat_profile_freeze_pending` table is the narrowest storage with the least semantic overload.
- `/api/chat/accept.ts` already handles the authenticated accept path and revision-stack response shape. Reusing that route for profile/freeze acceptance keeps the UI wiring narrower than adding a second accept endpoint.
- The existing admin review flow already satisfies "do not notify the member when Reviewed"; no new eventing path needs to be suppressed.

## What We're NOT Doing

- Requiring Accept for ordinary km/type chat mutations.
- Restoring the old generic proposition review card for all chat turns.
- Adding a `chat_messages` column for "flagged" state or any new notification/email path.
- Changing the project-wide LLM model picker, `loadOpenAiModel()`, or the visible admin review workflow beyond showing the new gap reports in the existing list.
- Persisting a new week-scoped chat-message range table or changing `chat_messages` schema for range loads.
- Replacing the real two-step complete with a UI mock or client-side fake.
- Changing `SetupForm` layout or teaching plan generation/validators to consume the new profile/freeze pending data before Accept.
- Deleting `plan_propositions`, `acceptProposition()`, or the remaining accept-layer code in this change; FU-125 already tracks that follow-up.

## Implementation Approach

Deliver the bundled change in four phases that mirror the locked order and keep the state transitions isolated:

1. Add optimistic transcript state in `PlanWorkspace` and render pending/thinking rows in `PlanChat`.
2. Add a member-side report API plus last-assistant flag control, reusing `insertAgentReport()` and the existing admin list.
3. Replace key-based coach extra loading with a validated date-range contract, including first-pass prompt changes, server-side clamping/validation, follow-up fetch, `loadedRange`, and chip formatting.
4. Extend the propose contract with optional profile/freeze patches, persist them in a dedicated pending table, surface a review card, and reuse `/api/chat/accept` to apply/clear them.

The dedicated pending table stores only the accept-required non-calendar patch (`profile`, `freeze`, `unfreeze`) plus week/user identity. Calendar mutations remain on the current Send path and still hard-gate through `acceptDecision()`.

## Critical Implementation Details

### State sequencing

Optimistic send must be client-only state, not a second API write. `PlanWorkspace.send()` should append a temporary user message and thinking marker before `fetch()`, clear the textarea immediately through `PlanChat`, and then either replace the whole transcript from the response or keep the optimistic user message on error. The placeholder must not survive success or failure.

### Range follow-up contract

Validate the model-requested range before any second completion. Invalid dates or `from > to` mean: skip the extra fetch, skip the second completion, keep `loadedRange: null`, and continue from the first completion. A too-long valid span is clamped server-side to 70 inclusive UTC days before fetching and before echoing `loadedRange`.

### Accept boundary

Profile/freeze accept must be independent of calendar auto-apply and of hard-bound validation on ordinary mutations. `sendMessage()` may therefore return both: applied calendar `units`/`validation` for the current turn and a `pendingProfileFreeze` payload that still needs member confirmation. Accepting the pending patch must not rerun the LLM or reapply calendar diffs.

### Persistence split

Use a dedicated table, `chat_profile_freeze_pending`, with one pending row per `(user_id, week_start)` and RLS matching the existing member-owned tables. This keeps `plan_propositions` semantics intact and avoids encoding nullable non-calendar patches into a row shape built around `proposed_units` + validator output.

### Freeze target rules

Pending freeze/unfreeze dates must resolve only against existing member-owned `training_units` rows. Normalize duplicates away, reject or drop dates that are not valid UTC dates, and never create a unit solely because a pending freeze patch named that date. If the sanitized patch has neither a profile change nor any valid freeze/unfreeze targets, do not persist a pending row or show the review card.

## Phase 1: Optimistic send transcript

### Overview

Show the member's message immediately, add an assistant thinking placeholder while busy, and preserve the optimistic user bubble on HTTP error.

### Changes Required:

#### 1. Workspace optimistic state

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Keep pending transcript state local to the island so the UI can respond immediately without changing the server API.

**Contract**: Add local state for a pending user message and a thinking-row flag; `send()` trims the outgoing content, appends the pending user message immediately, clears loaded range/error, and starts busy mode. On success, replace transcript state from the response and clear both optimistic rows. On non-OK response, keep the pending user bubble, clear the thinking row, and surface `ServerError`. Do not issue extra POSTs or fixed-delay timers.

#### 2. Presentational transcript support

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: Render optimistic rows and loading affordances accessibly without taking ownership of fetch state.

**Contract**: Accept pending user message data and a `showThinking` flag from `PlanWorkspace`. Render the transcript container with `aria-busy` while thinking, and render an assistant placeholder with `aria-live="polite"`, visible pulse/dots styling, and exact text `Coach is thinking`. Keep textarea disabled while `busy` is true. Success still renders only canonical `messages`; error still uses `ServerError`.

#### 3. Source-scan tests

**Files**: `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock the optimistic behavior and accessibility markers in CI without a browser suite.

**Contract**: Assert the workspace keeps a pending user row during send, clears the textarea immediately, and renders a thinking placeholder instead of waiting for the server transcript. Assert `aria-busy`, `aria-live="polite"`, and exact `Coach is thinking` text are present. Keep existing layout and helper-copy checks unless superseded by later phases.

### Success Criteria:

#### Automated Verification:

- `PlanWorkspace.send()` stores trimmed pending content immediately, clears loaded-range state, and preserves the pending user bubble on HTTP error
- `PlanChat` renders `Coach is thinking` with `aria-live="polite"` and marks the transcript `aria-busy` while waiting
- Unit tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard`, sending a chat message shows the member bubble immediately and a visible assistant thinking row before the response lands
- If the chat request fails, the member bubble remains, the thinking row disappears, and the existing red error surface appears

---

## Phase 2: Member flag-for-admin flow

### Overview

Let members flag the last assistant response for admin review without depending on hard bounds, while keeping the existing hard-bound auto-capture unchanged.

### Changes Required:

#### 1. Gap-report builder and insert path

**Files**: `src/lib/services/agent-report.ts`, `src/lib/services/chat.ts`

**Intent**: Reuse the existing report service for member-filed gaps instead of inventing a new report storage path.

**Contract**: Add a helper that builds a `kind: "gap"`, `status: "open"` report from the current turn, using the member id, week start, assistant reply, and optional user prompt text for title/body derivation. Keep `buildHardBoundReport()` and `shouldCaptureHardBoundReport()` unchanged for hard-bound auto-capture. Add a chat-service function that validates the last assistant message context and calls `insertAgentReport()`.

#### 2. Member report endpoint

**File**: `src/pages/api/chat/report.ts` (new)

**Intent**: Keep the member action in the chat API namespace rather than overloading the admin-only listing route.

**Contract**: `POST /api/chat/report` requires auth, validates `{ weekStart, messageId }`, confirms the referenced assistant message belongs to the caller/week and is the latest assistant turn, inserts the gap report, and returns `{ ok: true }`. Errors use existing JSON patterns (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_FOUND`, `DB_ERROR`). Do not notify the member on later review.

#### 3. Chat flag control

**Files**: `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: Surface a muted control only on the last assistant message and flip it locally after success.

**Contract**: `PlanWorkspace` tracks session-local reported message ids and posts to `/api/chat/report`. `PlanChat` renders `Flag for admin` only under the last assistant message when it has not been reported in this session; after a successful post, replace it with exact text `Reported to admin`. While the report request is in flight, disable repeat submits. Do not add a persistent flagged marker to `chat_messages`.

#### 4. Admin list compatibility

**File**: `src/components/admin/AdminReports.tsx`

**Intent**: Ensure the existing admin list presents the new gap reports naturally.

**Contract**: Keep the current list/review flow, but make sure the UI copy is no longer phrased as only algorithm-improvement items when `kind: "gap"` rows are present. Reviewed still changes only the admin-side row state.

#### 5. Tests

**Files**: `src/lib/services/chat.test.ts`, `src/pages/api/chat/report.test.ts` (new), `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock member-report creation and UI affordance.

**Contract**: Service/API tests cover successful gap insertion from a last assistant turn, rejection of unknown/non-latest/non-assistant message ids, 401 for logged-out requests, and preservation of hard-bound auto-capture. UI tests assert the last assistant message shows `Flag for admin`, that the text flips to `Reported to admin` after success, and that the control does not appear on older assistant messages or user messages.

### Success Criteria:

#### Automated Verification:

- Member flagging inserts an open `kind: "gap"` report derived from the selected last assistant turn without requiring hard bounds
- Hard-bound auto-capture still inserts `kind: "algorithm_proposal"` on qualifying mutation turns
- `PlanChat` shows `Flag for admin` only on the last assistant message and flips to `Reported to admin` after success
- Unit tests pass for chat/admin flagging paths
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- From member chat, flagging the latest assistant reply removes the control and leaves `Reported to admin`
- On `/admin`, the existing report list shows the new row as an open report and Review works without any member-facing notification

---

## Phase 3: Date-range coach context

### Overview

Replace key-based extra loading with a validated date-range request and shift first-pass coach context away from the visible week JSON toward profile plus current load.

### Changes Required:

#### 1. OpenAI propose schema and prompt

**File**: `src/lib/services/openai-chat.ts`

**Intent**: Align the model contract with the new two-step range flow.

**Contract**: Replace `dataRequest.keys` with `dataRequest: { from, to } | null`, where both dates are UTC `YYYY-MM-DD`. The first-pass system prompt must stop including week JSON / `weekStart` units as primary context and instead include: the existing create-horizon rules, profile JSON, and a compact current-load summary with planned km and logged km over the last 7 UTC days. Follow-up prompt text should mention loaded range context and set `dataRequest` back to null. Export parsing/validation helpers as needed for chat-service tests.

#### 2. Range fetch orchestration

**File**: `src/lib/services/chat.ts`

**Intent**: Validate, clamp, fetch, and follow up on range requests in one server-side flow.

**Contract**: `completeSendTurn()` interprets `dataRequest` as a range, validates date shape/inversion, clamps valid spans longer than 70 inclusive days, fetches units and logs for that range (with races optional), and runs at most one follow-up completion. Invalid or inverted ranges skip the second completion entirely and leave `loadedRange: null`. If the second completion throws after a valid range fetch, fail closed exactly like `coach-data-request-fail-closed`: unavailable reply, no mutations applied, no chip.

#### 3. Messages route response

**File**: `src/pages/api/chat/messages.ts`

**Intent**: Surface `loadedRange` instead of `loadedKeys`.

**Contract**: Replace `loadedKeys` in the response contract with `loadedRange: { from, to } | null`. Preserve the existing applied-units and revision-stack behavior from `chat-auto-apply`. No new endpoint or new persisted table.

#### 4. Range chip and helper copy

**Files**: `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: Show a human date span under the last assistant message and stop implying the visible week is preloaded.

**Contract**: `PlanWorkspace` stores `loadedRange` from the response, clears it on new send/month loads, and passes it into `PlanChat`. `formatLoadedChip()` accepts the range object and formats exact `Loaded: D Mmm–D Mmm` output, omitting years when both ends share one year. Update the locked helper copy so it says the coach starts from profile + current load rather than from "the next 10–14 days" or this week's visible calendar.

#### 5. Tests

**Files**: `src/lib/services/openai-chat.test.ts`, `src/lib/services/chat.test.ts`, `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Cover the prompt contract, range validation/clamping, fail-closed second pass, and UI chip formatting.

**Contract**: Tests assert the first prompt no longer contains week JSON / `logs_42d` / `prior_plan_14d`, does contain profile + current-load summary, parses range `dataRequest`, clamps overlong spans, skips second completion on invalid/inverted dates, and returns `loadedRange` only for valid follow-ups. UI tests lock the new helper copy and date-range chip format.

### Success Criteria:

#### Automated Verification:

- `completeOpenAiPropose()` parses `dataRequest: { from, to } | null` and the first-pass prompt no longer uses week JSON as the default context payload
- `completeSendTurn()` validates/clamps ranges, runs at most one follow-up, skips invalid/inverted ranges, and fail-closes when the second completion throws
- `POST /api/chat/messages` returns `loadedRange` instead of `loadedKeys`
- `PlanChat.formatLoadedChip()` renders a human date span such as `Loaded: 3 Sep–12 Nov`
- Unit tests pass: `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- A coach turn that requests extra context shows a date-range chip under the last assistant message rather than a list of keys
- The chat helper copy no longer implies the visible week is already in the coach's context

---

## Phase 4: Accept profile & freeze changes

### Overview

Let the coach propose profile/freeze changes in the same turn as ordinary chat edits, but require explicit member acceptance before those non-calendar changes land.

### Changes Required:

#### 1. Pending patch migration

**File**: `supabase/migrations/20260903123000_chat_profile_freeze_pending.sql`

**Intent**: Persist accept-required non-calendar patches separately from `plan_propositions`.

**Contract**: Create `chat_profile_freeze_pending` with columns for `id`, `user_id`, `week_start`, `profile_patch jsonb null`, `freeze_dates text[] not null default '{}'`, `unfreeze_dates text[] not null default '{}'`, `status text not null` (`pending`, `accepted`, `dismissed`), and timestamps. Add one-pending-per-week unique index for `status = 'pending'`, enable RLS, and add owner-only select/insert/update/delete policies mirroring `plan_propositions`. Comment that Worker rollback does not undo this SQL. Update the migration-safety filename list so the new migration is part of the default safety harness, and record hosted apply as a new `DEP-*` item instead of pushing SQL in this change.

#### 2. Propose schema

**File**: `src/lib/services/openai-chat.ts`

**Intent**: Expand the LLM result contract to include profile/freeze proposals without changing ordinary mutation behavior.

**Contract**: Extend the JSON schema/parser with optional `profile`, `freeze`, and `unfreeze` fields. `profile` may patch only `weeklyKm`, `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, and `mixSpeed`. `freeze`/`unfreeze` are date arrays. The system prompt must stop telling the coach it cannot change frozen units in the "member preference" sense: it still must not mutate a frozen unit directly, but it may propose future freeze/unfreeze lists in the new fields.

#### 3. Chat-service pending patch flow

**File**: `src/lib/services/chat.ts`

**Intent**: Separate auto-applied calendar mutations from accept-required profile/freeze patches in one send result.

**Contract**: Extend the parsed propose result and `SendMessageResult` with `pendingProfileFreeze`. Calendar km/type mutations keep today's apply/hard-bound path. If a turn includes profile and/or freeze arrays, sanitize the profile patch against the known profile fields and sanitize freeze/unfreeze arrays down to valid UTC dates that already exist as this member's `training_units`; do not apply those changes during Send. Upsert a pending row in `chat_profile_freeze_pending` and return a normalized pending payload for the UI only when something remains after sanitization. Send should still apply calendar mutations from the same turn when allowed. Dismiss clears the pending row by setting `status: "dismissed"` (or equivalent clear helper) without changing profile/frozen state.

#### 4. Accept/dismiss APIs

**Files**: `src/pages/api/chat/accept.ts`, `src/pages/api/chat/messages.ts` (response shape), `src/pages/api/chat/dismiss.ts` (new)

**Intent**: Reuse the existing accept path for the new pending patch while keeping messages/send as the creator of pending work.

**Contract**: `/api/chat/accept` accepts the pending profile/freeze patch for the given week, writes profile changes through the existing profile service, updates `training_units.frozen` only for the sanitized member-owned dates stored on the pending row, marks the pending row accepted, and returns the refreshed week state needed by the workspace. `POST /api/chat/dismiss` clears the pending profile/freeze row for the week by marking it dismissed and returns `{ ok: true }`; it must not touch calendar/profile state. `messages.ts` must include `pendingProfileFreeze` in send responses when present.

#### 5. Review card UI

**Files**: `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`

**Intent**: Show a real review card only for turns that proposed profile/freeze changes.

**Contract**: `PlanWorkspace` stores `pendingProfileFreeze`, wires `Accept` and `Dismiss`, and refreshes/clears the card after each action. `PlanChat` renders a card titled exactly `Accept profile & freeze changes`, summarizing the patch in human-readable rows (weekly km, long/rest weekdays, mix values, freeze dates, unfreeze dates) with `Accept` and `Dismiss` buttons. Plan-only turns must not render this card. Ordinary Send remains disabled while busy, but accept/dismiss can use their own small busy state.

#### 6. Tests

**Files**: `src/lib/services/openai-chat.test.ts`, `src/lib/services/chat.test.ts`, `src/pages/api/chat/accept.test.ts` (extend), `src/pages/api/chat/dismiss.test.ts` (new), `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`, `src/lib/test/migration-safety.test.ts`, `context/deployment/deferred.md`

**Intent**: Lock the split between auto-applied calendar edits and accept-required profile/freeze changes.

**Contract**: Tests cover: schema parsing for `profile`/`freeze`/`unfreeze`; send storing a pending row and returning `pendingProfileFreeze` without changing profile/frozen state; invalid/nonexistent freeze dates being dropped before persist; plan-only turns not returning the card; accept applying profile service updates and freeze flips; dismiss clearing the pending row only; the migration-safety harness expecting the new SQL filename; and a new open `DEP-*` line for hosted apply. Update memory-supabase support for the new table so these tests stay real service/API tests rather than mocks.

### Success Criteria:

#### Automated Verification:

- Migration `20260903123000_chat_profile_freeze_pending.sql` exists with owner RLS and one-pending-per-week semantics
- Chat send returns `pendingProfileFreeze` for profile/freeze turns, but ordinary calendar mutations still auto-apply without Accept
- Accept applies profile updates via the existing profile service and updates `training_units.frozen`; Dismiss clears the pending row without applying it
- `PlanChat` renders the exact `Accept profile & freeze changes` card only when a pending profile/freeze patch exists
- `src/lib/test/migration-safety.test.ts` expects the new migration filename and `context/deployment/deferred.md` records hosted apply as an open `DEP-*`
- Unit tests pass for openai/chat/workspace/profile-freeze accept paths
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- After a coach turn proposing profile or freeze changes, the review card appears with `Accept` and `Dismiss`
- Accept applies the profile/freeze changes and removes the card; Dismiss removes the card without changing profile/frozen state
- A plan-only chat edit still lands immediately without showing the review card

## Testing Strategy

### Unit Tests:

- Prompt/schema coverage in `openai-chat.test.ts` for range requests and profile/freeze proposal fields.
- Chat-service tests for optimistic-independent send results, report insertion, range validation/clamping, pending profile/freeze persistence, and accept/dismiss application.
- Source-scan tests for `PlanChat`/`PlanWorkspace` UI contracts, including helper copy, chip formatting, optimistic rows, flag control, and review card text.

### Integration Tests:

- Memory-supabase-backed API/service tests for `/api/chat/report`, `/api/chat/messages`, `/api/chat/accept`, and `/api/chat/dismiss` with the new pending table added to the in-memory store.
- Keep existing hard-bound auto-capture and chat auto-apply tests green to prove this bundle did not regress the north-star path.

### Manual Testing Steps:

1. Send a normal chat turn and confirm optimistic user/thinking rows appear immediately, then settle to the server transcript.
2. Flag the latest assistant reply and confirm the control flips locally; verify the row appears in `/admin`.
3. Trigger a range-loaded turn and confirm the chip shows a human date span and helper copy reflects profile + current load.
4. Trigger a profile/freeze proposal, confirm the review card appears, then test both `Accept` and `Dismiss`.
5. Send a plan-only mutation afterward and confirm it still auto-applies with no review card.

## Performance Considerations

The new range flow replaces key-based extras with at most one bounded range fetch and one follow-up completion, which preserves today's "two LLM calls max" contract. Optimistic send is client-only state. The new pending profile/freeze table is one small row per week/user at most and does not add work to plan-only turns.

## Migration Notes

This bundle introduces one new migration: `20260903123000_chat_profile_freeze_pending.sql`. Hosted apply is separate operator work and should be recorded in `context/deployment/deferred.md` during implementation; do not run hosted SQL from this change. The existing `plan_propositions` table remains in place for compatibility until FU-125 is taken.

## References

- `context/changes/chat-mutations-range-accept-admin/change.md`
- `context/archive/2026-09-02-chat-auto-apply/plan.md`
- `context/archive/2026-09-02-coach-data-request-fail-closed/plan.md`
- `context/archive/2026-09-02-profile-plan-prefs/plan.md`
- `context/archive/2026-08-31-admin-report-capture-research/research.md`
- `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Optimistic send transcript

#### Automated

- [x] 1.1 `PlanWorkspace.send()` stores trimmed pending content immediately, clears loaded-range state, and preserves the pending user bubble on HTTP error — e8c424f
- [x] 1.2 `PlanChat` renders `Coach is thinking` with `aria-live="polite"` and marks the transcript `aria-busy` while waiting — e8c424f
- [x] 1.3 Unit tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — e8c424f
- [x] 1.4 Full suite passes: `npm test` — e8c424f
- [x] 1.5 Lint passes: `npm run lint` — e8c424f

#### Manual

- [ ] 1.6 On `/dashboard`, sending a chat message shows the member bubble immediately and a visible assistant thinking row before the response lands
- [ ] 1.7 If the chat request fails, the member bubble remains, the thinking row disappears, and the existing red error surface appears

### Phase 2: Member flag-for-admin flow

#### Automated

- [x] 2.1 Member flagging inserts an open `kind: "gap"` report derived from the selected last assistant turn without requiring hard bounds — 9ce7234
- [x] 2.2 Hard-bound auto-capture still inserts `kind: "algorithm_proposal"` on qualifying mutation turns — 9ce7234
- [x] 2.3 `PlanChat` shows `Flag for admin` only on the last assistant message and flips to `Reported to admin` after success — 9ce7234
- [x] 2.4 Unit tests pass for chat/admin flagging paths — 9ce7234
- [x] 2.5 Full suite passes: `npm test` — 9ce7234
- [x] 2.6 Lint passes: `npm run lint` — 9ce7234

#### Manual

- [ ] 2.7 From member chat, flagging the latest assistant reply removes the control and leaves `Reported to admin`
- [ ] 2.8 On `/admin`, the existing report list shows the new row as an open report and Review works without any member-facing notification

### Phase 3: Date-range coach context

#### Automated

- [x] 3.1 `completeOpenAiPropose()` parses `dataRequest: { from, to } | null` and the first-pass prompt no longer uses week JSON as the default context payload — edfad67
- [x] 3.2 `completeSendTurn()` validates/clamps ranges, runs at most one follow-up, skips invalid/inverted ranges, and fail-closes when the second completion throws — edfad67
- [x] 3.3 `POST /api/chat/messages` returns `loadedRange` instead of `loadedKeys` — edfad67
- [x] 3.4 `PlanChat.formatLoadedChip()` renders a human date span such as `Loaded: 3 Sep–12 Nov` — edfad67
- [x] 3.5 Unit tests pass: `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — edfad67
- [x] 3.6 Full suite passes: `npm test` — edfad67
- [x] 3.7 Lint passes: `npm run lint` — edfad67

#### Manual

- [ ] 3.8 A coach turn that requests extra context shows a date-range chip under the last assistant message rather than a list of keys
- [ ] 3.9 The chat helper copy no longer implies the visible week is already in the coach's context

### Phase 4: Accept profile & freeze changes

#### Automated

- [x] 4.1 Migration `20260903123000_chat_profile_freeze_pending.sql` exists with owner RLS and one-pending-per-week semantics — 0effbe4
- [x] 4.2 Chat send returns `pendingProfileFreeze` for profile/freeze turns, but ordinary calendar mutations still auto-apply without Accept — 0effbe4
- [x] 4.3 Accept applies profile updates via the existing profile service and updates `training_units.frozen`; Dismiss clears the pending row without applying it — 0effbe4
- [x] 4.4 `PlanChat` renders the exact `Accept profile & freeze changes` card only when a pending profile/freeze patch exists — 0effbe4
- [x] 4.5 Unit tests pass for openai/chat/workspace/profile-freeze accept paths — 0effbe4
- [x] 4.6 Full suite passes: `npm test` — 0effbe4
- [x] 4.7 Lint passes: `npm run lint` — 0effbe4

#### Manual

- [ ] 4.8 After a coach turn proposing profile or freeze changes, the review card appears with `Accept` and `Dismiss`
- [ ] 4.9 Accept applies the profile/freeze changes and removes the card; Dismiss removes the card without changing profile/frozen state
- [ ] 4.10 A plan-only chat edit still lands immediately without showing the review card
