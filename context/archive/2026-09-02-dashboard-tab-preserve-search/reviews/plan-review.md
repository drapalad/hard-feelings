<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Keep other query params when switching dashboard tabs

- **Plan**: context/changes/dashboard-tab-preserve-search/plan.md
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

Grounding: 9/9 paths ✓, 5/5 symbols ✓ (`dashboardTabHref` 2-arg, `parseDashboardTab` + `initialTab` already wired, `history.replaceState` at `DashboardTabs.tsx:62`, no `pushState`, no `Welcome,` in `dashboard.astro`), brief↔plan ✓.

Riskiest claims vs code:
- `dashboardTabHref` at `dashboard-tabs.ts:19–21` is `` `${pathname}?tab=${tab}` `` — confirmed; extra search/hash are dropped.
- Click site passes `window.location.pathname` only (`DashboardTabs.tsx:62`) — confirmed.
- `dashboard.astro:20` already `parseDashboardTab(Astro.url.searchParams.get("tab"))` — confirmed; other keys do not affect parse.
- Tests still assert replace-only hrefs (`dashboard-tabs.test.ts:29–33`) — confirmed.
- No `pushState` / `Welcome,` on the dashboard page — confirmed.

## Findings

### F1 — Required 4-arg helper would break the island until Phase 2

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Href helper
- **Detail**: The first draft required `dashboardTabHref(tab, pathname, search, hash)` with no defaults. Phase 1 would land that signature while `DashboardTabs.tsx` still called the two-arg form. `npm test` in Phase 1 would still pass (the island is not imported), but `npm run build` / tsc on that commit would fail until Phase 2.
- **Fix**: Default `search = ""` and `hash = ""` so the existing two-arg call still typechecks; Phase 2 is what starts passing `location.search` / `location.hash`.
- **Decision**: FIXED — helper contract and plan-brief signature row now use `search = ""`, `hash = ""`. PLAN-FIX: empty defaults so Phase 1 stays buildable.

## Triage

- Fixed: F1
- Verdict after fixes: SOUND
