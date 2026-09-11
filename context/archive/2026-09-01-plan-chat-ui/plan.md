# Coach chat Enter-to-send and taller composer Implementation Plan

## Overview

Make coach chat send on Enter (Shift+Enter still inserts a newline), give the transcript enough height that more than two messages stay visible, and put Send beside the textarea instead of on its own row — all inside `src/components/plan/PlanChat.tsx`.

## Current State Analysis

`PlanChat` is a React island used only from `PlanWorkspace` (`src/components/plan/PlanWorkspace.tsx`). The dashboard two-column grid (`grid-cols-1 lg:grid-cols-2`) is unchanged by this slice.

Today:

- The composer is a `<form className="space-y-2">` with a 3-row `<textarea>` and a full-width-row Send `Button type="submit"`. Enter in a textarea inserts a newline; the only send path is clicking Send (or focusing the button and pressing Enter there).
- `submit` already `preventDefault`s, trims, no-ops on empty or `busy`, then `onSend(content)` and clears `draft`. Empty/busy Send is `disabled`.
- Placeholder is already `I completed Tuesday`. Helper copy above the transcript does not mention keyboard shortcuts.
- The section is `min-h-[24rem]`. The transcript is `max-h-72 flex-1 overflow-y-auto` — about 18rem — so two bubbles fill it.
- Classes are merged with `cn()` from `@/lib/utils`. There is no `"use client"` directive (Astro islands). Vitest is Node-only (`include: ["src/**/*.test.ts"]`); Playwright is not a suite (`test-plan.md` §6.3). `quality-gates.test.ts` locks that include glob.

PRD FR-006/FR-007 (chat as the coaching channel) is already shipped; this change is chrome, not the accept/reject or LLM path.

## Desired End State

On `/dashboard` with a generated week, a member can type in coach chat and press Enter to send (same as clicking Send). Shift+Enter inserts a newline. The placeholder stays a short example (`I completed Tuesday`) with no “Enter to send” (or similar) hint. The chat section is taller (`min-h-[32rem]`); the transcript is `min-h-[28rem] max-h-[40rem]`. Send sits to the right of the textarea (`flex` row, `items-end`, textarea `flex-1`). Chat send/accept/reject behavior, copy besides the layout/keyboard, calendar, dashboard chrome, landing, and auth are unchanged.

### Key Discoveries:

- `HTMLFormElement.submit()` does **not** fire React `onSubmit`. Enter must `preventDefault` and call `requestSubmit()` on the textarea’s `form` so the existing `submit` handler (trim / empty / busy / `onSend` / clear draft) remains the single send path.
- Disabled Send does not block `requestSubmit()` without a submitter; the existing `submit` empty/`busy` guards still apply.
- A composing IME Enter (`nativeEvent.isComposing`) must not submit, or CJK input will send mid-composition.
- Node Vitest cannot mount React. The cheapest signal is an exported pure helper for the Enter rule plus source-inspection of layout/placeholder strings — same pattern family as `src/lib/test/quality-gates.test.ts` / `PlanCalendar.test.ts`. Do not add jsdom, Testing Library, or Playwright.

## What We're NOT Doing

- Editing `PlanWorkspace.tsx`, `PlanCalendar.tsx`, dashboard, landing, auth, APIs, or chat services.
- Changing Accept / Reject, pending-diff UI, `onSend` payload, or helper copy above the transcript.
- Adding an “Enter to send” (or similar) placeholder or caption.
- Streaming / SSE, new chat endpoints, or Zod/API work.
- jsdom, `@testing-library/react`, Playwright, or changing `vitest.config.ts` include / `quality-gates.test.ts`.
- `"use client"`, concatenating class strings, or restyling the Send/Accept/Reject button look beyond placing Send in the composer row.

## Implementation Approach

One phase: keyboard contract + height/composer layout in `PlanChat.tsx`, with colocated Node tests that lock the helper and the required class/placeholder strings.

## Critical Implementation Details

**User experience spec** — Enter (without Shift) must not insert a newline. Shift+Enter must not call `preventDefault` so the browser still inserts a newline. While `event.nativeEvent.isComposing` is true, treat the key as not a submit (IME confirmation Enter). Do not add keyboard-hint copy.

**State sequencing** — Wire Enter through `event.currentTarget.form?.requestSubmit()`, not `HTMLFormElement.submit()` and not a second copy of `onSend`. The form’s existing `submit` stays the only place that trims, guards empty/`busy`, calls `onSend`, and clears `draft`.

## Phase 1: Enter-to-send, taller pane, Send beside composer

### Overview

Update `PlanChat` keyboard and layout to the locked spec, and add Node tests that fail if Enter-to-send or the height/composer classes regress.

### Changes Required:

#### 1. PlanChat keyboard, heights, composer row

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: Members send with Enter, keep Shift+Enter for newlines, see more of the transcript, and reach Send without a full extra row — without changing chat semantics.

**Contract**:

- Export a pure helper (e.g. `shouldSubmitChatOnEnter`) used by the textarea `onKeyDown`. It returns true only when `key === "Enter"`, `shiftKey` is false, and `nativeEvent.isComposing` is false. On true: `event.preventDefault()` then `event.currentTarget.form?.requestSubmit()`. On false: do nothing (no `preventDefault`).
- Placeholder remains exactly `I completed Tuesday`. No “Enter to send”, “press Enter”, or similar hint on the textarea or elsewhere in this file.
- Section: `min-h-[24rem]` → `min-h-[32rem]`. Transcript: `max-h-72` → `min-h-[28rem] max-h-[40rem]`; keep `flex-1 overflow-y-auto` and existing border/background. Composer `<form>`: flex row with `items-end` (and a small `gap-*` so Send does not collide with the textarea). Textarea: `flex-1` (drop `w-full` so it does not force 100% width and wrap Send). Send stays `type="submit"` on the right. Merge classes with `cn()`.
- Do not change Accept/Reject, `submit`, props, or `formatUnit`.

#### 2. Colocated Node tests

**File**: `src/components/plan/PlanChat.test.ts`

**Intent**: Lock the Enter vs Shift+Enter vs IME rule and the layout/placeholder strings without adding a DOM test runner.

**Contract**: Vitest Node file (existing include glob). Unit-test the exported helper: Enter → true; Shift+Enter → false; Enter while `isComposing` → false. Read `PlanChat.tsx` source and assert: `requestSubmit`, section `min-h-[32rem]`, transcript `min-h-[28rem]` and `max-h-[40rem]`, no `max-h-72` / `min-h-[24rem]`, form `items-end`, textarea `flex-1`, `placeholder="I completed Tuesday"`. Negative copy check: the `placeholder=` value and JSX text children must not match `/enter to send|press enter|↵ to send/i` — do **not** scan identifiers (the helper name and `key === "Enter"` would false-fail). Do not change `vitest.config.ts`.

### Success Criteria:

#### Automated Verification:

- `PlanChat.tsx` uses section `min-h-[32rem]`, transcript `min-h-[28rem] max-h-[40rem]`, composer flex `items-end` with textarea `flex-1` and Send on the right
- Enter submits via preventDefault + requestSubmit; Shift+Enter does not; IME composing does not; placeholder remains "I completed Tuesday" with no Enter-to-send hint
- Unit tests pass: `npm test`
- Linting passes: `npm run lint`

#### Manual Verification:

- On `/dashboard` with a generated week, Enter sends the draft; Shift+Enter inserts a newline; Send sits to the right of the textarea; transcript is taller than two messages

---

## Testing Strategy

### Unit Tests:

- `shouldSubmitChatOnEnter`: Enter / Shift+Enter / composing Enter.
- Source-inspection of `PlanChat.tsx` for heights, composer row, `requestSubmit`, placeholder, and absence of keyboard-hint copy in `placeholder=` / JSX text (not identifiers).

### Integration Tests:

- None. Chat persist/accept stays covered by existing `src/lib/services/chat.test.ts` and `accept-proposition.test.ts`. This slice does not touch APIs.

### Manual Testing Steps:

1. Sign in, generate a week if needed, open coach chat on `/dashboard`.
2. Type a short message, press Enter — it sends; draft clears; no extra newline left behind.
3. Type text, press Shift+Enter — a newline appears; message is not sent until Enter or Send.
4. Confirm Send is on the right of the textarea and the transcript area is taller than two bubbles before scrolling.

## Performance Considerations

Taller `min-h` on the transcript increases the default chat column height on large viewports; overflow remains `overflow-y-auto` so long threads still scroll. No extra network or re-renders beyond the existing `onSend` path.

## Migration Notes

None. No schema, cookies, or API contract change.

## References

- Locked notes: `context/changes/plan-chat-ui/change.md`
- Component: `src/components/plan/PlanChat.tsx`
- Parent island (out of scope): `src/components/plan/PlanWorkspace.tsx`
- Test-plan Node Vitest / no Playwright: `context/foundation/test-plan.md` §4, §6.3
- Quality-gates include lock: `src/lib/test/quality-gates.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Enter-to-send, taller pane, Send beside composer

#### Automated

- [x] 1.1 PlanChat.tsx uses section min-h-[32rem], transcript min-h-[28rem] max-h-[40rem], composer flex items-end with textarea flex-1 and Send on the right — af93f34
- [x] 1.2 Enter submits via preventDefault + requestSubmit; Shift+Enter does not; IME composing does not; placeholder remains "I completed Tuesday" with no Enter-to-send hint — af93f34
- [x] 1.3 Unit tests pass: npm test — af93f34
- [x] 1.4 Linting passes: npm run lint — af93f34

#### Manual

- [x] 1.5 On /dashboard with a generated week, Enter sends the draft; Shift+Enter inserts a newline; Send sits to the right of the textarea; transcript is taller than two messages
