<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Workout Logging Implementation Plan

- **Plan**: `context/changes/workout-logging/plan.md`
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-08-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `sendMessage` hard-fails chat if `listLogs` throws

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/chat.ts` (non-log success path)
- **Detail**: Explain/life/mutate chat always `await listLogs`. A missing `workout_logs` table (pre-DEP-013) threw into the outer `DB_ERROR` catch after messages were inserted. GET `/api/plan` already swallowed the same failure as `logs: []`.
- **Fix**: Wrap `listLogs` on the non-log success path; return `logs: []` on throw so chat still works before hosted SQL.
- **Decision**: FIXED — non-log `sendMessage` now catches `listLogs` like GET plan

### F2 — Successful upsert/delete reported as `DB_ERROR` when the follow-up list fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/workout-log.ts` (`upsertLog`, `deleteLog`)
- **Detail**: After a committed write, `listLogs` throw returned `{ ok: false, DB_ERROR }`. Unlog then left the badge in place; retry 404'd.
- **Fix**: If the write succeeded, return `ok: true` with `logs: []` when listing fails.
- **Decision**: FIXED — write success no longer depends on the follow-up list

### F3 — Chat mapped log `NOT_FOUND` to `DB_ERROR` (500)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/services/chat.ts` / `src/pages/api/chat/messages.ts`
- **Detail**: Calendar POST `/api/plan/logs` returns 404 `NOT_FOUND`. Chat always used `DB_ERROR` / 500. Unlikely after the stub checks the unit, but the status was wrong.
- **Fix**: Propagate `NOT_FOUND` on `SendMessageResult`; chat messages returns 404.
- **Decision**: FIXED — `NOT_FOUND` is a first-class send error (404)

### F4 — User chat row is inserted before the log write

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/chat.ts` (`insertMessage` then `upsertLog`)
- **Detail**: A failed upsert leaves an orphan user line. Same insert-first shape as the mutation path.
- **Fix A ⭐ Recommended**: Leave insert-first so log chat matches explain/mutate ordering.
- **Fix B**: Upsert first, then insert user+assistant only on success.
- **Decision**: DISMISSED — keep the existing `sendMessage` insert-first pattern; F1/F2 already stop a missing table from failing non-log chat

## Success criteria

Automated Progress rows for phases 1–4 are `[x]` with SHAs. `npm test` and `npm run lint` re-ran green after F1–F3. Manual rows 4.5–4.8 remain `[ ]` (human-only).
