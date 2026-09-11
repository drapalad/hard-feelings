# Coach chat helper copy and user-bubble alignment Implementation Plan

## Overview

Shorten the Coach chat helper to a single locked sentence and align user message bubbles to the right inside `src/components/plan/PlanChat.tsx`, without changing transcript height, Enter-to-send, Send placement, placeholder, Accept/Reject, or calendar/workspace layout.

## Current State Analysis

`PlanChat` is a React island used only from `PlanWorkspace` (`src/components/plan/PlanWorkspace.tsx`). Classes are already merged with `cn()` from `@/lib/utils`. There is no `"use client"` directive.

Today (lines 59–77 of `PlanChat.tsx`):

- Under the “Coach chat” heading, a `text-sm text-blue-100/70` paragraph explains what to ask, that replies can be model-written, and that Accept only lands inside hard bounds.
- Transcript messages are `<p>` bubbles. User and assistant both start on the left; role is color only (`bg-purple-600/40 text-white` vs `bg-white/10 text-blue-50`).
- Enter-to-send, taller transcript (`min-h-[28rem] max-h-[40rem]`), section `min-h-[32rem]`, and Send beside the textarea already shipped in `plan-chat-ui`. Placeholder is `I completed Tuesday`. Accept/Reject and the empty-week hint (“Generate a plan for this week before chatting.”) are unchanged since that slice.
- Colocated Node tests in `src/components/plan/PlanChat.test.ts` lock those heights, the composer row, `requestSubmit`, and placeholder copy via source-inspection plus `shouldSubmitChatOnEnter` units. Vitest is Node-only (`include: ["src/**/*.test.ts"]`); Playwright is not a suite (`test-plan.md` §6.3).

PRD FR-006/FR-007 (chat as the coaching channel) is already shipped; this change is chrome, not the accept/reject or LLM path.

## Desired End State

On `/dashboard` with a generated week, the helper under “Coach chat” is exactly `Ask about a day, request a change, or log a run.` A short user message (e.g. “What is Tuesday for?”) is a compact purple bubble on the right (`ml-auto w-fit max-w-[85%]` next to the existing purple classes). Assistant bubbles stay left (`bg-white/10 text-blue-50`, no auto margin). Transcript min-h/max-h, Enter-to-send, Send placement, placeholder, Accept/Reject, and the generate-before-chatting hint are unchanged.

### Key Discoveries:

- User/assistant styling is already a `cn()` ternary on the message `<p>`; the locked alignment tokens belong on the user branch of that ternary, not a second wrapper.
- `w-fit` is required with `ml-auto`: a block `<p>` is full-width by default, so auto margin alone would not hug a short line.
- Node Vitest cannot mount React. The cheapest signal is extending the existing `PlanChat.test.ts` source-inspection file — same pattern as `plan-chat-ui`. Do not add jsdom, Testing Library, or Playwright (`test-plan.md` §6.1, §6.3, §7 visual snapshots).
- `prettier-plugin-tailwindcss` may reorder the user-branch class string; tests must assert the locked tokens are present on that branch, not a frozen concatenated order.

## What We're NOT Doing

- Editing `PlanWorkspace.tsx`, `PlanCalendar.tsx`, dashboard chrome, landing, auth, APIs, or chat services.
- Changing transcript `min-h` / `max-h`, section `min-h`, Enter-to-send, Send placement, placeholder, Accept/Reject, pending-diff UI, or the empty-week generate hint.
- Restoring the dropped helper sentences (model-written replies / Accept hard bounds) anywhere in `PlanChat`.
- Touching Welcome / landing hard-bounds product copy.
- jsdom, `@testing-library/react`, Playwright, or changing `vitest.config.ts` include / `quality-gates.test.ts`.
- `"use client"` or concatenating class strings (AGENTS.md: merge with `cn()`).

## Implementation Approach

One phase: replace the helper paragraph and add the locked user-bubble classes in `PlanChat.tsx`, and extend the colocated Node tests so those strings cannot regress without also locking the already-shipped height/Enter/placeholder contracts.

## Phase 1: Helper one-liner and right-aligned user bubbles

### Overview

Update `PlanChat` copy and user-bubble classes to the locked spec, and extend Node tests that fail if the helper, user alignment tokens, or previously locked chrome regress.

### Changes Required:

#### 1. PlanChat helper copy and user-bubble classes

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: Members see a short prompt for what chat is for, and can tell their own messages from the coach by position as well as color — without changing send, accept, or layout chrome.

**Contract**:

- Replace the helper `<p className="text-sm text-blue-100/70">` body with exactly `Ask about a day, request a change, or log a run.` Keep that className. Do not keep the previous two sentences in this file.
- On the message `<p>`, keep shared `rounded-md px-3 py-2 text-sm`. When `message.role === "user"`, the `cn()` true branch must include `ml-auto`, `w-fit`, `max-w-[85%]`, and the existing `bg-purple-600/40 text-white`. When not user, keep `bg-white/10 text-blue-50` with no `ml-auto` / `w-fit` / `max-w-[85%]`.
- Merge classes with `cn()`. Do not change transcript `min-h-[28rem]` / `max-h-[40rem]`, section `min-h-[32rem]`, Enter/`requestSubmit`, form `items-end`, textarea `flex-1`, placeholder, Accept/Reject, or the generate-before-chatting hint.

#### 2. Extend colocated Node tests

**File**: `src/components/plan/PlanChat.test.ts`

**Intent**: Lock the new helper and user-bubble tokens without adding a DOM test runner, and keep the existing Enter/height/placeholder assertions so this slice cannot silently revert `plan-chat-ui`.

**Contract**: Vitest Node file (existing include glob). Keep the `shouldSubmitChatOnEnter` units and the current layout/placeholder/hint-copy tests. Add source-inspection that: the file contains the exact helper sentence `Ask about a day, request a change, or log a run.`; it does not contain `Ask what a unit is for` or `Replies can be model-written`; the user-role ternary true branch contains `ml-auto`, `w-fit`, `max-w-[85%]`, and `bg-purple-600/40`; the false branch contains `bg-white/10` and `text-blue-50` and does not contain `ml-auto`. Do not scan identifiers with a naive `/ml-auto/` against the whole file if that would collide with comments — bind assertions to the `message.role === "user"` ternary. Do not change `vitest.config.ts`.

### Success Criteria:

#### Automated Verification:

- Helper copy is the locked one-liner and user bubbles carry `ml-auto w-fit max-w-[85%]` on the purple branch; assistant stays `bg-white/10 text-blue-50` without `ml-auto`
- Existing Enter-to-send, transcript heights, composer row, and placeholder assertions still pass
- Unit tests pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` with a generated week, the helper under Coach chat is the one-liner; a short user message is a compact purple bubble on the right; the coach reply stays left; transcript height, Enter-to-send, Send placement, and Accept/Reject look unchanged

---

## Testing Strategy

### Unit Tests:

- Extend `PlanChat.test.ts`: exact helper sentence; absence of the old helper sentences; user-branch alignment tokens; assistant branch without `ml-auto`.
- Keep `shouldSubmitChatOnEnter` and layout/placeholder/hint-copy tests as regression locks for `plan-chat-ui`.

### Integration Tests:

- None. Chat persist/accept stays covered by existing `src/lib/services/chat.test.ts` and `accept-proposition.test.ts`. This slice does not touch APIs.

### Manual Testing Steps:

1. Sign in, generate a week if needed, open coach chat on `/dashboard`.
2. Confirm the helper under “Coach chat” is only `Ask about a day, request a change, or log a run.`
3. Send “What is Tuesday for?” — the user bubble is compact, purple, on the right; the reply is left-aligned grey/blue.
4. Confirm Enter still sends, Send is beside the textarea, the transcript height is unchanged, and Accept/Reject still appear when a proposition is pending.

## Performance Considerations

`w-fit` / `max-w-[85%]` only affect bubble box size; no extra network or re-renders beyond the existing `onSend` path. Long user messages wrap inside 85% width; overflow on the transcript remains `overflow-y-auto`.

## Migration Notes

None. No schema, cookies, or API contract change.

## References

- Locked notes: `context/changes/coach-chat-copy/change.md`
- Component: `src/components/plan/PlanChat.tsx`
- Existing tests: `src/components/plan/PlanChat.test.ts`
- Parent island (out of scope): `src/components/plan/PlanWorkspace.tsx`
- Prior chrome slice: `context/archive/2026-09-01-plan-chat-ui/plan.md`
- Test-plan Node Vitest / no Playwright: `context/foundation/test-plan.md` §4, §6.1, §6.3
- Quality-gates include lock: `src/lib/test/quality-gates.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Helper one-liner and right-aligned user bubbles

#### Automated

- [x] 1.1 Helper copy is the locked one-liner and user bubbles carry ml-auto w-fit max-w-[85%] on the purple branch; assistant stays bg-white/10 text-blue-50 without ml-auto — b1ee19d
- [x] 1.2 Existing Enter-to-send, transcript heights, composer row, and placeholder assertions still pass — b1ee19d
- [x] 1.3 Unit tests pass: npm test — b1ee19d
- [x] 1.4 Linting passes: npm run lint — b1ee19d

#### Manual

- [x] 1.5 On /dashboard with a generated week, the helper under Coach chat is the one-liner; a short user message is a compact purple bubble on the right; the coach reply stays left; transcript height, Enter-to-send, Send placement, and Accept/Reject look unchanged
