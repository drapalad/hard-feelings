# Chat thread separation Implementation Plan

## Overview

Give Coach chat real threads: persist a `chat_threads` table, migrate each existing `(user_id, week_start)` transcript into its own thread, let the member start a fresh empty thread, and switch among threads from a compact list without losing history. Coach prompt, mutation auto-apply, Accept/admin/range, and pane heights stay as they are after `chat-mutations-range-accept-admin`.

## Current State Analysis

`chat_messages` is keyed by `user_id` + `week_start`. There is no thread entity and no `plans` table — the member's plan is implicit in `auth.users` / `training_units`. `listChat()` / `loadMessages()` / `insertMessage()` in `src/lib/services/chat.ts` all filter by ISO Monday. `GET /api/chat` requires `weekStart`. `PlanWorkspace.loadMonth()` refetches that GET whenever the calendar month changes, so the transcript jumps to another week's history. Empty copy is `No messages this week yet.`

`sendMessage()` stamps `week_start` on every row and feeds the last 12 messages of **that week** to the coach. Optimistic send, Flag for admin, `loadedRange`, and the profile/freeze Accept card already live in `PlanChat` / `PlanWorkspace` and must keep working. Pending propositions and `chat_profile_freeze_pending` remain week-scoped; they are not thread-scoped.

`createMemorySupabase()` does not know `chat_threads`. The migrate-over-fixture harness in `src/lib/test/migration-safety.ts` **throws on any `UPDATE` of owner-readable tables** (including `chat_messages`) and on unclassified `INSERT INTO … SELECT` / `ALTER COLUMN SET NOT NULL`. A SQL backfill therefore cannot land unless that classifier is extended.

Locked Notes name `plan_id uuid FK` and `GET /api/chat/threads?planId=…`. Those cannot be implemented as written: there is no `plans` row to reference.

## Desired End State

A member can start a new empty coach thread (plus control in the chat header) and switch back to older threads from a compact list. Historical week transcripts survive as separate threads. Sending without an explicit `threadId` still works (latest thread, creating one if needed). Changing the calendar month does not replace the active transcript. The coach still mutates the **visible week**; its conversational context is only the **active thread** (last 12 turns). Accept / Flag / range / optimistic send are unchanged.

### Key Discoveries:

- There is no `plans` table; every member-owned chat table uses `user_id` + RLS `auth.uid() = user_id` (`supabase/migrations/20260813160000_chat_gated_adaptation.sql`).
- `loadMonth()` in `src/components/plan/PlanWorkspace.tsx` currently always `fetch(\`/api/chat?weekStart=${nextStart}\`)` — that is the switch that must stop swapping transcripts.
- `reportAssistantGap()` finds "last assistant" inside `loadMessages(weekStart)`. After messages move to threads, it must resolve the message by id (still owned by the caller) and check last-assistant **in that thread**, while `agent_reports.week_start` can keep using the request Monday.
- Distinctive `chat_messages` seed keys in the migration harness are `user_id`, `week_start`, `role`, `content` — adding `thread_id` does not change the snapshot **if** UPDATE of those seed keys is still forbidden.
- Chat column heights are locked by source-scan tests (`min-h-[32rem]`, transcript `min-h-[28rem]` / `max-h-[40rem]`). A second dashboard column would violate the calendar/chat split; a compact list under the header will not.

## What We're NOT Doing

- Changing the coach prompt, `completeSendTurn`, mutation auto-apply, hard-bound capture, Flag for admin UX, Accept/Dismiss profile-freeze card, or `loadedRange`.
- Deleting, merging, or renaming threads in v1 (inline rename stays nice-to-have / out).
- Introducing a `plans` table or a real `plan_id` FK.
- Widening the coach context window beyond the active thread's last 12 messages, or sending other threads' history.
- Growing the chat pane (`min-h-[32rem]` / transcript heights stay).
- Playwright / E2E.

## Implementation Approach

Three layers, in order:

1. Schema + memory persist + chat service (threads as the message owner; week_start remains a stamp and the pending/accept key).
2. HTTP: list/create threads, optional `threadId` on send, GET chat by thread (default latest) while pending stays week-scoped.
3. Presentational switcher in `PlanChat` plus workspace state so New thread / click-to-load / month-nav keep one active thread.

## Critical Implementation Details

### Migration harness vs SQL backfill

The locked migration must `INSERT` threads and `UPDATE chat_messages.thread_id`. Today's harness treats any `UPDATE chat_messages` as data loss. Extend `applyStatement` so: (1) `INSERT INTO` a table that is not owner-readable (or a newly created table) is classified as a no-op on distinctive snapshots; (2) `UPDATE` of an owner-readable table is allowed only when every `SET` column is **outside** that table's distinctive seed keys; (3) `ALTER TABLE … ALTER COLUMN … SET NOT NULL` / `SET DEFAULT` is classified as a no-op. Do not allow `UPDATE` of `user_id` / `week_start` / `role` / `content` on `chat_messages`.

### Week vs thread

`week_start` stays on `chat_messages` (stamp the visible Monday on insert) and on pending/accept APIs. Message **load** and coach **history** use `thread_id`. `listChat` takes `weekStart` for proposition / pending profile-freeze and `threadId` (or latest) for `messages`.

### Month navigation

`loadMonth` must pass the current `threadId` into `GET /api/chat` so a Monday change refreshes pending/logs for that week without replacing the transcript with another thread. Do not omit `threadId` after the first load.

`loadMonth` is already a `useCallback` whose identity is a dependency of the mount `useEffect`. Do **not** put `activeThreadId` in that callback's deps — changing threads would re-run the effect and refetch the whole month. Read the active id from a ref that `loadMonth` closes over (same `loadSeq` pattern already used to drop stale responses).

### Ownership

Every thread/message query filters `user_id = session`. Unknown or foreign `threadId` is `NOT_FOUND`, never another member's rows.

## Phase 1: Threads schema and chat service

### Overview

Add `chat_threads`, attach messages, backfill one thread per existing `(user_id, week_start)`, and make the chat service the source of truth for list/create/send-by-thread.

### Changes Required:

#### 1. SQL migration

**File**: `supabase/migrations/20260903130000_chat_threads.sql`

**Intent**: Persist threads with owner RLS and point every existing message at a backfilled thread so history is not lost.

**Contract**: Table `chat_threads` (`id uuid PK`, `user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE`, `started_at timestamptz NOT NULL DEFAULT now()`, `title text NULL`). RLS enable + granular select/insert/update/delete policies using `auth.uid() = user_id`. `ALTER TABLE chat_messages ADD COLUMN thread_id uuid REFERENCES chat_threads (id)`. Backfill: one thread per distinct `(user_id, week_start)` of existing messages; `started_at` = min(`created_at`) of that group (fallback `week_start` at UTC midnight); `title` = first 60 chars of the earliest user `content` in the group, else null. Then `UPDATE` those messages' `thread_id`, then `ALTER COLUMN thread_id SET NOT NULL`. Keep `week_start` on messages. Comment that Worker rollback does not undo this SQL.

#### 2. Migration-safety classifier and seeds

**Files**: `src/lib/test/migration-safety.ts`, `src/lib/test/migration-safety.test.ts`

**Intent**: Let the backfill SQL apply without being treated as destructive, and keep Risk #4 coverage.

**Contract**: Classify the INSERT / new-column UPDATE / `SET NOT NULL` forms described above. Add `chat_threads` to `OWNER_READABLE_TABLES` with a distinctive `{ user_id }` seed so later files keep owner SELECT. Update the ordered filename list to include `20260903130000_chat_threads.sql` between profile-freeze and log-pace-hr. Distinctive `chat_messages` payloads after this file must still equal before for seed keys.

#### 3. Memory persist

**Files**: `src/lib/test/memory-supabase.ts`, `src/lib/test/memory-supabase.test.ts`

**Intent**: Tests can insert/list threads the same way they do other member tables.

**Contract**: Add `chat_threads` to `MEMORY_TABLES` / `emptyStore()`. Existing isolation tests still hide other members' rows unless `.eq("user_id", …)` is used.

#### 4. Types and chat service

**Files**: `src/types.ts`, `src/lib/services/chat.ts`, `src/lib/services/chat.test.ts`, `src/pages/api/chat/report.test.ts`

**Intent**: Threads own transcripts; send/list/report keep working against memory persist.

**Contract**: Add `ChatThread { id, title: string | null, startedAt: string }`. Zod: optional `threadId: z.uuid()` on `chatMessageBodySchema`. Functions: `listThreads(client, userId)` newest-first by `started_at`; `createThread(client, userId)` with `title: null`; `resolveThreadId(client, userId, threadId?)` — given id must belong to the user or `NOT_FOUND`; omitted id → latest thread or insert one. `loadMessages` / `insertMessage` key by `thread_id` (still persist `week_start`). Keep call-site compatibility: `sendMessage(client, userId, weekStart, content, deps?)` with `deps?: { complete?: ProposeCompleteFn; threadId?: string }` (do not insert a new positional argument — existing tests pass five args). `listChat(client, userId, weekStart, threadId?)` — omitted `threadId` means latest thread so `dashboard.astro` and `GET /api/chat` keep compiling in this phase. After the first user insert, if the thread title is null, set it to `content.trim().slice(0, 60)`. `listChat` also returns `threadId` and `thread`. Coach `history` is last 12 of **that thread**. `reportAssistantGap`: load the flagged row by `id` + `user_id`; load that thread's messages; require it is the last assistant in the thread; keep writing `week_start` from the request Monday onto the gap report. Update `src/pages/api/chat/report.test.ts` seeds to include `thread_id` (and a matching `chat_threads` row) so last-assistant still holds. Do not change `applyMutations` / `acceptDecision` / pending profile-freeze helpers.

### Success Criteria:

#### Automated Verification:

- Migration `supabase/migrations/20260903130000_chat_threads.sql` creates `chat_threads` with owner RLS, adds `chat_messages.thread_id`, and backfills one thread per `(user_id, week_start)`
- `createMemorySupabase()` includes `chat_threads` and round-trips thread rows
- migrate-over-fixture still keeps distinctive `chat_messages` payloads and lists the new SQL file
- `listThreads` returns the caller's threads newest-first; member B cannot read member A's threads
- `sendMessage` without `threadId` uses the latest thread (creating one if needed); with `threadId` it stores on that owned thread
- First user message in an untitled thread sets `title` to the first 60 characters
- Coach history for a turn is the last 12 messages of the active thread, not the visible week
- Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/test/memory-supabase.test.ts src/lib/test/migration-safety.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 2: Thread HTTP API and dashboard load

### Overview

Expose list/create threads, accept optional `threadId` on send, and load a thread's messages on GET without breaking week-scoped pending payloads or 401 gates.

### Changes Required:

#### 1. Threads route

**File**: `src/pages/api/chat/threads.ts` (new), `src/pages/api/chat/threads.test.ts` (new)

**Intent**: Dedicated list/create surface in the existing chat API namespace.

**Contract**: `export const prerender = false`. `GET /api/chat/threads` requires auth; lists the session user's threads newest-first as `{ threads: ChatThread[] }`. Query `planId` is optional and ignored (no plans table). `POST /api/chat/threads` requires auth, empty/ignored JSON body, creates a thread, returns it. Errors: `UNAUTHORIZED`, `UNAVAILABLE`, `DB_ERROR`. Logged-out → 401 JSON, no `threads` payload.

#### 2. Send and GET chat

**Files**: `src/pages/api/chat/messages.ts`, `src/pages/api/chat.ts`, `src/pages/api/chat/messages.test.ts` (new), `src/pages/api/product-gates.test.ts`

**Intent**: Backward-compatible send; GET can pin a thread so the UI can keep one transcript across week changes.

**Contract**: `POST /api/chat/messages` parses optional `threadId`; passes `deps.threadId` into `sendMessage`; includes `threadId` (and thread summary if already returned by the service) on success. Foreign/unknown `threadId` → 404 `NOT_FOUND`. `GET /api/chat` keeps `weekStart` for pending/proposition (same `resolveWeekStart` as today; omitted query still defaults to this UTC Monday). Optional `threadId` query selects messages; omitted → latest thread (create-none: empty `messages` + `threadId: null` is allowed). Response still includes `weekStart`, `messages`, `proposition`, `pendingProfileFreeze`. `messages.test.ts` covers optional `threadId`, default-latest, and 404 for a foreign id. Add GET+POST `/api/chat/threads` to `product-gates.test.ts`.

#### 3. Dashboard SSR

**Files**: `src/pages/dashboard.astro`, `src/components/dashboard/DashboardTabs.tsx` only if new props are required

**Intent**: First paint shows the latest thread, not "this week's" isolated transcript.

**Contract**: `listChat` for SSR uses the latest thread (omit `threadId`). Pass initial `messages` as today. Do not add a required `planId` prop.

### Success Criteria:

#### Automated Verification:

- `GET /api/chat/threads` returns the session user's threads newest-first (optional unused `planId` query is ignored)
- `POST /api/chat/threads` creates an empty thread and returns it
- `POST /api/chat/messages` accepts optional `threadId` and defaults to the latest thread
- `GET /api/chat` loads messages for `threadId` or the latest thread, and still returns week-scoped pending/proposition for `weekStart`
- Logged-out requests to the new thread routes return 401 JSON
- Unit tests pass for the new/extended chat API routes
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

---

## Phase 3: New-thread control and thread list

### Overview

Surface New thread and a compact collapsible thread list in the existing chat column, and stop month navigation from swapping the transcript.

### Changes Required:

#### 1. Presentational chat chrome

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: Header actions stay in the presentational island; workspace owns fetch.

**Contract**: Header row under `Coach chat`: accessible **New thread** button using Lucide `Plus` (`aria-label="New thread"`). Compact collapsible thread list (details/summary or a toggle button + list) **inside** the existing column — do not add a dashboard column and do not change `min-h-[32rem]` / `min-h-[28rem]` / `max-h-[40rem]`. Each row: `title` or fallback `Week of D MMM` (UTC, no leading zero on day, short English month, same family as `formatLoadedDate`) plus a date from `startedAt`. Active row highlighted (`aria-current="true"`). Empty copy exactly `No messages yet.` Do not render delete/rename. Keep optimistic send, Flag, Accept card, loaded chip, helper copy.

#### 2. Workspace state

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: One active thread for the session; calendar week changes must not imply a thread change.

**Contract**: State: `threads`, `activeThreadId`, list collapsed/open as needed. Keep `activeThreadId` in a ref that `loadMonth` reads so the mount `useEffect` does not re-fire on thread switches. On mount (and after create/send), keep the list newest-first. `send()` POSTs `{ weekStart, content, threadId: activeThreadId }` when an id exists. New thread: `POST /api/chat/threads`, set active to the new id, `setMessages([])`, clear optimistic/thinking/loadedRange. Select thread: `GET /api/chat?weekStart=…&threadId=…`, `applyChatBody` for messages/pending. `loadMonth` **must** include `threadId` in the chat GET after an active id exists; never call `/api/chat?weekStart=` alone once a thread is active. Refresh the thread list after send when title may have changed. Do not call reject/accept/range endpoints differently than today.

#### 3. Source-scan tests

**Files**: `src/components/plan/PlanChat.test.ts`, `src/components/plan/PlanWorkspace.test.ts`

**Intent**: Lock the visible contracts in CI without Playwright.

**Contract**: Assert New thread + `Plus`, empty copy `No messages yet.` (not `this week`), fallback `Week of`, `aria-current`, `POST /api/chat/threads`, send body includes `threadId`, loadMonth chat fetch includes `threadId`, height tokens unchanged. Keep existing optimistic / flag / accept / layout assertions.

### Success Criteria:

#### Automated Verification:

- Chat header shows a New thread control with a plus icon and accessible name `New thread`
- Thread list is a compact collapsible list under the header and does not change `min-h-[32rem]` / transcript `min-h-[28rem]` / `max-h-[40rem]`
- Each row shows title or `Week of D MMM` fallback plus a date; the active thread is highlighted
- New thread POSTs a thread and clears the transcript; clicking a row loads that thread's messages
- Month navigation keeps the active thread transcript (does not refetch chat by weekStart alone)
- Empty copy is exactly `No messages yet.`
- Source-scan tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- On `/dashboard`, New thread clears the transcript and the list shows the new row as active
- Clicking an older thread restores its messages without losing them
- Changing the calendar month keeps the same thread visible

---

## Testing Strategy

### Unit Tests:

- Thread list isolation (A vs B), newest-first, default latest on send, foreign `threadId` rejected, title slice 60, last-12 history from the active thread not another week's rows.
- migrate-over-fixture filename list + distinctive `chat_messages` survival.
- API 401 on GET/POST `/api/chat/threads`; POST create; GET list; messages with/without `threadId`.

### Integration Tests:

- Memory persist round-trip for `chat_threads` + `chat_messages.thread_id` (same `createMemorySupabase` pattern as chat.send).

### Manual Testing Steps:

1. Open `/dashboard` Coach chat, send a message, confirm it stays when changing month.
2. Click New thread — transcript empty, plus a new list row; send in the new thread; switch back to the first and see old messages.
3. Confirm Flag / Accept card / thinking placeholder still behave on the active thread.

## Performance Considerations

Thread lists are per-member and small; no pagination in v1. Coach still sends at most 12 turns from the active thread.

## Migration Notes

Local/CI: new file `20260903130000_chat_threads.sql` (timestamp locked in change Notes; sorts between profile-freeze and log-pace-hr). Hosted apply is `DEP-023` — Worker rollback does not undo SQL. Existing `week_start` column is not dropped.

## References

- Change identity: `context/changes/chat-threading/change.md`
- Prior chat behavior: `context/changes/chat-mutations-range-accept-admin/plan.md`
- Test cookbook: `context/foundation/test-plan.md` §6
- Schema today: `supabase/migrations/20260813160000_chat_gated_adaptation.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Threads schema and chat service

#### Automated

- [x] 1.1 Migration `supabase/migrations/20260903130000_chat_threads.sql` creates `chat_threads` with owner RLS, adds `chat_messages.thread_id`, and backfills one thread per `(user_id, week_start)` — 13aa4fc
- [x] 1.2 `createMemorySupabase()` includes `chat_threads` and round-trips thread rows — 13aa4fc
- [x] 1.3 migrate-over-fixture still keeps distinctive `chat_messages` payloads and lists the new SQL file — 13aa4fc
- [x] 1.4 `listThreads` returns the caller's threads newest-first; member B cannot read member A's threads — 13aa4fc
- [x] 1.5 `sendMessage` without `threadId` uses the latest thread (creating one if needed); with `threadId` it stores on that owned thread — 13aa4fc
- [x] 1.6 First user message in an untitled thread sets `title` to the first 60 characters — 13aa4fc
- [x] 1.7 Coach history for a turn is the last 12 messages of the active thread, not the visible week — 13aa4fc
- [x] 1.8 Unit tests pass: `npm test -- src/lib/services/chat.test.ts src/lib/test/memory-supabase.test.ts src/lib/test/migration-safety.test.ts` — 13aa4fc
- [x] 1.9 Full suite passes: `npm test` — 13aa4fc
- [x] 1.10 Lint passes: `npm run lint` — 13aa4fc

### Phase 2: Thread HTTP API and dashboard load

#### Automated

- [x] 2.1 `GET /api/chat/threads` returns the session user's threads newest-first (optional unused `planId` query is ignored) — 5d4daa2
- [x] 2.2 `POST /api/chat/threads` creates an empty thread and returns it — 5d4daa2
- [x] 2.3 `POST /api/chat/messages` accepts optional `threadId` and defaults to the latest thread — 5d4daa2
- [x] 2.4 `GET /api/chat` loads messages for `threadId` or the latest thread, and still returns week-scoped pending/proposition for `weekStart` — 5d4daa2
- [x] 2.5 Logged-out requests to the new thread routes return 401 JSON — 5d4daa2
- [x] 2.6 Unit tests pass for the new/extended chat API routes — 5d4daa2
- [x] 2.7 Full suite passes: `npm test` — 5d4daa2
- [x] 2.8 Lint passes: `npm run lint` — 5d4daa2

### Phase 3: New-thread control and thread list

#### Automated

- [x] 3.1 Chat header shows a New thread control with a plus icon and accessible name `New thread` — d20a89e
- [x] 3.2 Thread list is a compact collapsible list under the header and does not change `min-h-[32rem]` / transcript `min-h-[28rem]` / `max-h-[40rem]` — d20a89e
- [x] 3.3 Each row shows title or `Week of D MMM` fallback plus a date; the active thread is highlighted — d20a89e
- [x] 3.4 New thread POSTs a thread and clears the transcript; clicking a row loads that thread's messages — d20a89e
- [x] 3.5 Month navigation keeps the active thread transcript (does not refetch chat by weekStart alone) — d20a89e
- [x] 3.6 Empty copy is exactly `No messages yet.` — d20a89e
- [x] 3.7 Source-scan tests pass: `npm test -- src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — d20a89e
- [x] 3.8 Full suite passes: `npm test` — d20a89e
- [x] 3.9 Lint passes: `npm run lint` — d20a89e

#### Manual

- [ ] 3.10 On `/dashboard`, New thread clears the transcript and the list shows the new row as active
- [ ] 3.11 Clicking an older thread restores its messages without losing them
- [ ] 3.12 Changing the calendar month keeps the same thread visible
