<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Coach races context + Accept-gated writes

- **Plan**: context/changes/coach-races-context-accept/plan.md
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 15/15 paths ✓, 12/12 symbols ✓ (`listRaces`, `insertRace`, `updateRace`, `deleteRace`, `validateRaceList`, `acceptProposition`, `acceptPendingProfileFreeze`, `sanitizePendingProfileFreeze`, `toPendingProfileFreeze`, `completeSendTurn`, `sanitizeProposeResult`, `toRawProposeResult`), brief↔plan ✓ after PLAN-FIX. `docs/reference/contract-surfaces.md` absent — skipped.

## Findings

### F1 — Requiring `races_patch` on the row parser would drop existing pending fixtures

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Pending row load / upsert
- **Detail**: `asPendingProfileFreezeRow` today requires `profile_patch`, `freeze_dates`, and `unfreeze_dates`. Memory seeds and `accept-proposition.test.ts` omit `races_patch`. If the parser required `"races_patch" in data`, profile/freeze Accept tests would see `null` pending. Postgres after ADD COLUMN returns the key as null; the memory store does not invent missing keys.
- **Fix**: Treat missing `races_patch` as null. Do not require the key. Seed both shapes in Phase 1 tests.
- **Decision**: FIXED — Phase 1 contract now says missing key parses as null; tests cover no-column fixtures and races-only rows.

### F2 — Unknown remove/patch ids could write profile then 400

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Accept writes
- **Detail**: Draft Accept order validated the projected list then wrote profile/freeze before race mutations. `deleteRace`/`updateRace` `NOT_FOUND` after `upsertProfile` would leave prefs applied and pending still `pending`.
- **Fix**: Fail `NOT_FOUND` on unknown ids during projection, before any writes.
- **Decision**: FIXED — Critical Implementation Details and Phase 3 contract now require unknown-id failure before writes.

### F3 — Leftover `plan_propositions` still steal Accept

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Current State Analysis / What We're NOT Doing
- **Detail**: `acceptProposition` still loads `plan_propositions` first. A stale calendar row wins over profile/freeze/races pending. `chat-drop-pending-propositions` owns that; Notes forbid implementing it here.
- **Fix**: None in this slice — keep documented as a known risk.
- **Decision**: DISMISSED — out of scope; FU-125 already promoted that change. Not a plan defect.

## Triage notes

- PLAN-FIX: Phase 2 also names optional `races` on `CompleteSendInput` / `ProposeCompleteFn` so first-pass tests can assert `calls[0]?.races` (completeness, not a separate finding).
- Progress↔Phase: one `## Progress`; phase names match; 1.1–1.3, 2.1–2.2, 3.1–3.7 mirror Success Criteria; Manual rows are human-only UI; no TODOs.
