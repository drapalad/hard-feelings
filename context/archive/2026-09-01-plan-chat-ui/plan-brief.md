# Coach chat Enter-to-send and taller composer — Plan Brief

> Full plan: `context/changes/plan-chat-ui/plan.md`

## What & Why

Coach chat currently treats Enter as a newline, so members must click Send. The transcript `max-h-72` fills after two messages, and Send sits on its own row. This slice makes Enter send (Shift+Enter keeps a newline), tallens the pane, and places Send beside the textarea.

## Starting Point

`PlanChat` already has a form `submit` that trims, guards empty/`busy`, and calls `onSend`. Placeholder is `I completed Tuesday`. Vitest is Node-only; Playwright is not a suite.

## Desired End State

Enter sends; Shift+Enter inserts a newline; placeholder stays the short example with no keyboard hint; section `min-h-[32rem]`; transcript `min-h-[28rem] max-h-[40rem]`; composer is a flex row with textarea `flex-1` and Send on the right (`items-end`).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | `PlanChat.tsx` + colocated Node test only | Locked notes; do not restyle calendar, dashboard, landing, or auth | Plan |
| Enter submit path | `preventDefault` + `form.requestSubmit()` | Locked “preventDefault + form submit”; `HTMLFormElement.submit()` skips React `onSubmit` so the existing trim/busy/`onSend` path would be bypassed | Plan |
| Placeholder / hints | Keep `I completed Tuesday`; no “Enter to send” copy | Locked; example copy is enough without teaching the shortcut | Plan |
| IME Enter | Do not submit while `nativeEvent.isComposing` | Otherwise CJK composition confirmation would send a half-finished draft | Unattended |
| Composer width classes | `flex-1` on the textarea; drop `w-full` | Locked flex row; `w-full` is 100% of the form and would wrap Send under the field | Unattended |
| Tests | Exported helper unit tests + source-inspection of classes/placeholder; keyboard-hint regex only on placeholder/JSX text, not identifiers; no jsdom/Playwright | `vitest.config.ts` / quality-gates lock `src/**/*.test.ts` Node; test-plan §6.3 parks Playwright | Plan |

## Scope

**In scope:** Keyboard send, heights, composer row, Node tests for that file.

**Out of scope:** Workspace/calendar/dashboard/landing/auth, Accept/Reject, APIs, LLM/streaming, new test runners or deps.

## Architecture / Approach

Keep the form `onSubmit` as the only send implementation. Textarea `onKeyDown` decides whether to `requestSubmit()`. Layout is Tailwind class swaps via `cn()`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Enter-to-send, taller pane, Send beside composer | Keyboard + heights + row composer + Node tests | Using `form.submit()` instead of `requestSubmit()` silently skips `onSend` |

**Prerequisites:** Generated week on `/dashboard` for Manual; Automated needs only lint/test.
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- Taller `min-h` on the chat column will stretch the dashboard grid row on large screens; that is intended and out of scope to rebalance against the calendar.
- IME skip is the standard composer reading; no second product reading was locked.

## Success Criteria (Summary)

- Enter sends; Shift+Enter newlines; no keyboard-hint placeholder.
- Section/transcript/composer classes match the locked sizes and row layout.
- `npm test` and `npm run lint` pass.
