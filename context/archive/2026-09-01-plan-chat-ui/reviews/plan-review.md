<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coach chat Enter-to-send and taller composer

- **Plan**: context/changes/plan-chat-ui/plan.md
- **Mode**: Deep
- **Date**: 2026-09-01
- **Verdict**: SOUND
- **Findings**: 0 critical 1 warning 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/9 paths ✓ (`PlanChat.tsx`, `PlanWorkspace.tsx`, `PlanCalendar.test.ts`, `quality-gates.test.ts`, `vitest.config.ts`, `test-plan.md`, `plan.md`, `plan-brief.md`, `change.md`), 6/6 symbols ✓ (`submit` / `onSubmit={submit}`, `min-h-[24rem]`, `max-h-72`, `placeholder="I completed Tuesday"`, `include: ["src/**/*.test.ts"]`, default import only from `PlanWorkspace.tsx`), brief↔plan ✓. No `docs/reference/contract-surfaces.md`. PlanChat.test.ts is a create-target.

## Findings

### F1 — Source-inspection hint regex would false-fail on identifiers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Colocated Node tests
- **Detail**: The test contract asked to assert “no Enter-to-send (or similar) hint string” against `PlanChat.tsx` source. After export, that file will contain `shouldSubmitChatOnEnter` and `key === "Enter"`. A whole-file `/Enter to send|press Enter/i` (or a naive `/enter/i`) would fail a correct implementation.
- **Fix**: Constrain the negative check to `placeholder=` and JSX text children; do not scan identifiers.
- **Decision**: FIXED — Phase 1 test Contract and Testing Strategy now limit the regex to placeholder/JSX text, not identifiers. plan-brief Tests row updated.

## Triage

PLAN-FIX: F1 applied to `plan.md` + `plan-brief.md`. No FU opened (only one reasonable test-oracle reading).
