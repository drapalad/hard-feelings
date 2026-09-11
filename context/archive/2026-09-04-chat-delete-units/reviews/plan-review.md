<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coach and day panel can delete a calendar workout

- **Plan**: context/changes/chat-delete-units/plan.md
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 18/18 paths ✓, 9/9 symbols ✓ (`applyMutations`, `persistProposedUnits`, `incomingForWeek`, `mondaysToPersist`, `replaceWeek`, `editUnit`, `toRawProposeResult`, `parsedProposeSchema`, `training_units_delete_own`), brief↔plan ✓

Riskiest claims vs code:
- `toRawProposeResult` omits `delete` — confirmed (`propose-adaptation.ts:175-188`); live `completeSendTurn` round-trips through it.
- `incomingForWeek` re-seeds out-of-horizon existing rows — confirmed (`chat.ts:786-791`).
- `mondaysToPersist` only adds in-horizon remaining units + request Monday — confirmed (`chat.ts:760-771`).
- `replaceWeek` leftover DELETE uses `training_units` + RLS — confirmed (`plan.ts:339-348`; policy in `20260813130000_training_units.sql`).
- `mergeWeekSlice` drops week dates absent from incoming — confirmed (`plan-month.ts:28-32`).
- Blast radius: `acceptProposition` also calls `persistProposedUnits`; Flag snapshot stores `UnitMutation[]` (optional `delete` is additive); `applyUnitEdit` does not set `delete`.

## Findings

### F1 — persistProposedUnits callers besides sendMessage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — persistProposedUnits / incomingForWeek
- **Detail**: `acceptProposition` also calls `persistProposedUnits(client, userId, monday, proposedUnits, horizon)` with stored units, not mutations. A required new `deletedDates` argument without a default would break Accept; inferring deletes from missing units would wipe keep-merge days.
- **Fix**: Optional `deletedDates` defaulting to `[]`; only `sendMessage` passes dates from `mutation.delete === true`.
- **Decision**: FIXED — Phase 2 contract now defaults the argument to `[]` so Accept stays a no-op for deletes.

### F2 — plan.test.ts in gates but not in Changes Required

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — deleteUnit / Success Criteria
- **Detail**: Automated 3.1 and eslint list `src/lib/services/plan.test.ts`, but Phase 3 Changes Required originally stopped at `plan.ts` without naming the colocated test file.
- **Fix**: Name `plan.test.ts` in Phase 3.1 and 3.4 contracts.
- **Decision**: FIXED — `deleteUnit` coverage called out in Phase 3.1; test file added to Phase 3.4 file list.

### F3 — Chat UI merge already exists

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 vs Phase 3
- **Detail**: `PlanWorkspace` already `mergeReturnedUnits`s Send `units`. Chat calendar refresh after a persisted delete does not need a new merge helper if Phase 2 returns the remaining week from `listWeek`.
- **Fix**: Note that Phase 3 only adds the day-panel DELETE fetch; chat uses the existing Send merge.
- **Decision**: FIXED — Phase 2 contract states `mergeReturnedUnits` already covers Send `units`.
