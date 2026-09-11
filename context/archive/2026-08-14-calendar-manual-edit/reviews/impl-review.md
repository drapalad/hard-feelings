<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Calendar Manual Edit Implementation Plan

- **Plan**: context/changes/calendar-manual-edit/plan.md
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-08-15
- **Verdict**: APPROVED
- **Findings**: 0 critical 4 warnings 2 observations (all triaged)

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

### F1 — Persist success could still 500 after rejectPending / post-write reads

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/plan/units.ts`, `src/pages/api/plan/undo.ts`, `src/lib/services/plan.ts` `editUnit`
- **Detail**: `rejectPending` ran only after `editUnit`/`undoWeek` returned ok. A throw 500'd the request so the island did not apply the body. `validationForWeek` / `hasRevision` after a successful UPDATE could also turn a landed edit into `{ ok: false }`, leaving a pending Accept able to clobber it. Undo could pop twice if the first HTTP failed after deleting a revision.
- **Fix**: Treat persist as success; wrap `rejectPending` and post-write revision/validation reads so they cannot fail the HTTP response.
- **Decision**: FIXED — try/catch around `rejectPending`; post-write validation/`hasRevision` failures return empty validation / best-effort `undoAvailable`

### F2 — Trim ran before the unit UPDATE

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/plan.ts` `editUnit`
- **Detail**: `insertRevision` → `trimRevisions` → UPDATE. A failed UPDATE at cap 10 dropped the oldest snapshot and left a no-op snapshot of the unchanged week.
- **Fix**: UPDATE with `maybeSingle` first (404 if no row); snapshot + trim only after a confirmed write.
- **Decision**: FIXED

### F3 — GET /api/plan and generate/accept tied persist to `plan_revisions`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/plan.ts` GET; `generateAndPersist`; `acceptProposition`
- **Detail**: `hasRevision` shared `listWeek`'s try, so a missing `plan_revisions` table (DEP-012) 500'd week nav. `clearRevisions` after `replaceWeek` could 500 generate/accept after the week was already written.
- **Fix**: Isolate `hasRevision` on GET (`undoAvailable: false` on failure). Best-effort `clearRevisions` after generate/accept persist.
- **Decision**: FIXED

### F4 — `editUnit` UPDATE ignored row count

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/services/plan.ts` `editUnit` vs `setFrozen`
- **Detail**: `setFrozen` uses `.select().maybeSingle()` and 404s on no row. `editUnit` UPDATE ignored count and could snapshot then report success for a missing date.
- **Fix**: Same `maybeSingle` check; `NOT_FOUND` if nothing updated; do not snapshot in that case.
- **Decision**: FIXED

### F5 — `replaceWeek` upsert does not delete extra dates

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/lib/services/plan.ts` `replaceWeek`
- **Detail**: Undo restores via the existing S-02 upsert. Dates absent from a snapshot are not deleted. Edits do not add/remove days; generate writes seven dates.
- **Fix**: Leave `replaceWeek` as S-02 defined it; do not change generate/accept semantics in this slice.
- **Decision**: DISMISSED — inherited S-02 contract; S-04 snapshots `listWeek` so undo restores the same dates

### F6 — `unitEditSchema` omits `.finite()`

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/lib/services/plan.ts` `unitEditSchema`
- **Detail**: Plan said finite ≥ 0. Code is `z.number().nonnegative()`. Zod 4 `z.number()` already rejects infinities (`.finite()` is a linted no-op in this repo).
- **Decision**: DISMISSED — Zod 4 number() does not allow infinite values; matching the lint rule used in Phase 2

## Triage

Unattended: all LOW-impact WARNING fixes applied. Observations dismissed (S-02 upsert; Zod 4 number). No CRITICAL. FU-001 / FU-002 remain the plan-time product decisions (undo stack vs picker; persist through hard bounds).

- Fixed: F1, F2, F3, F4
- Dismissed: F5, F6
- Verdict after fixes: APPROVED
