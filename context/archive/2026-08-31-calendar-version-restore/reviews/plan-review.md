<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Calendar Version Restore

- **Plan**: context/changes/calendar-version-restore/plan.md
- **Mode**: Deep
- **Date**: 2026-08-31
- **Verdict**: SOUND
- **Findings**: 1 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 14/14 paths ✓, 9/9 symbols ✓ (`clearRevisions`, `insertRevision`, `trimRevisions`, `undoWeek`, `hasRevision`, `generateAndPersist`, `acceptProposition`, `weeksEqual`, `PROTECTED_ROUTES`), brief↔plan ✓. Memory harness has no `.limit()` (plan correctly requires it). `races` is not in `MEMORY_TABLES` (plan correctly requires it).

## Findings

### F1 — `replaceWeek` upsert cannot restore an empty pre-generate week

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Current State / Phase 1 — `replaceWeek`
- **Detail**: Desired end state is restore-to-pre-generate, including first generate from an empty calendar. `replaceWeek` only upserts (`onConflict: user_id,date`) and never deletes dates in the week window. Applying `units: []` would leave the generated seven days in place, so undo/restore after first generate would look like a no-op.
- **Fix**: After upsert, delete that user’s `training_units` whose `date` is in `weekDates(weekStart)` and not in the incoming set. Pin with empty → generate → undo → `listWeek` is empty.
- **Decision**: FIXED — plan Critical Implementation Details, Phase 1 helper contract, generate-snapshot extra case, and plan-brief `replaceWeek` row now require in-window deletes.

## Triage

- Fixed: F1
- Verdict after fixes: SOUND
