<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Explicit workout stage kinds plus Make AI

- **Plan**: `context/changes/workout-stages-make-ai/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 13/13 existing paths ✓, new route/migration correctly absent, 6/6 symbols ✓ (`UNIT_COLUMNS`, `unitEditSchema`, `parseWorkoutStages`, `applyMutations`, `completeOpenAiPropose`, Make AI slot comment), brief↔plan ✓ after PLAN-FIX.

Verified claims: `applyMutations` reconstructs units without extra fields (would drop `stages`); `UNIT_COLUMNS` omits `stages`; `PlanWorkspace.saveUnit` stringifies `UnitEditPayload`; `migration-safety.test.ts` hard-codes the filename list; `WorkoutStageKind` currently lives only in `workout-stages.ts`; `openai-chat.ts` is the Completions+zod pattern and must not be edited (Flag snapshot).

## Findings

### F1 — Phase 2 left UnitEditPayload timing optional

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — former “Client payload type”
- **Detail**: The plan told the implementer they “may” type `UnitEditPayload` in Phase 2 or wait for Phase 4. That is an unanswered question. `plan-adaptation.test.ts` also asserts exact unit object shapes; adding a `stages` key on units that never had one would fail those fixtures.
- **Fix**: Lock payload typing to Phase 4. In Phase 2, when `existing.stages` is absent and the mutation omits `stages`, do not add a `stages` property.
- **Decision**: FIXED — removed the optional payload bullet; added Phase 2 contract “preserve-without-a-key”. `UnitEditPayload.stages` is Phase 4 only.

### F2 — Make AI route created an unused Supabase client

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — HTTP route
- **Detail**: Opening `createClient` “even if unused” so tests can mock a store contradicts S-06.2 (no calendar write). A future edit could upsert through a client that is already in scope. 503-on-missing-Supabase does not apply when the handler never reads the DB.
- **Fix**: Do not call `createClient`. 503 only for missing `OPENAI_API_KEY`. Model from `resolveOpenAiModel(null, OPENAI_MODEL)`. Tests assert the handler never calls `createClient` / `editUnit` / `replaceWeek`.
- **Decision**: FIXED — Phase 3 contract and Progress 3.3 updated; brief LLM-failures row updated.

### F3 — Duplicate WorkoutStageKind unions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — Types vs `workout-stages.ts`
- **Detail**: Plan added `WorkoutStageKind` on `src/types.ts` while `workout-stages.ts` already exports the same union and `WorkoutStagesChart` imports it from there. Two unions drift.
- **Fix**: `types.ts` owns the union; `workout-stages.ts` re-exports from `@/types`.
- **Decision**: FIXED — Phase 1 Types contract now requires the re-export and forbids a second union.

## Triage

Fixed: F1, F2, F3. Skipped: none. Dismissed: none.

Verdict after fixes: SOUND.
