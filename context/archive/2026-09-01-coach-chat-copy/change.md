---
change_id: coach-chat-copy
title: Shorten the coach blurb and align user messages to the right
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:10Z
---

## Notes

LOCKED. File: `src/components/plan/PlanChat.tsx` only.

### Today

Under the “Coach chat” heading there are two sentences: what to ask, that replies can be model-written, and that Accept only lands inside hard bounds. User and assistant bubbles both start on the left; role is purple vs grey only.

Enter-to-send, taller transcript, and Send beside the textarea already shipped. Do not revert those.

### Do

1. Replace the helper paragraph with exactly: `Ask about a day, request a change, or log a run.`

2. On `message.role === "user"`, add `ml-auto w-fit max-w-[85%]` next to the existing purple classes so a short line hugs the text, caps at 85%, and sits on the right. Assistant bubbles stay left (`bg-white/10 text-blue-50`, no auto margin).

### Do not

- Change transcript `min-h` / `max-h`, Enter-to-send, Send placement, placeholder, Accept/Reject, or landing copy about hard bounds.
- Touch `PlanCalendar` / month grid / generate.

### Visible

One-line helper under Coach chat. “What is Tuesday for?” is a compact purple bubble on the right; the coach reply stays left.
