# chat-threading

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Chat thread separation: new-thread button + thread list sidebar

## Notes

Bundles P-05 (new-thread button) and P-06 (thread list sidebar).

**Conflict note:** shares `PlanChat.tsx`, `PlanWorkspace.tsx`, and `src/lib/services/chat.ts` with `chat-mutations-range-accept-admin` — implement after that group.

### Files

- `src/lib/services/chat.ts`
- `src/pages/api/chat/` (new endpoints or extend existing)
- `src/components/plan/PlanChat.tsx`
- `src/components/plan/PlanWorkspace.tsx`
- Migration: `supabase/migrations/20260903130000_chat_threads.sql` + RLS

### What exists today

`chat_messages` has a `week_start` column used as a thread key. Coach always sees the same week's history. There is no explicit "thread" entity; the week boundary is implicit. `PlanWorkspace` keeps `messages` in state; there is no thread selector.

### P-05 — New-thread button

**Do:**
- Add a `chat_threads` table (`id uuid PK, plan_id uuid FK, started_at timestamptz, title text nullable`). Each thread owns its messages (FK from `chat_messages.thread_id`). Migrate existing messages: group by `(plan_id, week_start)` into auto-created threads.
- On the chat header, show a **New thread** button (plus icon). It POSTs a new thread and clears the transcript.
- Title: auto-set from the first user message (first 60 chars). Editable later is nice-to-have, not required.
- `POST /api/chat/messages` must accept `threadId`. Default to the latest thread for backward compat.

**Do not:** change the coach prompt or mutation logic; touch Accept/admin/range.

### P-06 — Thread list sidebar

**Do:**
- A collapsible sidebar (or dropdown) listing threads for the current plan, sorted newest-first.
- Each row: title (or "Week of 25 Aug" fallback) + date.
- Click loads that thread's messages into the transcript.
- `GET /api/chat/threads?planId=…` returns the list.
- Active thread highlighted.

**Do not:** allow deleting threads in v1; merge threads; change coach context window beyond the active thread.

### Visible result

User can start a fresh thread and switch back to older ones without losing history.
