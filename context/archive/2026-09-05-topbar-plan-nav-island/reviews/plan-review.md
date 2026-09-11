<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Switch mobile plan nav to a Topbar island without a full reload

- **Plan**: `context/changes/topbar-plan-nav-island/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 9/10 paths ✓ (`Topbar.astro`, `Topbar.test.ts`, `DashboardTabs.tsx`, `dashboard-tabs.ts`, `dashboard-tabs.test.ts`, `dashboard.astro`, `Welcome.astro`, `plan.md`, `plan-brief.md`; `PlanTabSelect.tsx` is a create-target), 6/6 symbols ✓ (`parseDashboardTab`, `DASHBOARD_TABS`, `dashboardTabHref`, `this.form.submit()`, `const selected = initialTab`, `role="tablist"` absent in DashboardTabs), brief↔plan ✓ after PLAN-FIX. `docs/reference/contract-surfaces.md` absent — skipped.

Riskiest claims (Step 3):
1. `DashboardTabs` `selected` is SSR `initialTab` only — **confirmed** `DashboardTabs.tsx:57`.
2. `history.replaceState` does not fire `popstate` — **confirmed** (platform); custom event is required for two islands.
3. `dashboardTabHref` keeps other search params + hash — **confirmed** `dashboard-tabs.ts:36-40` and existing tests.
4. Vitest is Node + `src/**/*.test.ts` — **confirmed** `vitest.config.ts`; no jsdom needed for the helper.
5. GET form + `this.form.submit()` is the mobile control — **confirmed** `Topbar.astro:18-31`. Blast radius: Topbar is also on `/`, auth, admin, privacy — extra `client:load` is in-scope (S-133.3), not an unplanned caller.

## Findings

### F1 — SSR `isDashboardPath` prop vs live pathname for replace/assign

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — PlanTabSelect props / `applyPlanTabChange`
- **Detail**: First draft passed both SSR `isDashboardPath` and `window.location` into the island. Two flags for the same branch would either unused-lint or disagree (`/dashboard` vs `/dashboard/`). Live `window.location.pathname` is the source of truth on change; SSR path remains in Topbar only for desktop current-tab marking.
- **Fix**: Island prop is `currentTab` only. `applyPlanTabChange` branches on `isDashboardPathname(location.pathname)` from live `window.location`. Drop unused `DASHBOARD_TABS` import from `Topbar.astro` after the select map moves.
- **Decision**: FIXED — PLAN-FIX applied to plan.md contracts 2–3 and plan-brief Island surface row.

## Triage

- Fixed: F1 (PLAN-FIX)
- Skipped: none
- Deferred: none
- Dismissed: none

► Verdict after fixes: SOUND
