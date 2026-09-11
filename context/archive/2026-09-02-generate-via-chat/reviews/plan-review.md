<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Generate next 14 days via coach chat

- **Plan**: context/changes/generate-via-chat/plan.md
- **Mode**: Deep
- **Date**: 2026-09-02
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths ✓, 9/9 symbols ✓ (`replaceWeek`, `listRange`, `listWeek`, `applyMutations`, `sanitizeProposeResult`, `sendMessage`, `acceptProposition`, `generatePlanButtonLabel`, `utcToday`/`addUtcDays`/`inclusiveIsoDates`), brief↔plan ✓ after PLAN-FIX.

## Findings

### F1 — Horizon-only Accept would skip ordinary chat weeks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details — Accept persist; Phase 2
- **Detail**: First draft persisted only Mondays with an in-horizon proposed date. Chat stays on the visible `weekStart`. A “make Wednesday a long” on a week entirely outside today…today+13 would store a proposition that Accept never wrote. `acceptProposition` today always `replaceWeek`s the request Monday.
- **Fix**: Always persist the request week (keep-merge if it overlaps the horizon; else today’s `replaceWeek` of that week’s proposed slice). Also persist other Mondays that have in-horizon proposed units.
- **Decision**: FIXED — keep-merge + always persist request week; Progress 2.4 title updated to match.

### F2 — Frozen check used only the request week’s `listWeek`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Accept persist merge
- **Detail**: `acceptProposition` currently passes `current.filter(frozen)` from `listWeek(request weekStart)`. Per-week `gateAccept` on week 2 would not see week-2 frozen anchors and could overwrite them.
- **Fix**: Load frozen from `listWeek` of each affected Monday.
- **Decision**: FIXED — added **Frozen at Accept** to Critical Implementation Details and Phase 2 contract.

### F3 — Week-empty hint left optional

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Calendar chrome
- **Detail**: “Optional: retarget Generate to fill the calendar” is an unanswered copy fork. After the button no longer POSTs a week fill, that sentence is false.
- **Fix**: Require dropping “Generate to fill the calendar.” Keep “No plan for this week yet.”
- **Decision**: FIXED — calendar contract now requires that copy drop.

### F4 — Consecutive longs across ISO weeks

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details — Validate per ISO week
- **Detail**: Per-week `validatePlan` will not flag a long on Sunday plus a long on Monday. That is already true of today’s week-scoped chat. Not in locked Notes.
- **Fix**: Leave as today’s week-scoped consecutive-long rule.
- **Decision**: DISMISSED — same as current chat; not this slice.

## Triage

PLAN-FIX applied to `plan.md` / `plan-brief.md` for F1–F3. F4 dismissed. `ProposeCompleteFn` threading of `createFrom`/`createTo` was already added in Phase 1 contract during the same pass.

► Verdict after fixes: SOUND
