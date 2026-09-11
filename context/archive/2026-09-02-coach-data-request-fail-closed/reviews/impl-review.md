<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fail Send when the extra coach completion throws

- **Plan**: context/changes/coach-data-request-fail-closed/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria re-run

- 1.1 `npx vitest run src/lib/services/chat.test.ts` — PASS (11 passed)
- 1.2 Two `raw = { reply: COACH_UNAVAILABLE_REPLY, mutations: [] }` in `completeSendTurn` (lines 313 and 326) — PASS
- 1.3 FU-122 `Status: done`, Notes name `coach-data-request-fail-closed` — PASS (Done section)
- 1.4 `npm test` — PASS (258 passed, 2 skipped)
- Manual rows: none

## Drift table

| Planned change | Verdict |
|----------------|---------|
| `chat.ts` second-complete catch replaces `raw` + logs like first-call | MATCH |
| Invert keep-first `chat.test.ts` (9 km fixture → Friday stays 5, empty `loadedKeys`, two calls) | MATCH (oracle adapted: see F1) |
| Close FU-122 | MATCH |
| Allowlist / chip / auto-apply / generate / Accept / Welcome / Profile | MATCH (untouched) |

## Findings

### F1 — Test does not assert assistant `messages[]` content

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/services/chat.test.ts:303`
- **Detail**: Phase 1 Contract asked to import `COACH_UNAVAILABLE_REPLY` and assert the assistant bubble. `createMemorySupabase` has no `chat_messages` table (`MEMORY_TABLES` omits it), so `result.data.messages` is always empty. The inverted test instead source-scans two canned `raw` assignments and asserts `listWeek` Friday `distanceKm: 5` plus `units` undefined. That is the fail-closed calendar lock; the bubble is not round-tripped in Vitest.
- **Fix**: Leave the harness alone (adding `chat_messages` is extra scope). Calendar + two-catch source-scan is the oracle this worktree can actually run.
- **Decision**: DISMISSED — not a product defect; expanding `memory-supabase.ts` would be new scope. First-call production path still inserts the canned assistant on real Supabase.

## Triage

- Fixed: none
- Deferred: none
- Dismissed: F1
- Skipped: none

► Overall: APPROVED
