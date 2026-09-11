---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "topbar-plan-nav: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: topbar-plan-nav

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- Signed-in Topbar is email + Dashboard (`aria-current="page"` span on `/dashboard`, else purple `/dashboard` link) + optional Admin + Sign out (`src/components/Topbar.astro:10-34`). No Calendar / List / Profile. No `<select>`.
- In-page `role="tablist"` `aria-label="Dashboard"` in `DashboardTabs` maps Calendar / List / Profile (`src/components/dashboard/DashboardTabs.tsx:82-111`, `src/components/dashboard/dashboard-tabs.ts:1-5`). `?tab=` already selects the panel; `tab=week` → calendar (`dashboard-tabs.ts:15-17`).
- `Topbar.test.ts` source-scans the Dashboard current-page span and purple link (`src/components/Topbar.test.ts:7-21`) and asserts email / Sign out / Admin unchanged (`:24-31`).
- Dashboard page composes Topbar + `DashboardTabs` (`src/pages/dashboard.astro:91-110`).

## Code References

- `src/components/Topbar.astro:2-34` - signed-in items
- `src/components/Topbar.test.ts:7-32` - Dashboard / email / Sign out / Admin scans
- `src/components/dashboard/DashboardTabs.tsx:80-145` - in-page tablist + panels
- `src/components/dashboard/dashboard-tabs.ts:1-23` - DASHBOARD_TABS + parseDashboardTab including week
- `src/pages/dashboard.astro:91-110` - composition
- `src/middleware.ts:6` - /dashboard protected

## Architecture Insights

Tab state is already URL-driven (`history.replaceState` + `parseDashboardTab`). Moving the labels to Topbar can keep `DashboardTabs` panels and drop only the in-page tablist. Topbar is Astro (no client:load); a mobile `<select>` that navigates `?tab=` is a full page load unless Topbar becomes an island.

## Open Questions

- Whether Topbar must become a React island for the native select, or a plain form GET is enough — not decided in Notes.
- `DashboardTabs` still defaults narrow viewports to list when `urlTab` is empty (`:73-76`, `selectDashboardTab` in dashboard-tabs.ts:29-33`). Interaction with topbar current-tab marking not traced.
- No migration. Test cookbook: Topbar tests are source-scan; update those strings. `test-plan.md` §6.1.
- Landing CTA still says Open dashboard after this change (separate id); Topbar must not keep the word Dashboard (S-11.5).
