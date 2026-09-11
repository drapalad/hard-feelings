<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Calendar Manual Edit Implementation Plan

- **Plan**: context/changes/calendar-manual-edit/plan.md
- **Mode**: Deep
- **Date**: 2026-08-14
- **Verdict**: SOUND
- **Findings**: 0 critical 5 warnings 0 observations (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 13/13 existing paths ✓ (`plan/undo.ts` is new, expected), 10/10 claims ✓ (`freezeWriteSchema`, `applyMutations`, `rejectPending` unexported, camelCase jsonb, `PROTECTED_ROUTES`, DEP-012, `weeklyKm` null, no shadcn Dialog, `replaceWeek` upsert-only, no revision table), brief↔plan ✓ after PLAN-FIX.

## Findings

### F1 — `editUnit` omitted `changed` the PUT route needs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 `editUnit` vs PUT contract
- **Detail**: HTTP said skip `rejectPending` on no-op but `EditUnitResult` listed only `{ unit, units, validation, undoAvailable }`. Inferring no-op from `undoAvailable` is wrong when a prior edit already left the stack non-empty.
- **Fix**: Return `changed` from `editUnit` and from PUT JSON; call `rejectPending` only when `changed` is true.
- **Decision**: FIXED — `changed` added to `editUnit` / PUT contracts

### F2 — `applyMutations` does not clear structure on `null`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 `applyUnitEdit`
- **Detail**: `mutation.structure ?? existing.structure` keeps the old value when the patch is `null`. Only `""` omits structure. The plan said empty/null both clear, which would ship a no-op clear for JSON `null`.
- **Fix**: `applyUnitEdit` maps `null` → `""` before `applyMutations`; `undefined` omits the field (keep). Progress 2.2 retitled to match.
- **Decision**: FIXED — contract + Critical Implementation Details + Progress 2.2

### F3 — `hasRevision` in the `listWeek` catch would empty the calendar

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 `dashboard.astro`
- **Detail**: “Same try/catch isolation as `listWeek`” can be read as one catch. If `plan_revisions` is missing (DEP-012 not applied), SSR would also drop units.
- **Fix**: Own try/catch; failure → `undoAvailable = false`; do not clear `units`.
- **Decision**: FIXED

### F4 — Chat Accept left Undo enabled in the island

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 4 vs `acceptProposition` `clearRevisions`
- **Detail**: Generate POST returns `undoAvailable: false`. Accept JSON does not. After Accept, the header Undo would stay enabled until a 404 `NOTHING_TO_UNDO`.
- **Fix**: On successful Accept, set `undoAvailable` false in `PlanWorkspace` (server already `clearRevisions`).
- **Decision**: FIXED

### F5 — `weeklyKm` 0 used as a validate ceiling

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 `editUnit`
- **Detail**: Skip-validate was only on `null`. `getProfile` can return `0`; `validatePlan` would then hard-fail every km. Chat already treats `<= 0` as `INVALID_WEEKLY_KM`.
- **Fix**: Skip `validatePlan` when `weeklyKm` is `null` or `<= 0`; edit still persists.
- **Decision**: FIXED

## Triage

Unattended: all LOW-impact substance fixes applied to the plan. No MEDIUM/HIGH leftovers. FU-001 / FU-002 remain the product decisions already recorded at plan time (undo stack vs picker; persist through hard bounds).

- Fixed: F1, F2, F3, F4, F5
- Verdict after fixes: SOUND
