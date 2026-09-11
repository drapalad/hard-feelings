# Chat thread separation — Plan Brief

> Full plan: `context/changes/chat-threading/plan.md`

## What & Why

Coach chat is still one implicit transcript per ISO week, so starting a fresh conversation or keeping an older one is impossible, and changing the calendar month swaps the history. This change adds real threads (P-05 new-thread + P-06 list) on top of the already-merged optimistic send / flag / range / Accept work.

## Starting Point

`chat_messages.week_start` is the thread key. `PlanWorkspace` stores `messages` in React state and reloads them with `GET /api/chat?weekStart=` on every month fetch. There is no `plans` table and no thread selector. Coach history is the last 12 messages of the visible week.

## Desired End State

The member can click **New thread**, get an empty transcript, and later reopen older threads from a compact list (title or `Week of 25 Aug`, newest first, active highlighted). Existing week histories are migrated into threads. Send without `threadId` still works. Month navigation does not throw away the active conversation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Owner key | `user_id` on `chat_threads`, not `plan_id` | There is no `plans` table; every member chat table already uses `user_id` + RLS | Unattended |
| `GET …?planId=` | Optional query, ignored; list is session-scoped | Locked URL named `planId`, but there is nothing to join | Unattended |
| Historical grouping | One thread per `(user_id, week_start)` | Locked Notes require that backfill so current week transcripts stay separate | Plan |
| Month navigation | Keep the active thread; still refresh week pending | P-05 problem was transcript swap; pending/accept stay week-scoped | Unattended |
| List chrome | Compact collapsible list under `Coach chat`, not a new column | Locked allows sidebar or dropdown; P-06 forbids growing pane heights | Unattended |
| Untitled fallback | `Week of D MMM` from `startedAt` (UTC) | Locked copy; migrated threads also get title from first user message when present | Plan |
| Title write | First 60 chars of the first user message; no rename UI | Locked must-have; editable later is out of v1 | Plan |
| Default send target | Latest thread, or create one if none exist | Locked backward compat for `POST /api/chat/messages` without `threadId` | Plan |
| Coach history | Last 12 of the **active thread** only | Locked: do not change context window beyond the active thread | Plan |
| Flag lookup | Message id + owner, last-assistant check in that thread | Avoids treating week_start as the transcript key after the move | Unattended |
| Delete / merge / rename | Out of v1 | Explicit locked do-not | Plan |
| Testing | Service + API + source-scan UI; migration harness extension; DEP for hosted SQL; no Playwright | test-plan §6 cheapest layer; SQL UPDATE would otherwise fail Risk #4 harness | Plan |

## Scope

**In scope:** `chat_threads` + RLS + message FK + backfill, list/create APIs, optional `threadId` on send, GET-by-thread, New thread control, compact thread list, month-nav stability, tests, hosted-apply DEP.

**Out of scope:** coach prompt / mutations / Accept / admin flag / range; thread delete/merge/rename; `plans` table; taller chat column; Playwright.

## Architecture / Approach

`chat_threads` owns messages via `thread_id`. `week_start` remains a per-message stamp and the key for pending/accept. `chat.ts` resolves thread id (explicit or latest), loads history by thread, and sets title on first user line. `listChat` / `sendMessage` stay backward-compatible (optional `threadId`, no new positional args). `PlanWorkspace` holds `activeThreadId` + `threads` and reads the active id from a ref inside `loadMonth` so thread switches do not retrigger the mount effect. `PlanChat` stays presentational. Calendar `loadMonth` passes `threadId` so week pending can refresh without swapping the transcript.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + service | Table, backfill, list/create/send-by-thread | Harness treating backfill UPDATE as data loss |
| 2. HTTP + SSR | `/api/chat/threads`, optional `threadId`, GET by thread | IDOR via foreign `threadId`; pending still week-keyed |
| 3. Chat UI | New thread + list + stable month nav | Month fetch wiping the active transcript |

**Prerequisites:** `chat-mutations-range-accept-admin` already on this worktree (optimistic send, flag, range, Accept card).
**Estimated effort:** one unattended run, three phases, one migration.

## Open Risks & Assumptions

- Locked `plan_id` cannot be honored as a FK; recorded as FU-129.
- Keeping the active thread on month change (vs jumping to that week's migrated thread) is the other defensible reading; recorded as FU-130.
- Compact in-column list vs a true sidebar column is FU-131.

## Success Criteria (Summary)

- Member can start a fresh thread and switch back to older ones without losing history.
- Calendar month change does not replace the active transcript.
- Coach, Accept, Flag, and range behavior from the previous chat change still work.
