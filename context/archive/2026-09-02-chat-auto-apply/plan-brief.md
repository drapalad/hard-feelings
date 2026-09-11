# Coach Send auto-applies when hard bounds pass — Plan Brief

> Full plan: `context/changes/chat-auto-apply/plan.md`

## What & Why

Coach Send currently stores a pending proposition; the calendar moves only after Accept. For dogfood, when `hard` is empty the edit should already be on the calendar — no confirm (human override of FR-006). Hard bounds still block the write.

## Starting Point

`sendMessage` inserts `status: "pending"`. `PlanChat` shows Proposed changes + Accept/Reject. `PlanWorkspace.send` does not merge units. Persist and 14-day keep-merge live in `acceptProposition`. Save snapshot is the archive path; generate is already a canned chat turn.

## Desired End State

Send with mutations and empty hard persists immediately; the island merges `units` from `POST /api/chat/messages`. Soft → amber calendar banner, plan already updated. Hard → no persist, red list in chat. No Accept/Reject in the Week UI. Accept/reject routes remain for 401.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Confirm step when hard is empty | None — persist on Send | Locked human override of FR-006 for this dogfood slice | Plan |
| Persist implementation | Reuse Accept keep-merge (`replaceWeek` / `incomingForWeek`) inside `sendMessage` after `acceptDecision` | Locked; avoids leftover-delete on a 14-day blob | Plan |
| Files | `chat.ts`, `messages.ts`, `PlanChat.tsx`, `PlanWorkspace.tsx` + listed source-scan tests | Locked file list; do not widen | Plan |
| Pending proposition on Send | `rejectPending`; never `insertPending` on apply or hard | Locked “do not leave status pending”; UI no longer reads a card | Unattended |
| HTTP when hard blocks Send | 200 + `validation.hard`, omit `units`; not 409 | Messages is still a successful chat turn; 409 is Accept’s contract | Unattended |
| Soft warnings | Calendar amber list (`asSoft`), plan already written | Locked “amber banner, plan already updated”; calendar already has that list | Plan |
| Hard UI | Red list in `PlanChat` from send `validation`; no Proposed card | Locked red list + remove card; calendar stays amber-only for applied soft | Plan |
| Client merge | `send()` uses `mergeReturnedUnits` + `applyStack`; drop accept/reject fetches | Locked “same merge as today’s accept”; Week UI must not call those routes | Plan |
| Assistant “what changed” | Model reply only; no synthetic second message or kept diff card | Locked “may list”; extra chrome would recreate the removed card | Unattended |
| Testing | Source-scan UI + `sendMessage` persist-skip/land; keep Accept tests; no Playwright | Test-plan §6; locked test files | Plan |

## Scope

**In scope:** Auto-apply persist; messages payload; remove Accept/Reject UI; hard/soft surfaces; listed tests.

**Out of scope:** Delete accept/reject routes; snapshots from this persist; generate/Profile/density; screenshot fixtures; Playwright; closing FU-094–119 or DEP-020.

## Architecture / Approach

`sendMessage` gates with `acceptDecision`, then either the shared Accept write or a no-op persist. `POST /api/chat/messages` returns units + validation + revision stack when applied. The island merges on Send. Chat shows hard failures only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. sendMessage persist | Shared write; land vs skip | Forking keep-merge; leftover pending |
| 2. Messages API | units + validation + stack | Client merge without `units` |
| 3. Island UI | Merge on send; drop buttons | Soft vs hard surfaces swapped |

**Prerequisites:** `generate-via-chat` (canned 14-day Send, keep-merge Accept, no auto-snapshot) already on this branch (`db314a0`).
**Estimated effort:** ~3 phases, one unattended run.

## Open Risks & Assumptions

- Stale `pending` rows from before this change stay in the DB until the next Send `rejectPending`; they are not shown.
- Without `OPENAI_API_KEY`, the stub still will not invent a 14-day fill; auto-apply only runs when the turn actually returns mutations that pass hard.

## Success Criteria (Summary)

- After Send with empty hard, the calendar shows the edit; no Accept.
- Hard Send does not persist; red list in chat.
- Accept/Reject routes still 401; Week UI does not call them.
