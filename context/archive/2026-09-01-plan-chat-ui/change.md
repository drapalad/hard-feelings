---
change_id: plan-chat-ui
title: Chat Enter-to-send, taller pane, Send beside composer
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

File: `src/components/plan/PlanChat.tsx` only.

Today Enter inserts a newline; users must click Send. Transcript is `max-h-72` (two messages fill it). Send sits in a full row under the textarea.

Do: Enter submits (preventDefault + form submit); Shift+Enter keeps a newline. Placeholder stays a short example such as “I completed Tuesday” — no “Enter to send” (or similar) hint. Section `min-h-[24rem]` → `min-h-[32rem]`; transcript `max-h-72` → `min-h-[28rem] max-h-[40rem]`. Composer becomes a flex row: textarea `flex-1`, Send on the right (`items-end`).
