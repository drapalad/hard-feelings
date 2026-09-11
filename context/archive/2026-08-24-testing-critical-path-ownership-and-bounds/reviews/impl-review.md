<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Critical-path ownership and bounds

- **Plan**: context/changes/testing-critical-path-ownership-and-bounds/plan.md
- **Scope**: Phase 1–5 of 5
- **Date**: 2026-08-24
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

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

### F1 — Plan prose says 12 handler methods; table and suite cover 11

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-critical-path-ownership-and-bounds/plan.md (Phase 2 table vs “12 methods” / Progress 2.1)
- **Detail**: Phase 2 Overview, Success Criteria, and Progress 2.1 say “all 12 plan*/chat* methods.” The Changes Required table lists 11 (plan GET+POST, units PATCH+PUT, undo POST, logs POST+DELETE, chat GET, messages POST, accept POST, reject POST). Those 11 are the actual exports. `src/pages/api/product-gates.test.ts` table-drives all 11 with `locals.user = null`. Nothing is missing; “12” is a plan typo.
- **Fix**: Leave as-is, or edit the plan prose/Progress 2.1 title to say 11 so later readers do not hunt a 12th method.
- **Decision**: PENDING

### F2 — Memory fake omits `.limit()` and `.single()`

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/test/memory-supabase.ts:156
- **Detail**: The builder implements the Phase 1 terminals (`select`/`eq`/`in`/`order`/`maybeSingle`/`insert`/`update`/`upsert`/`delete`, plus `count`/`head`). It does not implement `.limit()` (`undoWeek`) or `.single()` (`upsertProfile`). The `as unknown as SupabaseClient` cast hides that. Current ownership and accept tests never hit those chains, so proofs are unaffected. A later undo/profile persist test against this fake would throw at runtime.
- **Fix**: Add `.limit(n)` and `.single()` when a later phase drives undo or profile persist through the fake. Not required for this change.
- **Decision**: PENDING
