<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Coach Send auto-applies when hard bounds pass

- **Plan**: context/changes/chat-auto-apply/plan.md
- **Scope**: Phase 1 of 3 through Phase 3 of 3
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 1 warning 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Hard Send left the previous calendar amber banner

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plan/PlanWorkspace.tsx:334
- **Detail**: `send()` on `validation.hard.length > 0` set the red chat list and returned without merging units, but did not clear `warnings`. A prior soft apply left the calendar amber list in place, which the plan reserved for “plan already updated.”
- **Fix**: `setWarnings([])` on the hard branch; lock with a source-scan that the hard path clears warnings.
- **Decision**: FIXED — hard Send now clears calendar warnings; PlanWorkspace.test.ts asserts the branch.

### F2 — Workspace still holds unread proposition state

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/plan/PlanWorkspace.tsx:182
- **Detail**: `dashboard.astro` still passes `proposition`. The island keeps `[, setProposition]` for GET/restore/edit so SSR types stay, but PlanChat no longer reads it.
- **Fix**: Leave the SSR prop; dropping it would touch dashboard.astro outside the locked file list.
- **Decision**: DISMISSED — keeping the GET/SSR field avoids an unplanned dashboard.astro edit.

## Success criteria

Automated rows in Progress are `[x]` with SHAs `55fca5e` / `35465f7` / `ea643cf`. Re-checked scoped Vitest for the F1 follow-up. Manual 3.6 and 3.7 remain `[ ]`.

## Triage

- Fixed: F1
- Dismissed: F2
- Deferred: none
