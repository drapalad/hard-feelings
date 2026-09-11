<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Fail Send when the extra coach completion throws

- **Plan**: context/changes/coach-data-request-fail-closed/plan.md
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

Grounding: 6/6 paths ✓ (`chat.ts`, `chat.test.ts`, `propose-adaptation.ts`, `backlog.md`, `change.md`, `plan.md`), 4/4 symbols ✓ (`completeSendTurn`, `COACH_UNAVAILABLE_REPLY`, second-catch `loadedKeys = []`, keep-first `it` title), brief↔plan ✓.

Riskiest claims vs code:

1. Second `complete` catch only clears `loadedKeys` — confirmed `src/lib/services/chat.ts` 323–325.
2. First-call catch sets canned reply + empty mutations — confirmed 310–313 (and `proposeAdaptation` 189–192).
3. Auto-apply runs after `completeSendTurn` when `proposed.mutations.length > 0` — confirmed `sendMessage` 165–186. Replacing `raw` before sanitize is sufficient.
4. Seed Friday is 5 km — confirmed `CURRENT` `distanceKm: 5` in `chat.test.ts`.
5. First-call Send is HTTP 200 + assistant bubble, not `ServerError` — confirmed; `ok: true` after `insertMessage` assistant. Notes’ “red error” is informal; plan documents the match.

Blast radius: `completeSendTurn` is only used from `sendMessage`. No island, allowlist, or messages-route change. Pattern: copy the existing first-call `catch`, do not invent a new error type.

## Findings

### F1 — Source-scan 1.2 could pass on the first-call catch alone

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Automated 1.2 / Progress 1.2
- **Detail**: `completeSendTurn` already assigns `COACH_UNAVAILABLE_REPLY` in the first `complete` catch. A file-wide grep for that constant would be green before the second catch is fixed, so the original 1.2 wording did not prove fail-closed.
- **Fix**: Require two `raw = { reply: COACH_UNAVAILABLE_REPLY, mutations: [] }` assignments in `completeSendTurn` (first and second `complete` after `fetchCoachExtra`).
- **Decision**: FIXED — Progress 1.2 and Phase 1 Automated 1.2 now require two catch assignments; second catch must not be `loadedKeys = []` alone.

## Triage

- Fixed: F1 (source-scan 1.2)
- Skipped: none
- Accepted: none
- Dismissed: none

► Verdict after fixes: SOUND
