<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Drop the signup chrome source-read unit test

- **Plan**: context/changes/signup-chrome-no-unit-test/plan.md
- **Mode**: Deep
- **Date**: 2026-09-02
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 7/7 paths ✓ (`signup.test.ts`, `signup.astro`, `signin.astro`, `Topbar.astro`, `SignUpForm.tsx`, `quality-gates.test.ts`, `vitest.config.ts`), 3/3 symbols ✓ (`PHASE_1_3_TESTS`, Vitest `include: ["src/**/*.test.ts"]`, shipped Topbar/card/`client:load` tokens in `signup.astro`), brief↔plan ✓ (one phase, delete-only, grep/review not CI).

Riskiest claims (code, no sub-agent): (1) `signup.test.ts` exists and is the only `src/pages/auth/*.test.ts` — confirmed. (2) `PHASE_1_3_TESTS` does not list it — confirmed lines 7–15. (3) `signup.astro` already has the claimed chrome — confirmed lines 3–20. Blast radius: no production importers of the test file. Pattern: `signin.astro` ships the same chrome without a colocated test.

## Findings

### F1 — 1.2 only gated `src/pages/auth/*.test.ts`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Automated 1.2
- **Detail**: Contract already forbids any new `src/**/*.test.ts` whose purpose is signup chrome. Success criterion 1.2 only said no new `src/pages/auth/*.test.ts`, so a replacement under `src/components/` would still pass Progress.
- **Fix**: Widen 1.2 (phase + Progress) to: the only `src/**/*.test.ts` delta is deleting `src/pages/auth/signup.test.ts`.
- **Decision**: FIXED — 1.2 now covers all of `src/**/*.test.ts`.

### F2 — `signup.astro` missing from the unchanged-files gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Automated 1.4
- **Detail**: Desired End State and What We're NOT Doing require leaving sign-up markup as shipped. 1.4 listed signin/Topbar/SignUpForm but not `signup.astro`. Token greps in 1.3 can pass after a restyle that keeps those substrings.
- **Fix**: Add `src/pages/auth/signup.astro` to the 1.4 unchanged list (keep 1.3 greps as the LOCKED grep/review check).
- **Decision**: FIXED — `signup.astro` is on 1.4; 1.3 greps kept.

## Triage summary

- Fixed: F1, F2
- Skipped: none
- Dismissed: none
- Deferred: none

► Verdict after fixes: SOUND
