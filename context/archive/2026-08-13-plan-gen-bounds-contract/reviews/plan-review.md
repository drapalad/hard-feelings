<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Plan Generation and Hard-Bound Validator Contract

- **Plan**: context/changes/plan-gen-bounds-contract/plan.md
- **Mode**: Deep
- **Date**: 2026-08-13
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 1 observation


## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 existing paths ✓, 4/4 symbols ✓, brief↔plan ✓

## Findings

### F1 — Dummy Manual rows will pause implementers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phases 1–4 Success Criteria / Progress Manual subsections
- **Detail**: Remaining Manual rows are not human-only. 3.5 is “spot-check BoundCode strings in a fixture”; 4.6 is “spot-check that GenerateResult includes validation”. Both are already implied by Automated 3.2 / 4.2. Phases 1.7 (`npm test` output is readable) and 2.4 (read WorkoutType in types.ts) are the same class and already checked off. Each phase still tells the implementer to pause for human confirmation, so /10x-implement will stop on 3.5 and 4.6 even though an agent can flip them from the suite.
- **Fix**: Delete Progress Manual 3.5 and 4.6 (and their Success Criteria Manual bullets). Omit empty #### Manual subsections. Leave 1.7/2.4 as historical checked rows.
- **Decision**: FIXED — deleted Manual 3.5 and 4.6 (and Success Criteria Manual bullets); left 1.7/2.4 as historical checked rows.

### F2 — Phase 4 needs date arithmetic but never specifies UTC addDays

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 4 generate stub
- **Detail**: The plan correctly forbids local Date parsing (Workers timezone shift) and defines consecutive longs as calendar-day distance. Phase 4 then says “weekStart … weekStart + 6 days” with no how. validate-plan.ts already has a private utcDayNumber via Date.UTC (lines 63–66); it is not shared. An implementer who writes new Date(weekStart) then setDate(+i) reintroduces the bug the plan called out.
- **Fix A ⭐ Recommended**: Add a concrete UTC snippet to Phase 4 (split YYYY-MM-DD, Date.UTC, add n * 86400000, format back). Duplicate or inline; do not add a dates module.
  - Strength: Matches the existing validator helper; keeps F-01 lean.
  - Tradeoff: Two small copies of date math until S-02.
  - Confidence: HIGH — validator already uses this pattern and tests consecutive longs on shuffled array order.
  - Blind spot: Invalid weekStart still has no GenerateErrorCode (out of F-01 HTTP/zod scope; S-02 can guard).
- **Decision**: FIXED — Fix A: UTC addUtcDays snippet in Phase 4; duplicate Date.UTC approach, no dates module.

### F3 — Soft-band frozen success path is not in Phase 4 tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 Automated Verification / generate contract
- **Detail**: The generate contract allows ok: true with soft WEEKLY_VOLUME_EXCEEDED when in-week frozen km already sit in (weeklyKm, weeklyKm * 1.2] and leftover days add 0 km. Automated 4.2 only pins frozen km > 120% as UNSATISFIABLE_BOUNDS. An implementer can treat any frozen overage as unsatisfiable and still pass 4.2, contradicting the locked soft/hard band.
- **Fix**: Add one Automated case: frozen km in the 100–120% band → ok: true, hard empty, soft WEEKLY_VOLUME_EXCEEDED, leftover days 0 km.
- **Decision**: FIXED — added soft-band frozen success case to Phase 4 Automated 4.2 and Testing Strategy.

### F4 — Phase 3 is on disk; Progress still shows it pending

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress → Phase 3; src/lib/services/validate-plan.ts
- **Detail**: validatePlan and its fixtures already match the Phase 3 contract (volume band including exactly ×1.2 → soft, calendar consecutive longs, frozen identity). Progress 3.1–3.5 are still [ ]. CSA still says there is no types.ts / services / test runner. The next implement pass will treat Phase 3 as the next pending step and may rewrite working files.
- **Fix**: After this review, tick Phase 3 from the existing suite (or let /10x-implement re-verify and flip). Do not treat CSA as current.
- **Decision**: FIXED — CSA/brief/Phase 3 now say files exist; implement must re-verify and tick, not rewrite. Progress 3.x left unchecked.
