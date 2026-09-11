<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Tighter dashboard chrome and List tab

- **Plan**: context/changes/dashboard-list-chrome/plan.md
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
| Plan Completeness | PASS |

## Grounding

Grounding: 9/9 existing paths ✓ (PlanList.tsx / PlanList.test.ts are new), 8/8 symbols ✓ (`parseDashboardTab`, `dashboardTabHref`, `formatDayLabel`, `TYPE_TONE`, `MAX_PLAN_GET_RANGE_DAYS`, `utcToday`, `addUtcDays`, `client:load`), brief↔plan ✓ after PLAN-FIX.

Riskiest claims checked in-repo:

- GET `/api/plan` treats omitted `weekStart` as this week’s Monday (`resolveWeekStart(null)`); `from`/`to` uses `listRange` with max 42 days — 21 inclusive is in range.
- `monthGridDates` for a late-month day can end before `today+20` (e.g. 2026-09-20 + 20 days is 2026-10-10; September 2026 grid ends 2026-10-04).
- `formatDayLabel` is exported from `PlanCalendar.tsx`; `TYPE_TONE` is file-private — copying tokens without editing that file matches the locked file list.
- Hydrate: first client render must match SSR (`dashboard-tab-url`); `matchMedia` belongs in `useLayoutEffect`, not `useState` init.

## Findings

### F1 — List fetch-on-mount goes stale after Calendar generate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — PlanList GET
- **Detail**: The first draft fetched the 21-day window once on mount. `PlanList` stays mounted while Calendar is selected (FU-037). Generate / accept / restore update `PlanWorkspace` month state only, so switching to List would show a stale window until a full reload.
- **Fix**: Pass `active={selected === "list"}` from `DashboardTabs`. Fetch when `active` is true; skip while hidden. Phone default still fetches after `useLayoutEffect` selects List.
- **Decision**: FIXED — PLAN-FIX: `active` prop + effect-on-active in Phase 2/3 Success Criteria, Progress 2.3/3.2, brief data-load row, and Performance.

## Triage

- Fixed: F1 (fetch when List is active)
- Skipped: none
- Accepted: none
- Dismissed: none

► Verdict after fixes: SOUND
