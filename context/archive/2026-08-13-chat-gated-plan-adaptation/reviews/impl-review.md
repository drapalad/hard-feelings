<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Chat-Gated Plan Adaptation

- **Plan**: context/changes/chat-gated-plan-adaptation/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-08-13
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warning 2 observations (LOW fixes applied)

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

### F1 — POST /api/chat/messages mapped DB_ERROR to 400

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/chat/messages.ts:27
- **Detail**: `sendMessage` returns `DB_ERROR` on PostgREST failures; the route always used HTTP 400. Accept/reject and `/api/plan` map `DB_ERROR` to 500. Plan contract: 400 only for validation / empty plan / km codes.
- **Fix**: Use `status = result.error.code === "DB_ERROR" ? 500 : 400`.
- **Decision**: FIXED

### F2 — Chat message content had no max length

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/chat.ts chatMessageBodySchema
- **Detail**: `content` was `z.string().min(1)` with no cap; `loadMessages` returns the whole week.
- **Fix**: `z.string().min(1).max(2000)`.
- **Decision**: FIXED

### F3 — Proposition status update keyed only by id

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/chat.ts setPropositionStatus
- **Detail**: Updates used `.eq("id", id)` without `user_id`. RLS still blocks cross-user writes; siblings also filter `user_id`.
- **Fix**: Pass `userId` and `.eq("user_id", userId)`.
- **Decision**: FIXED

## Success criteria

Automated rows in Progress are `[x]` with SHAs. Re-ran `npm test` and `npm run lint` after LOW fixes (pass). Manual rows 4.5–4.9 remain `[ ]` (human-only UI).

## Git scope

Commits `1344b88` … `39e5c81` plus this review commit. Changed files match the plan (migration, DEP-010, services, `/api/chat*`, dashboard workspace). Extra: `PropositionStatus` alias only.
