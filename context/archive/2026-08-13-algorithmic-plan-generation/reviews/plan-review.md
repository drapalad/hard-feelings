<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Algorithmic Plan Generation

- **Plan**: context/changes/algorithmic-plan-generation/plan.md
- **Mode**: Deep
- **Date**: 2026-08-13
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 14/14 paths ✓, generatePlan/toRaceInput/PROTECTED_ROUTES/unauthorized/MISSING_WEEKLY_KM ✓, brief↔plan ✓ (after F1–F3 applied).

## Findings

### F1 — Delete-then-insert is not a PostgREST transaction

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 3 `replaceWeek`
- **Detail**: Plan originally deleted the 7-day window then inserted. Two round-trips; if insert fails after delete the week is empty. F-01 always returns exactly those seven dates, so upsert on `(user_id, date)` overwrites without a blank window.
- **Fix**: Persist via upsert on `(user_id, date)`; do not delete the window first.
- **Decision**: FIXED

### F2 — `utcMondayOf` Sunday offset not specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 dates contract
- **Detail**: ISO Monday from `getUTCDay()` must map Sunday (`0`) to offset `-6`. Naive `1 - day` would jump Sunday to next Monday and split the displayed week.
- **Fix**: Document Sunday → previous Monday; test `utcMondayOf("2026-08-16") === "2026-08-10"`. `weekDates` starts from `utcMondayOf(weekStart)`.
- **Decision**: FIXED

### F3 — Non-Monday `weekStart` would persist a mid-week window

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 GET/POST `/api/plan`
- **Detail**: `generatePlan` treats `weekStart` as day 0 of seven, not as ISO Monday. A Wednesday body would store Wed–Tue and desync the calendar. GET wording mixed “invalid → default” with “present but invalid → 400”.
- **Fix**: Omit → `utcMondayOf(utcToday())`; present but not `YYYY-MM-DD` → 400; valid date → `utcMondayOf`. Return the normalized Monday as `weekStart`.
- **Decision**: FIXED
