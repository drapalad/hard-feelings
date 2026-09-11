<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: LLM Chat Proposer Implementation Plan

- **Plan**: `context/changes/llm-chat-proposer/plan.md`
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-08-16
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 1 observation

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

### F1 — Empty `OPENAI_MODEL` was sent to OpenAI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/pages/api/chat/messages.ts:29`
- **Detail**: `OPENAI_MODEL ?? "gpt-4o-mini"` kept `""` from `.env.example`. A filled key plus blank model would 400 and surface the unavailable-coach reply. The plan specified `OPENAI_MODEL || "gpt-4o-mini"`; `SUPABASE_*` already treats empty as unset.
- **Fix**: Treat undefined and `""` as `gpt-4o-mini`.
- **Decision**: FIXED — `messages.ts` now defaults empty `OPENAI_MODEL` to `gpt-4o-mini`

### F2 — Empty parsed `reply` did not throw; Thursday `complete` test was missing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/services/openai-chat.ts`; `propose-adaptation.test.ts`
- **Detail**: Plan: missing/empty `reply` after parse is the client’s throw; Phase 2 tests include a mocked `complete` Thursday recovery and an OpenAI body with both `log` and mutations. Zod `z.string()` allowed `"   "`. Thursday was only in the plan’s test contract.
- **Fix**: Throw on blank `reply`; add the Thursday `complete` case and a fetch-body log XOR case.
- **Decision**: FIXED — client throws on blank reply; tests cover Thursday recovery and log XOR on the HTTP parse path

### F3 — Failed `upsertLog` still orphans the user chat row

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/chat.ts` (`insertMessage` then `upsertLog`)
- **Detail**: LLM throw is caught inside `proposeAdaptation` and still writes an assistant reply. A failed log persist after the user row is inserted still returns an error with no assistant row. Same insert-first shape as S-03/S-05; already dismissed on workout-logging F4.
- **Fix**: Leave insert-first so log chat matches explain/mutate ordering.
- **Decision**: DISMISSED — out of S-07 scope; keep the existing `sendMessage` insert-first pattern

## Success criteria

Automated Progress rows for phases 1–3 are `[x]` with SHAs. `npm test` (69) and `npm run lint` re-ran green after F1–F2. Manual rows 3.6–3.9 remain `[ ]` (human-only).
