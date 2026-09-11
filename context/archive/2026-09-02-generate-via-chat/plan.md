# Generate next 14 days via coach chat Implementation Plan

## Overview

Retarget the purple calendar button from algorithmic `POST /api/plan` to a coach chat turn that lays out or regenerates UTC today through today+13 (inclusive), keep frozen dates, and let the model **create** units in that window. Ungate the composer on an empty week. Leave `generatePlan` / `POST /api/plan` in the repo unused from this UI.

## Current State Analysis

`generatePlanButtonLabel(busy, hasUnits)` in `src/components/plan/plan-month.ts` is **Working...** / **Regenerate week** / **Generate plan**, keyed off `weekHasUnits(units, weekStart)` (active ISO week). `PlanCalendar` passes that into the purple button. `PlanWorkspace.generate()` POSTs `/api/plan` `{ weekStart }` and `mergeWeekSlice`s the returned week.

Chat is week-scoped: `sendMessage` `listWeek`s that Monday, returns `PLAN_EMPTY` when the week has no units, and stores messages/propositions on `week_start`. `sanitizeProposeResult` drops mutations whose date is not already in `units`. `applyMutations` skips unknown dates (no insert). `systemPrompt` says only mutate dates that exist. `acceptProposition` `replaceWeek`s one Monday; leftover dates in that ISO week with no incoming row are **deleted**. `validatePlan` sums **all** `plan.units` against one `weeklyKm` — a 14-day blob treated as one week would hard-fail volume.

Composer: `PlanChat` disables textarea/Send when `unitsEmpty`; copy is “Ask about a day…” plus “Generate a plan for this week before chatting.” Accept/Reject remain.

Fala 1 toolbar (Save snapshot, Restore) and races overlay stay. Vitest is Node-only; UI contracts are `readFileSync` source-scans. Playwright is not a suite.

## Desired End State

Purple button still there. Busy → **Working...**; else if any unit date is in UTC today … today+13 → **Regenerate next 14 days**; else **Generate next 14 days**. Click does not POST `/api/plan`. It starts a coach turn equivalent to sending a lay-out/regenerate prompt for that horizon (member does not type it). Busy is the same shared flag as Send.

Composer works on an empty week. No `PLAN_EMPTY`. Helper: `Ask the coach to lay out the next 10–14 days.` plus a short second line about asking what a day is for / logging.

The model may create units on dates in the horizon. Sanitize keeps those mutations even when no unit exists yet. `applyMutations` inserts when `type` and `distanceKm` are set (skips frozen). After Accept, two week-rows on the month can show new units. Dates outside the horizon are not wiped. Accept/Reject stay (no auto-apply).

### Key Discoveries:

- `replaceWeek` (`src/lib/services/plan.ts`) upserts only `weekDates(weekStart)` and **deletes leftover** dates in that ISO week. A naive persist of a 14-day proposed set on the visible Monday would delete e.g. Monday when today is Wednesday (`replaceWeek` leftover = dates in the week not in incoming).
- `validatePlan` totals every unit in the plan against one weekly target. Gating a 14-day `applyMutations` result as a single `Plan` would almost always `WEEKLY_VOLUME_EXCEEDED` hard.
- `proposeAdaptation` re-sanitizes LLM output with `input.units` only. If create-horizon is not passed through, creates that `completeOpenAiPropose` kept will be dropped on the second sanitize.
- Chat GET/messages stay keyed to workspace `weekStart`. Generate must still `send()` on that week so the turn appears in the open Coach chat (`applyChatBody`).
- `listRange` already exists; `addUtcDays` / `inclusiveIsoDates` / `utcToday` are the date primitives. No new route.
- Stub `proposeAdaptation` must **not** emit a hardcoded 14-day fill (locked). Without `OPENAI_API_KEY`, the button still sends a turn; the stub help reply / empty mutations is existing keyed-off behavior (FU-008).

## What We're NOT Doing

- Deleting `generatePlan.ts` or `POST /api/plan`; not extending `GenerateInput` with a 14-day algorithmic fill.
- Hardcoded 14-day calendar fixtures (including a stub that invents a full fortnight).
- Profile, races overlay, cell density, snapshot POST, List tab.
- Honoring long-run / rest / mix prefs in generate or chat.
- Auto-apply (`chat-auto-apply`); removing Accept/Reject.
- Switching visible month/week on click; new chat tables or 14-day `week_start`.
- Playwright / jsdom / Testing Library; `"use client"`; concatenating Tailwind strings.
- Stamping roadmap done, writing `lessons.md`, closing FU-094–116 or DEP-020.

## Implementation Approach

Keep chat storage on the visible `weekStart`. Widen **propose/apply/sanitize** to a date horizon (UTC today … today+13) so the model can create in that window. Persist Accept by ISO week with an explicit merge so dates outside the horizon in an overlapping week are kept. Validate volume **per ISO week**, not on a 14-day blob. Retarget the purple button to the existing `send()` path with a canned user message.

LOCKED: files and behaviors in `change.md` Notes.

## Critical Implementation Details

**Horizon.** `from = utcToday()`, `to = addUtcDays(from, 13)` (14 inclusive dates). Button label and create-allowlist use this window, not `weekHasUnits(units, weekStart)` alone.

**Sanitize allowlist.** Keep a mutation if `date` is already in `units` **or** `date` is in the horizon. Drop dates in neither. Log still requires an existing unit date (do not create via log). Pass `{ createFrom, createTo }` into `sanitizeProposeResult` and through `ProposeInput` / `LlmProposeRequest` so the second sanitize in `proposeAdaptation` cannot strip creates. Default when omitted: no extra create dates (existing tests stay valid).

**Insert.** `applyMutations`: if no row for `date` and both `type` and `distanceKm` are set, insert `{ date, type, distanceKm, frozen: false }` plus `structure` when provided. If the existing row is `frozen`, skip. Incomplete creates (missing type or km) skip. Existing non-frozen dates keep today’s patch behavior.

**Prompt.** System prompt: may **create** on horizon dates; do not change frozen; do not emit a full replacement of dates outside the horizon. Include `createFrom`/`createTo` in the prompt text. User canned message from the button (exact strings in Phase 3): generate vs regenerate variants so the transcript matches the button.

**Propose unit set.** `sendMessage` loads `listWeek(weekStart)` **union** `listRange(createFrom, createTo)` (dedupe by date) so current-week chat still sees that week and the model sees existing horizon units (including next week). Drop the `units.length === 0` `PLAN_EMPTY` branch and remove `PLAN_EMPTY` from `SendMessageResult`.

**Validate per ISO week.** After `applyMutations`, group proposed units by `utcMondayOf(date)`. For each Monday, `validatePlan` / `gateAccept` that week’s units against `weeklyKm` and frozen units in that week. Concatenate hard/soft for the stored proposition. Do not pass the 14-day array into a single `validatePlan`.

**Accept persist.** Do not `replaceWeek(weekStart, proposedUnits)` when proposed dates span multiple weeks or a partial week. Persist **two sets** of Mondays:

1. **Request week** (`utcMondayOf(weekStart)`): always write it so ordinary chat Accept still lands. If that ISO week overlaps the horizon, keep-merge (below). If it does not overlap (visible week entirely outside today…today+13), `replaceWeek` with the proposed slice for that week only — today’s behavior.
2. **Other Mondays** that have at least one proposed unit whose date is **in the horizon**: keep-merge so week 2 creates land.

**Keep-merge:** `existing = listWeek(monday)`; `incoming = existing.filter(date outside horizon) ∪ proposed.filter(date in that ISO week)`; then `replaceWeek(monday, incoming)`. Never leftover-delete a date outside the horizon.

**Frozen at Accept:** `acceptDecision` / `gateAccept` must use frozen units from **each affected week’s** `listWeek`, not only `listWeek(request weekStart)`. Week-2 frozen anchors would otherwise be invisible and could be overwritten.

Return all persisted units from weeks written so the client can merge more than one week-row. Accept does not snapshot today (`acceptProposition` only `replaceWeek`s); do not add a 14-day revision table.

**Client merge.** After Accept, do not only `mergeWeekSlice(..., weekStart)`. Merge each affected Monday (or merge by date for returned units) so week 2 appears without a month refetch. Generate click uses `send(canned)` — errors on `chatError`, same `busy` as Send. Remove `generate()` and `fetch("/api/plan", { method: "POST"`.

**Frozen skip vs today’s gate test.** Today `applyMutations` still patches frozen rows and `gateAccept` then flags `FROZEN_ANCHOR_DROPPED`. This change **skips** frozen in `applyMutations`. Update the adaptation test that currently mutates then expects a hard gate: after skip, the frozen row is unchanged and the gate stays ok. Keep `gateAccept` frozen coverage by constructing a dropped-anchor plan without going through skip.

---

## Phase 1: Create-in-range mutations and system prompt

### Overview

Sanitize, apply, and the LLM system prompt allow creating units on the 14-day horizon without changing frozen rows or inventing dates outside the window.

### Changes Required:

#### 1. `applyMutations` inserts

**File**: `src/lib/services/plan-adaptation.ts`

**Intent**: Unknown dates with a full type+km become new unfrozen units so a 14-day layout can land; frozen dates stay untouched.

**Contract**: Insert when `existing === undefined` and `mutation.type` and `mutation.distanceKm` are both set. `frozen: false`. Copy `structure` when present. Skip if `existing?.frozen`. Skip unknown dates that lack type or km. Do not delete dates. `diffUnits` already includes `before: null` for new dates — keep that.

#### 2. Sanitize create window

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: Keep horizon creates even when `units` is empty; still drop dates that are neither existing nor in the horizon; log still needs an existing unit.

**Contract**: `sanitizeProposeResult(raw, units, horizon?: { createFrom: string; createTo: string })`. Allowed mutation dates = unit dates ∪ (horizon ? `inclusiveIsoDates(createFrom, createTo)` : ∅). `ProposeInput` and `ProposeCompleteFn` carry optional `createFrom`/`createTo`. The `complete` path must re-sanitize with the same horizon. Stub behavior unchanged (no 14-day fixture).

#### 3. System prompt

**File**: `src/lib/services/openai-chat.ts`

**Intent**: The model is told it may create on the horizon and must not replace dates outside it.

**Contract**: Extend `LlmProposeRequest` with `createFrom`/`createTo` (sendMessage will set them). `systemPrompt` includes those ISO dates and create/frozen/outside-window rules. `completeOpenAiPropose` sanitizes with that horizon. Do not call `utcToday()` inside sanitize in a way that makes unit tests clock-flaky — tests pass an explicit horizon.

#### 4. Service tests

**Files**: `src/lib/services/plan-adaptation.test.ts`, `src/lib/services/propose-adaptation.test.ts`, `src/lib/services/openai-chat.test.ts` as needed

**Intent**: Lock insert/skip/horizon keep; keep existing log-XOR and unknown-outside-horizon drops.

**Contract**: Replace “ignores unknown dates” with: insert when type+km set; skip incomplete; skip frozen existing. Sanitize: with horizon, a date in-window with no unit is kept; date outside window and not in units still dropped; log on unknown date still `UNKNOWN_DAY_REPLY`. Assert system prompt (via fetch body `messages[0].content`) mentions create / the horizon dates / not replacing outside the window.

### Success Criteria:

#### Automated Verification:

- `applyMutations` inserts a new unfrozen unit when `type` and `distanceKm` are set and the date is missing; skips frozen; skips incomplete creates
- `sanitizeProposeResult` with a horizon keeps in-window dates that are not in `units`; still drops dates outside both; log still requires an existing unit
- `systemPrompt` / `completeOpenAiPropose` sanitize with the request horizon; prompt forbids full replacement outside the window and allows create in-window
- Unit tests pass: `npm test -- src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 2: Ungate sendMessage and persist 14-day Accept

### Overview

Empty weeks can chat. Propose sees week ∪ horizon units. Volume is gated per ISO week. Accept writes every overlapping week without deleting dates outside the horizon.

### Changes Required:

#### 1. Drop `PLAN_EMPTY` and load horizon units

**File**: `src/lib/services/chat.ts`

**Intent**: Chat works with no units; the model sees existing horizon rows and can create into empty dates.

**Contract**: Remove the `units.length === 0` return and `PLAN_EMPTY` from `SendMessageResult`. `units` = `listWeek(weekStart)` union `listRange(createFrom, createTo)` (createFrom/to = `utcToday()` … `addUtcDays(..., 13)`). Pass that set and the horizon into `proposeAdaptation` / `complete`. Still require weeklyKm. Messages and pending rows stay on request `weekStart`.

#### 2. Per-week gate

**File**: `src/lib/services/chat.ts` (and a small helper in `plan-adaptation.ts` if that keeps `chat.ts` readable)

**Intent**: A 14-day proposed set is not scored as one week of km.

**Contract**: After `applyMutations`, group by `utcMondayOf`. Run `gateAccept` (or `validatePlan`) per group with that week’s frozen subset and the same `weeklyKm`. Store concatenated `hard`/`soft` on the pending proposition. `acceptDecision` / `acceptProposition` re-check the same way on stored `proposed_units` (group, don’t sum 14 days).

#### 3. Accept persist merge

**File**: `src/lib/services/chat.ts` (`acceptProposition`)

**Intent**: Created dates in week 2 (and a partial current week) land; Monday-before-today in the same ISO week is not deleted.

**Contract**: Horizon at accept = `utcToday()` … +13 (same definition). Persist the request week always, plus any other Monday with an in-horizon proposed unit, using the keep-merge in Critical Implementation Details. Frozen flags for `acceptDecision` come from `listWeek` of each affected Monday, not only the request week. Return `units` covering all weeks written (concat of those weeks’ stored units).

#### 4. Accept / send tests

**Files**: `src/lib/services/accept-proposition.test.ts`, `src/lib/services/chat.test.ts` as needed

**Intent**: Persist-skip on hard bounds still holds; a proposed unit on a second ISO week inside the horizon upserts; a date in the same week but outside the horizon is not deleted.

**Contract**: Extend memory-supabase accept tests: proposed includes a date in another ISO week that is inside a **test-controlled** horizon (do not rely on a hardcoded “today” that drifts — pass dates relative to `utcToday()` or inject the same `addUtcDays(utcToday(), n)` the implementation uses). Assert `listWeek` for week 2 contains the new unit and a pre-horizon date in week 1 still exists. Keep the existing hard-ceiling persist-skip. Typecheck: `PLAN_EMPTY` gone from the error union.

### Success Criteria:

#### Automated Verification:

- `sendMessage` does not return `PLAN_EMPTY`; `PLAN_EMPTY` is absent from `chat.ts` error unions
- Propose input units are week ∪ `listRange` horizon; horizon is passed into sanitize / OpenAI complete
- Validation stored on the proposition is per-ISO-week, not one 14-day volume sum
- `acceptProposition` always persists the request week, upserts in-horizon dates on other Mondays, and does not leftover-delete dates outside the horizon
- Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts src/lib/services/plan-adaptation.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 3: Button copy, click → chat, ungate composer

### Overview

The purple button labels the 14-day horizon, starts a canned coach send, and the composer is usable when the week is empty.

### Changes Required:

#### 1. Label helpers

**File**: `src/components/plan/plan-month.ts`

**Intent**: Label is busy vs any unit in the UTC 14-day window, not the active ISO week alone.

**Contract**: `generatePlanButtonLabel(busy, hasHorizonUnit)` returns `Working...` / `Regenerate next 14 days` / `Generate next 14 days`. Export `hasUnitInHorizon(units, from, to)` (or equivalent) using ISO date string compare / `inclusiveIsoDates`. Export canned prompts, e.g. `generateNext14Prompt` / `regenerateNext14Prompt` (or one function from `hasHorizonUnit`): user-visible text equivalent to lay out vs regenerate the next 14 days from today, keeping frozen dates. Keep `weekHasUnits` for any remaining week-empty calendar hint if still used.

#### 2. Calendar chrome

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: The purple button shows the new copy; click still calls `onGenerate`.

**Contract**: Compute horizon from `utcToday()` + `addUtcDays(..., 13)`. Pass `hasUnitInHorizon(units, from, to)` into `generatePlanButtonLabel`. Do not key the label off `activeWeekHasUnits` alone. Keep purple classes, Save snapshot, races, cell density. Week-empty hint: drop “Generate to fill the calendar.” Keep “No plan for this week yet.” so the purple button is not described as filling the ISO week via `POST /api/plan`.

#### 3. Ungate PlanChat

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: Empty week can type and Send; helper matches locked copy.

**Contract**: Do not disable textarea/Send on `unitsEmpty`. Remove `unitsEmpty` prop if unused. Remove “Generate a plan for this week before chatting.” Helper first line exactly: `Ask the coach to lay out the next 10–14 days.` Second line short, e.g. `Ask what a day is for, or log a run.` Do not restore the bounds lecture. Keep Accept/Reject. Keep Enter-to-send / placeholder.

#### 4. Workspace: send instead of POST /api/plan

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: `onGenerate` is a normal chat send with the canned prompt; Accept merges every week returned.

**Contract**: Remove `generate()` `fetch("/api/plan", { method: "POST"`. `onGenerate` calls the same `send(content)` as the composer with `generateNext14Prompt` or `regenerateNext14Prompt` from `hasUnitInHorizon` on current `units` (compute horizon with `utcToday()`). Stop passing `unitsEmpty` (or pass false only if the prop remains — prefer delete). `accept()`: merge returned `units` into month state for **all** dates in the payload (loop `mergeWeekSlice` per distinct Monday, or merge-by-date). Do not change snapshot POST, races, or Profile. Errors from generate-as-send use `chatError` (same as Send).

#### 5. Source-scan tests

**Files**: `src/components/plan/plan-month.test.ts`, `src/components/plan/PlanCalendar.test.ts`, `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Node locks for labels, no `/api/plan` POST from the workspace, ungate, helper copy.

**Contract**: Label tests: busy → Working...; horizon unit → Regenerate next 14 days; else Generate next 14 days. Calendar scan: those strings, not `Regenerate week` / `Generate plan` as the button copy. Chat scan: exact helper first line; no `Generate a plan for this week`; not `disabled={busy || unitsEmpty}`. Workspace: `onGenerate` → `send(` / canned prompt; `not.toContain` `fetch("/api/plan"` with POST; still GET `from`/`to` and snapshot POST; no `unitsEmpty={!weekHasUnits`. Keep race/snapshot assertions.

### Success Criteria:

#### Automated Verification:

- Button label is Working... / Regenerate next 14 days / Generate next 14 days from the 14-day unit window, not the active ISO week alone
- `PlanWorkspace` does not POST `/api/plan`; `onGenerate` sends the canned coach prompt via the existing chat send path; Accept merges all returned unit dates into month state
- `PlanChat` composer is not disabled on empty units; helper first line is `Ask the coach to lay out the next 10–14 days.`; `PLAN_EMPTY` copy is gone
- Unit tests pass: `npm test -- src/components/plan/plan-month.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` Calendar, the purple button reads Generate or Regenerate next 14 days from units in the UTC 14-day window; click does not fill via the old week algorithm; Coach chat shows the canned user turn and a reply; composer works when the week is empty
- With a live coach key, Accept can place units on two week-rows inside today…today+13; frozen dates stay; Save snapshot / races overlay still work

---

## Testing Strategy

### Unit Tests:

- `generatePlanButtonLabel` / `hasUnitInHorizon` (busy, in-window unit, unit only on a date outside the window).
- `applyMutations` insert, skip frozen, skip incomplete.
- `sanitizeProposeResult` horizon keep vs outside drop; log XOR.
- Accept persist: second-week upsert; no delete outside horizon; hard bounds still skip persist.
- Source-scans listed in Phase 3.

### Integration Tests:

Reuse memory-supabase accept tests. No new HTTP contract file required; `POST /api/plan` stays for other callers. Do not add Playwright.

### Manual Testing Steps:

1. Empty calendar, composer enabled, helper copy, purple **Generate next 14 days**, click → chat turn, both surfaces busy.
2. After a live-coach proposition, Accept → units in the next 14 days including a second week-row; frozen unchanged.
3. Snapshot and race markers still work; Profile unchanged.

## Performance Considerations

`listRange` for 14 days plus `listWeek` is still a small `.in("date", dates)` set (≤ 14 + 7). OpenAI payload grows with extra unit rows — same order as a dense fortnight, within existing chat JSON.

## Migration Notes

None. DEP-020 stays open. No new SQL. `POST /api/plan` remains for tests and unused UI.

## References

- Change notes: `context/changes/generate-via-chat/change.md`
- Dates: `src/lib/dates.ts` (`utcToday`, `addUtcDays`, `inclusiveIsoDates`, `utcMondayOf`, `weekDates`)
- Persist: `replaceWeek` / `listRange` in `src/lib/services/plan.ts`
- Chat: `src/lib/services/chat.ts`, `src/pages/api/chat/messages.ts`
- Test cookbook: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Create-in-range mutations and system prompt

#### Automated

- [x] 1.1 `applyMutations` inserts a new unfrozen unit when `type` and `distanceKm` are set and the date is missing; skips frozen; skips incomplete creates — 3646d72
- [x] 1.2 `sanitizeProposeResult` with a horizon keeps in-window dates that are not in `units`; still drops dates outside both; log still requires an existing unit — 3646d72
- [x] 1.3 `systemPrompt` / `completeOpenAiPropose` sanitize with the request horizon; prompt forbids full replacement outside the window and allows create in-window — 3646d72
- [x] 1.4 Unit tests pass: `npm test -- src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` — 3646d72
- [x] 1.5 Full suite passes: `npm test` — 3646d72
- [x] 1.6 Lint passes: `npm run lint` — 3646d72

### Phase 2: Ungate sendMessage and persist 14-day Accept

#### Automated

- [x] 2.1 `sendMessage` does not return `PLAN_EMPTY`; `PLAN_EMPTY` is absent from `chat.ts` error unions — afce76f
- [x] 2.2 Propose input units are week ∪ `listRange` horizon; horizon is passed into sanitize / OpenAI complete — afce76f
- [x] 2.3 Validation stored on the proposition is per-ISO-week, not one 14-day volume sum — afce76f
- [x] 2.4 `acceptProposition` always persists the request week, upserts in-horizon dates on other Mondays, and does not leftover-delete dates outside the horizon — afce76f
- [x] 2.5 Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts src/lib/services/plan-adaptation.test.ts` — afce76f
- [x] 2.6 Full suite passes: `npm test` — afce76f
- [x] 2.7 Lint passes: `npm run lint` — afce76f

### Phase 3: Button copy, click → chat, ungate composer

#### Automated

- [x] 3.1 Button label is Working... / Regenerate next 14 days / Generate next 14 days from the 14-day unit window, not the active ISO week alone — 7719a82
- [x] 3.2 `PlanWorkspace` does not POST `/api/plan`; `onGenerate` sends the canned coach prompt via the existing chat send path; Accept merges all returned unit dates into month state — 7719a82
- [x] 3.3 `PlanChat` composer is not disabled on empty units; helper first line is `Ask the coach to lay out the next 10–14 days.`; `PLAN_EMPTY` copy is gone — 7719a82
- [x] 3.4 Unit tests pass: `npm test -- src/components/plan/plan-month.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — 7719a82
- [x] 3.5 Full suite passes: `npm test` — 7719a82
- [x] 3.6 Lint passes: `npm run lint` — 7719a82

#### Manual

- [x] 3.7 On `/dashboard` Calendar, the purple button reads Generate or Regenerate next 14 days from units in the UTC 14-day window; click does not fill via the old week algorithm; Coach chat shows the canned user turn and a reply; composer works when the week is empty
- [x] 3.8 With a live coach key, Accept can place units on two week-rows inside today…today+13; frozen dates stay; Save snapshot / races overlay still work
