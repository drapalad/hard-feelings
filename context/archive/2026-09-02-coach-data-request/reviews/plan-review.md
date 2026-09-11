<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coach allowlisted extra context

- **Plan**: context/changes/coach-data-request/plan.md
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

Grounding: 14/14 paths ✓, 9/9 symbols ✓ (`systemPrompt`, `LlmProposeRequest`, `sendMessage`, `listLogsRange`, `listRange`, `listRaces`, `getProfile`, `ProposeCompleteFn`, `PROPOSE_JSON_SCHEMA`), brief↔plan ✓. `docs/reference/contract-surfaces.md` absent — skipped.

Riskiest claims (code-checked):
1. `proposeAdaptation` returns only `sanitizeProposeResult(toRawProposeResult(result), …)` — confirmed; `dataRequestKeys` would be dropped. Direct `complete` in `sendMessage` is required.
2. `POST /api/chat/messages` already spreads `result.data` — confirmed (`messages.ts` 41 and 46).
3. `PlanWorkspace` does not import `@/lib/services/*` — confirmed; chip labels must stay in `PlanChat`.
4. Inclusive windows: `utcToday−13..today` = 14 days; `utcToday−41..today` = 42 days; `createFrom−14..createFrom−1` = 14 days.

## Findings

### F1 — `toRawProposeResult` is private

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — ProposeCompleteFn / sendMessage sanitize
- **Detail**: Phase 2 told `sendMessage` to sanitize after `complete`, but `toRawProposeResult` in `propose-adaptation.ts` is not exported. `sanitizeProposeResult` wants `RawProposeResult`; test stubs return `ProposeResult`.
- **Fix**: Export `toRawProposeResult` and call `sanitizeProposeResult(toRawProposeResult(raw), units, horizon)` after each `complete`.
- **Decision**: FIXED — Phase 2 contract now exports `toRawProposeResult`.

### F2 — `loadedKeys` optional vs always present

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 Send JSON / chip persistence
- **Detail**: Plan allowed omit-or-`[]`. A missing field after a stub Send would leave a previous chip unless the island special-cases it (it already clears on `send()` start, but GET/week-switch is easier with a consistent array).
- **Fix**: Always return `loadedKeys: string[]` on ok Send (empty default).
- **Decision**: FIXED — plan + brief chip-persistence row.

## Triage

Fixed: F1, F2 (2)
► Verdict after fixes: SOUND
