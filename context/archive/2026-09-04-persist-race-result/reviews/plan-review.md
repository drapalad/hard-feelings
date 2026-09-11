<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Persist last race result for Estimated paces

- **Plan**: context/changes/persist-race-result/plan.md
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical 2 warnings 1 observation (after triage)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 13/13 existing paths ✓ (new: `last-race.ts` / `last-race.test.ts` / migration file), 6/6 symbols ✓ (`SELECT_COLUMNS`, `getProfile`, `upsertProfile`, `profileWriteSchema`, `formatTime`, `notFound`, `STANDARD_DISTANCES`), brief↔plan ✓ after PLAN-FIX.

Deep verification (no extra sub-agent; parent forbids spawn): PUT omit-keys merge is real in `memory-supabase.ts` upsert; chat accept builds prefs-only `Profile` then `upsertProfile` (`chat.ts` ~864–872); `ProfileView` extra fields do not enter `profilePatchSchema` / `parseProfilePatch`; GET/PUT `toEqual(VALID_BODY)` in `profile.test.ts` would fail once `toProfileView` grows keys; SetupForm already PATCHes `/api/races/:id`.

## Findings

### F1 — Phase 1 `npm test` of profile.test.ts would fail before PATCH

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Automated 1.3 vs Phase 2 GET contract
- **Detail**: Phase 1 changes `toProfileView` / `emptyProfileView` to always emit `lastRaceDate/Km/TimeSec`. Existing GET/PUT tests `toEqual(VALID_BODY)` and no-row GET omit those keys (`src/pages/api/profile.test.ts:95–118`). Gate 1.3 runs that file before PATCH exists, so the phase could not go green.
- **Fix**: Update GET/PUT exact JSON in Phase 1 to include last-race nulls; keep PATCH cases in Phase 2. Change `upsertProfile` return type to `ProfileView`.
- **Decision**: FIXED — added Phase 1 item 5 + Progress 1.3; `upsertProfile` returns `ProfileView`; numeric-string parse called out.

### F2 — Source lock `method: "PATCH"` already true

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria / Lean Execution
- **Location**: Phase 3 Source lock
- **Detail**: `SetupForm.tsx` already PATCHes race edits (`method: editingId === null ? "POST" : "PATCH"`). A `toContain('method: "PATCH"')` lock would pass with no last-race Save.
- **Fix**: Lock `fetch("/api/profile"` + PATCH for last-race Save; do not assert a bare PATCH string.
- **Decision**: FIXED — Phase 3 source-lock contract rewritten.

### F3 — Postgres numeric arrives as string

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 profile service
- **Detail**: `weekly_km` is already parsed from number|string. `last_race_km numeric` will do the same on hosted Postgres; skipping parse would drop the chip after reload.
- **Fix**: Parse `last_race_km` like `weekly_km`.
- **Decision**: FIXED — added to Phase 1 contract and Current State Analysis.

### F4 — Chat freeze upsert is a silent last-race wipe if payload ever includes nulls

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: `src/lib/services/chat.ts` accept pending profile
- **Detail**: Accept builds a six-field `Profile` and upserts. Safe as long as last-race keys stay off `Profile` and off the upsert payload. Plan already forbids putting last race on `Profile`/`ProfilePatch`.
- **Fix**: None beyond the existing omit-keys contract.
- **Decision**: DISMISSED — not an issue if implementer follows the Profile vs ProfileView split; called out in Current State Analysis.

## Triage

- Fixed: F1, F2, F3
- Dismissed: F4
- ► Verdict after fixes: SOUND
