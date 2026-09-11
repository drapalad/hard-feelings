---
change_id: chat-auto-apply
title: Coach Send applies the plan immediately when hard bounds pass
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/lib/services/chat.ts` (`sendMessage`; share persist with `acceptProposition`), `src/pages/api/chat/messages.ts` (return `units` + `validation` + revision stack when applied), `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx` (`send` merges units). Source-scan tests in `PlanChat.test.ts`, `PlanWorkspace.test.ts`, `chat.test.ts`. Keep `src/pages/api/chat/accept.ts` and `reject` (401 gates); the Week UI must not call them.

Human override of FR-006 for this dogfood slice: no confirm step when `hard` is empty.

### Today

`sendMessage` inserts a pending proposition. Chat shows Proposed changes + Accept/Reject. Calendar updates only after `POST /api/chat/accept`. Hard bounds leave Accept disabled. If `calendar-month-polish` already shipped, generate/accept/edit no longer auto-insert `plan_revisions` — keep it that way. If it has not shipped yet, still do **not** reintroduce auto-snapshot from this persist path.

### Do

1. Inside `POST /api/chat/messages`, after `gateAccept` / `acceptDecision`, if `hard` is empty and there are mutations, reuse the accept persist path (`replaceWeek` / existing persist) and do not leave status `pending`. Return `units` and `validation` so the island merges the week (use the same merge as today’s accept).

2. Remove Accept/Reject and the Proposed changes card from `PlanChat`. Assistant reply may list what changed.

3. Soft warnings: amber banner, plan already updated. If `hard` is non-empty: do not persist; show the red violation list; no apply.

4. Do not call `snapshotWeekIfChanged` / `insertRevision` from this persist (manual **Save snapshot** is the archive path).

### Do not

- Drop hard bounds.
- Delete the accept/reject routes (unused from UI is fine).
- Ship screenshot fixtures (transcript / Saturday overlay).
- Change generate button wiring, Profile, or calendar cell density.

### Visible

After Send, the edit is on the calendar — no confirm. Hard still blocks without applying.

### Sequencing

After `generate-via-chat` (same `PlanChat` / `PlanWorkspace` / `chat.ts`). Do not run in parallel with `coach-data-request`. If `calendar-month-polish` is not merged yet, still skip auto-revision inserts here so the two do not fight.
