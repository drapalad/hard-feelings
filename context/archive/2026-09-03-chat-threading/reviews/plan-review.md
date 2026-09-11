<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Chat thread separation

- **Plan**: context/changes/chat-threading/plan.md
- **Mode**: Deep
- **Date**: 2026-09-03
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 11/11 paths ✓ (chat.ts, chat.ts GET, messages.ts, PlanChat.tsx, PlanWorkspace.tsx, memory-supabase.ts, migration-safety.ts, dashboard.astro, product-gates.test.ts, types.ts, chat_gated_adaptation.sql), 6/6 symbols ✓ (listChat, sendMessage, loadMessages, insertMessage, reportAssistantGap, loadMonth), brief↔plan ✓ after triage edits.

## Findings

### F1 — loadMonth identity would retrigger the mount effect

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Workspace state / Critical Implementation Details
- **Detail**: `loadMonth` is a `useCallback` whose identity is in the mount `useEffect` deps (`[initialWeekStart, loadMonth]`). Putting `activeThreadId` in that callback's deps would refetch the whole month (and race `loadSeq`) on every thread switch.
- **Fix**: Keep `activeThreadId` in a ref that `loadMonth` reads; do not add it to the callback deps.
- **Decision**: FIXED — added the ref rule to Critical Implementation Details and the Phase 3 workspace contract.

### F2 — report.test.ts still seeds week-keyed messages

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Types and chat service
- **Detail**: `src/pages/api/chat/report.test.ts` seeds `chat_messages` without `thread_id` and asserts last-assistant-by-week. The plan changed `reportAssistantGap` but did not list that test file.
- **Fix**: Add `report.test.ts` to Phase 1 and require thread seeds.
- **Decision**: FIXED — Phase 1 files/contract now include `src/pages/api/chat/report.test.ts`.

### F3 — sendMessage / listChat signature would break Phase 1 callers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 vs Phase 2
- **Detail**: A new positional `threadId` on `sendMessage` would break existing five-arg tests. Changing `listChat` to require a thread id would break `dashboard.astro` and `GET /api/chat` until Phase 2.
- **Fix**: Optional `deps.threadId`; `listChat(..., threadId?)` defaults to latest.
- **Decision**: FIXED — Phase 1 contract now keeps both signatures backward-compatible; Phase 2 names `messages.test.ts` instead of “if present”.
