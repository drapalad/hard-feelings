<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Generate next 14 days via coach chat, not the algorithm

- **Plan**: context/changes/generate-via-chat/plan.md
- **Scope**: Phase 1 of 3 through Phase 3 of 3
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observations

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

### F1 — `applyUnitEdit` must opt out of frozen skip

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/services/plan.ts:95
- **Detail**: The plan listed `applyMutations` skip-frozen, not `plan.ts`. `applyUnitEdit` (day-panel Save) reuses `applyMutations`. Default skip would make frozen cell edits no-ops and fail existing `plan.test.ts`. Implementation passes `{ skipFrozen: false }` so chat still skips frozen while the panel can patch type/km and keep the frozen flag.
- **Fix**: Keep the opt-out; do not skip frozen in calendar edits.
- **Decision**: ACCEPTED — FU-119 already records the alternative (`/10x-new calendar-edit-skip-frozen`).

## Success criteria re-run

- `npm test -- src/lib/services/plan-adaptation.test.ts src/lib/services/propose-adaptation.test.ts src/lib/services/openai-chat.test.ts` — pass (phase 1)
- `npm test -- src/lib/services/chat.test.ts src/lib/services/accept-proposition.test.ts src/lib/services/plan-adaptation.test.ts` — pass (phase 2)
- `npm test -- src/components/plan/plan-month.test.ts src/components/plan/PlanCalendar.test.ts src/components/plan/PlanChat.test.ts src/components/plan/PlanWorkspace.test.ts` — pass (phase 3)
- `npm test` — 33 files passed, 1 skipped (227 tests)
- `npm run lint` — pass after `npx astro sync` for worktree `.astro` env types (not committed)
- Manual 3.7 and 3.8 remain `[ ]` (human-only; not rubber-stamped)

## Drift vs plan

- Purple button stays; no `fetch("/api/plan"` POST from `PlanWorkspace`; `onGenerate` → `send(generateHorizonPrompt(...))`.
- `PLAN_EMPTY` gone; composer not disabled on empty units; helper first line exact.
- Sanitize keep = existing dates ∪ horizon; `applyMutations` inserts type+km; frozen skipped on the chat path.
- `sendMessage` loads `listWeek` ∪ `listRange`; horizon passed into propose/complete.
- Volume gated with `gateByIsoWeek`; Accept keep-merges request week + other in-horizon Mondays; client `mergeReturnedUnits`.
- `generatePlan.ts` / `POST /api/plan` remain in the repo. Accept/Reject stay. No hardcoded 14-day fixtures.

## Triage

- **Fixed:** none
- **Accepted:** F1 → FU-119 (1)
- **Deferred:** none
- **Dismissed:** none

► Verdict after triage: APPROVED
