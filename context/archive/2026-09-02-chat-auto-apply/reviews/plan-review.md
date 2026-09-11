<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coach Send auto-applies when hard bounds pass

- **Plan**: context/changes/chat-auto-apply/plan.md
- **Mode**: Deep
- **Date**: 2026-09-02
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

Grounding: 11/11 paths ✓, 6/6 symbols ✓ (`sendMessage`, `acceptProposition`, `mergeReturnedUnits`, `readRevisionStack`, `snapshotWeekIfChanged`, `rejectPending`), brief↔plan ✓. `docs/reference/contract-surfaces.md` absent — skipped.

## Findings

### F1 — Phase 2 tests would not fail if messages.ts skipped the stack payload

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Messages API returns applied week
- **Detail**: Automated 2.3 ran `chat.test.ts` (Phase 1 persist) and `product-gates.test.ts` (401 only). Neither file reads `messages.ts`. An implementer could persist in `sendMessage` and leave `POST /api/chat/messages` as `{ messages, proposition, logs }` — Desired End State (island merge) would fail with green Phase 2 tests.
- **Fix**: Add a `readFileSync` scan of `messages.ts` in `chat.test.ts` locking `readRevisionStack` / `units` / `validation` / `undoAvailable` / `revisions` and forbidding a 409 `hardBounds` helper.
- **Decision**: FIXED — added Phase 2 “Messages source-scan” change; 2.1 / 2.2 remain the success criteria; 2.3 still runs `chat.test.ts`.

## Triage

- Fixed: F1
- Skipped: none
- Dismissed: none

Verdict after fixes: SOUND
