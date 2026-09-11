<!-- PLAN-REVIEW-REPORT -->
# Plan Review: LLM Chat Proposer Implementation Plan

- **Plan**: `context/changes/llm-chat-proposer/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-16
- **Verdict**: SOUND
- **Findings**: 1 critical 2 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 12/12 existing modify-paths ✓, 5/5 symbols ✓ (`proposeAdaptation`, `applyMutations`, `gateAccept`, `acceptProposition`, `PROTECTED_ROUTES`), brief↔plan ✓. New file `src/lib/services/openai-chat.ts` is a create-target. No `docs/reference/contract-surfaces.md`.

## Findings

### F1 — Phase 2 imports `OPENAI_*` before Phase 3 declares them

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 messages route / Phase 3 `astro.config.mjs`
- **Detail**: Phase 2 required `src/pages/api/chat/messages.ts` to import `OPENAI_API_KEY` from `astro:env/server`, but the `envField` schema was Phase 3. `npm run build` in Phase 2 would fail — Astro only exposes schema-declared keys. Today's schema is only `SUPABASE_*` (`astro.config.mjs:19-21`).
- **Fix**: Move `OPENAI_API_KEY` / `OPENAI_MODEL` `envField` into Phase 2 with the route import. Phase 3 keeps README / `.env.example` / DEP-014 / helper copy.
- **Decision**: FIXED — env schema is Phase 2 item 3 + Progress 2.7; Phase 3.1 is now README docs

### F2 — `completeOpenAiPropose` argument order contradicted itself

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details vs Phase 1
- **Detail**: Critical Details said `completeOpenAiPropose({ apiKey, model, fetchImpl }, request)`. Phase 1 (and the Phase 2 call site) said `completeOpenAiPropose(request, options)`.
- **Fix**: One order: `(request, options)`.
- **Decision**: FIXED — Critical Details now matches Phase 1/2

### F3 — Dropped unknown-date `log` left the model’s “logged …” reply

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Sanitize / log XOR mutations
- **Detail**: Plan dropped `log` when the date had no unit but kept the model `reply`, so the thread could claim a log `sendMessage` never wrote.
- **Fix**: After dropping that `log`, if mutations are empty, set `reply` to `I don't see a workout on that day.` Sanitizer never throws.
- **Decision**: FIXED — Critical Details, Phase 1 sanitizer contract, and Progress 1.4

## Triage

Fixed: F1, F2, F3 (3). Skipped: none. Accepted: none. Dismissed: none.

► Verdict after fixes: SOUND
