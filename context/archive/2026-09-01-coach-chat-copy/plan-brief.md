# Coach chat helper copy and user-bubble alignment — Plan Brief

> Full plan: `context/changes/coach-chat-copy/plan.md`

## What & Why

Coach chat’s helper is two sentences (what to ask, model-written replies, Accept hard bounds) and both roles share a left-aligned bubble. This slice shortens the prompt to one locked line and puts the member’s messages on the right so a short question is visually theirs.

## Starting Point

`PlanChat.tsx` already has Enter-to-send, a tall transcript, and Send beside the textarea (`plan-chat-ui`). User vs assistant is purple vs grey only. `PlanChat.test.ts` source-inspects those layout strings.

## Desired End State

Helper text is exactly `Ask about a day, request a change, or log a run.` User bubbles use `ml-auto w-fit max-w-[85%]` with the existing purple classes; assistant bubbles stay left. Heights, Enter, Send, placeholder, Accept/Reject, and calendar/workspace are untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Helper copy | Replace the paragraph with exactly `Ask about a day, request a change, or log a run.` (drop model-written / Accept-bounds sentences) | Locked Notes name that sentence as the only helper. | Plan |
| User bubble alignment | Add `ml-auto w-fit max-w-[85%]` on the `message.role === "user"` `cn()` branch next to `bg-purple-600/40 text-white` | Locked Notes; `w-fit` is required so a block `<p>` hugs a short line. | Plan |
| Frozen chrome | Do not change transcript min-h/max-h, Enter-to-send, Send, placeholder, Accept/Reject, empty-week hint, PlanCalendar, or PlanWorkspace | Locked Do-not list; prior slice already shipped those. | Plan |
| Test layer | Extend `PlanChat.test.ts` source-inspection; no jsdom / RTL / Playwright | Matches `plan-chat-ui` and `test-plan.md` §6.1 / §6.3; Node Vitest cannot mount React. | Plan |
| Phase structure | Single phase: copy + bubbles + tests | Two-line UI change; splitting would pad Progress without extra gates. | Unattended |
| Long user messages | Rely on `max-w-[85%]` and default wrap; no `break-all` / `whitespace-pre` | Locked spec already caps width; extra wrap utilities are not specified. | Unattended |

## Scope

**In scope:** `src/components/plan/PlanChat.tsx` helper paragraph and user-bubble classes; extending `src/components/plan/PlanChat.test.ts`.

**Out of scope:** PlanCalendar / month grid / generate / PlanWorkspace layout; transcript heights; Enter-to-send; Send placement; placeholder; Accept/Reject; landing hard-bounds copy; APIs.

## Architecture / Approach

Edit the existing helper `<p>` and the `cn()` role ternary on the message `<p>`. Tests keep reading the `.tsx` source. No new components, props, or CSS files.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Helper one-liner and right-aligned user bubbles | Locked copy + user `ml-auto w-fit max-w-[85%]` + regression tests | Source-inspection too loose (whole-file `ml-auto`) or too strict (Prettier class order) |

**Prerequisites:** `plan-chat-ui` chrome already on disk (heights, Enter, Send row).
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- Prettier Tailwind class sort may reorder the user-branch string; tests assert tokens on that branch, not a frozen concatenation.
- Dropping the Accept-bounds sentence from the helper is intentional (locked); Welcome/landing copy is not this file.

## Success Criteria (Summary)

- Helper is the locked one-liner.
- Short user messages sit on the right as compact purple bubbles; assistant stays left.
- `npm test` and `npm run lint` pass; previously locked Enter/height/placeholder strings still hold.
