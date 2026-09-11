# Switch mobile plan nav to a Topbar island — Plan Brief

> Full plan: `context/changes/topbar-plan-nav-island/plan.md`

## What & Why

Mobile Plan is a GET `<select>` that reloads the whole dashboard (`onchange=this.form.submit()`). Take the FU-133 island: `replaceState` `?tab=` on `/dashboard` so the panel swaps in place, and still navigate to `/dashboard?tab=…` from other pages.

## Starting Point

Topbar already has Calendar / List / Profile (desktop links + mobile GET select). `DashboardTabs` panels key off SSR `initialTab` only. `dashboardTabHref` already keeps other query params.

## Desired End State

Below `sm` on `/dashboard`, changing Plan updates `?tab=` without a reload and the calendar / list / profile panel follows. Off `/dashboard`, Plan still GET-navigates. Desktop links, email, Admin, and Sign out are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Click mechanism | `replaceState` on `/dashboard`; assign/GET off it; desktop stays document-load `<a>` | LOCKED **Klik:** / S-133.1–4; do not keep `this.form.submit()` | Plan |
| Panel follow | `DashboardTabs` `useState(initialTab)` + window `CustomEvent` `hf:dashboard-tab` after replaceState | `replaceState` does not fire `popstate`; Topbar select and panels are separate islands | Unattended |
| Keep other params | Reuse `dashboardTabHref` for on-dashboard URL | S-133.2; helper already merges search + hash | Plan |
| Off-dashboard URL | `location.assign("/dashboard?tab=<id>")` only | S-133.3 + desktop hrefs; do not copy landing search | Plan |
| Island surface | New `PlanTabSelect.tsx` (`currentTab` only); Topbar wraps it `sm:hidden` `client:load`; desktop cluster not an island | S-133.1 vs S-133.4; replace vs assign is `isDashboardPathname(window.location.pathname)` | Unattended |
| Select binding | Uncontrolled `defaultValue={currentTab}` from SSR | Change handler owns navigation; nothing else rewrites the select | Unattended |
| Tests | Node helper tests + Topbar/DashboardTabs source-scan; no jsdom/Playwright | test-plan §6.1 / §6.3; vitest is Node + `*.test.ts` | Plan |
| Stale desktop current after mobile replace + rotate | Leave SSR `<span>` / links as-is | S-133.4 forbids islanding desktop chrome | Plan |

## Scope

**In scope:** `PlanTabSelect.tsx`, `Topbar.astro`, `DashboardTabs.tsx`, `dashboard-tabs.ts` (+ tests). `dashboard.astro` only if a new prop is required (not expected).

**Out of scope:** Topbar restyle, `Welcome.astro`, Sign out / email / Admin, in-page tablist, `parseDashboardTab` semantics, Playwright, inventing `.env`.

## Architecture / Approach

Astro Topbar keeps desktop plan items. Mobile select hydrates, calls `applyPlanTabChange` (replace+notify vs assign). `DashboardTabs` listens and toggles `hidden` on the three existing panels.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Mobile Plan island + URL-following panels | No-reload tab swap on dashboard; assign off it | replaceState without notifying panels (no-op) |

**Prerequisites:** none (FU-133 already promoted; GET select is on `master`).
**Estimated effort:** one short session, one phase.

## Open Risks & Assumptions

- Extra `client:load` hydrates the select on every signed-in Topbar page so Plan works on `/` (S-133.3).
- After mobile replaceState, desktop current-tab mark can be stale until reload if the viewport crosses `sm` (accepted; S-133.4).
- Build is planned without creating `.env`; missing-secret build failure is a STOP, not a dummy env file.

## Success Criteria (Summary)

- Mobile Plan select is an island; on `/dashboard` it `replaceState`s and the panel follows; off `/dashboard` it navigates.
- Desktop links, email, Admin, Sign out, and Topbar styling unchanged.
- `npm test`, lint, and build (no invented secrets) pass.
