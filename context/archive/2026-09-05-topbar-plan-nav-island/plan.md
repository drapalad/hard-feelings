# Switch mobile plan nav to a Topbar island without a full reload — Implementation Plan

## Overview

Replace the signed-in mobile Plan GET `<select>` (`onchange=this.form.submit()`) with a `client:load` island that `replaceState`s `?tab=` on `/dashboard` so the dashboard panel swaps without a reload, and still GET-navigates to `/dashboard?tab=…` off the dashboard. Desktop Calendar / List / Profile stay document-load links. Email, Admin, and Sign out stay unchanged.

## Current State Analysis

Signed-in `Topbar.astro` already shows Calendar / List / Profile: desktop `sm:flex` anchors (or a current-page `<span>`), and below `sm` a GET form to `/dashboard` with `<select name="tab" aria-label="Plan">` that submits on change. That full reload is the bug this change reverses (FU-133 island alternative).

`DashboardTabs` (`client:load` on `dashboard.astro`) still mounts Calendar / List / Profile panels with `hidden={selected !== …}` and `PlanList active={selected === "list"}`, but `selected` is the SSR `initialTab` only. `history.replaceState` does not fire `popstate`, so a Topbar-only URL rewrite would leave the visible panel stuck unless `DashboardTabs` is told the new tab.

`dashboardTabHref` in `dashboard-tabs.ts` already merges `tab` into existing search and keeps the hash. Desktop Topbar hrefs are still literal `/dashboard?tab=calendar|list|profile` (document load; S-133.4).

## Desired End State

On `/dashboard` below `sm`, changing Plan updates the query with `replaceState` (other params kept) and the visible panel follows without a document load. Off `/dashboard`, changing Plan still goes to `/dashboard?tab=…`. Desktop plan items, email, Admin, and Sign out look and behave as they do today. `Welcome.astro` is untouched.

### Key Discoveries:

- `src/components/Topbar.astro:18-31` — GET form + `onchange="this.form.submit()"` is the mobile control to replace; the `sm:hidden` wrapper and select classes stay.
- `src/components/dashboard/DashboardTabs.tsx:57` — `const selected = initialTab` cannot follow a client `replaceState`.
- `src/components/dashboard/dashboard-tabs.ts:36-40` — `dashboardTabHref(tab, pathname, search, hash)` is the keep-other-params helper (S-133.2).
- `history.replaceState` does not fire `popstate`. The Plan island and `DashboardTabs` are separate React trees, so the island must notify the panel island after rewriting the URL.
- Vitest is Node + `src/**/*.test.ts` only (`vitest.config.ts`). No jsdom / Playwright for this chrome (test-plan §6.1 / §6.3).
- `SUPABASE_*` env fields are optional (`astro.config.mjs`). Do not create `.env` / `.dev.vars` in this worktree.

## What We're NOT Doing

- Restyling Topbar (colors, spacing, email/Admin/Sign out chrome)
- Islanding desktop `sm:flex` Calendar / List / Profile (S-133.4; **Klik:** document load)
- Changing Sign out (POST `/api/auth/signout`), email, or Admin
- Touching `Welcome.astro` (owned by `landing-signed-in-cta`)
- Reintroducing the in-page Dashboard `role="tablist"`
- Changing `parseDashboardTab` / `DASHBOARD_TABS` labels or `week` → calendar
- Playwright / e2e
- Copying secrets or inventing a `.env` so build can run

## Implementation Approach

Keep Topbar as Astro for desktop links. Extract only the mobile `<select>` into a React island (`PlanTabSelect`) mounted with `client:load` inside the existing `sm:hidden` slot. On change, if the pathname is `/dashboard` or `/dashboard/`, `replaceState` via `dashboardTabHref` and notify `DashboardTabs`; otherwise `location.assign` to `/dashboard?tab=<id>`. `DashboardTabs` holds `selected` in state, starts from `initialTab`, and updates when notified (and on `popstate` if the user later uses history).

## Critical Implementation Details

### Timing & lifecycle

`history.replaceState` does not fire `popstate`. After a successful on-dashboard rewrite, the Plan island must dispatch a window `CustomEvent` (`hf:dashboard-tab`, `detail` = the tab id) so `DashboardTabs` can set `selected`. Listening to `popstate` alone is a no-op for this click path.

### User experience spec

On-dashboard `replaceState` must keep other query params and the hash (`dashboardTabHref`). Off-dashboard navigation matches the desktop hrefs: `/dashboard?tab=<id>` only (do not copy the landing page’s search). Desktop current-tab `<span>` stays SSR; after a mobile `replaceState`, rotating to `sm+` may show a stale current mark until the next document load — that is required by S-133.4 (do not island the desktop links to fix it).

---

## Phase 1: Mobile Plan island + URL-following panels

### Overview

Ship the `client:load` Plan `<select>`, on-dashboard `replaceState` + panel follow, off-dashboard assign, and source/unit tests. Desktop plan items and account chrome stay as they are.

### Changes Required:

#### 1. Plan tab navigation helper

**File**: `src/components/dashboard/dashboard-tabs.ts`

**Intent**: Give the island and the panel island a shared, Node-testable way to decide replace vs assign and to name the notify event, reusing `dashboardTabHref` so other query params stay.

**Contract**: Export `DASHBOARD_TAB_EVENT` (`"hf:dashboard-tab"`), `isDashboardPathname(pathname)` true for `/dashboard` and `/dashboard/`, and `applyPlanTabChange(tab, location, deps)` that: on a dashboard pathname, `replaceState`s `dashboardTabHref(tab, pathname, search, hash)` then `notify(tab)`; otherwise `assign(dashboardTabHref(tab, "/dashboard"))`. `deps` is `{ replaceState(url), assign(url), notify(tab) }` so tests do not need `window`. Do not change `parseDashboardTab`, `DASHBOARD_TABS`, or existing `dashboardTabHref` behavior.

#### 2. Mobile Plan select island

**File**: `src/components/dashboard/PlanTabSelect.tsx`

**Intent**: Render the locked mobile Plan `<select>` as a React island with required interactivity (replaceState / assign). No `"use client"`.

**Contract**: Default-export a component with prop `currentTab: DashboardTab` only (SSR selected option). Render `<select aria-label="Plan">` with options from `DASHBOARD_TABS` (labels **Calendar**, **List**, **Profile**), `defaultValue={currentTab}`, and the same class string as today’s select (`rounded-md border border-white/10 bg-white/10 px-2 py-1 text-sm text-white`). On change, `parseDashboardTab` the value and call `applyPlanTabChange` with live `window.location` `{ pathname, search, hash }` (the helper’s `isDashboardPathname` is the replace/assign branch — do not pass a second SSR flag) and real `history.replaceState` / `location.assign` / `dispatchEvent(new CustomEvent(DASHBOARD_TAB_EVENT, { detail: tab }))`. Do not wrap in a GET form. Do not restyle.

#### 3. Topbar mounts the island; desktop links stay Astro

**File**: `src/components/Topbar.astro`

**Intent**: Drop the GET form submit. Mount only the mobile select as `client:load`. Leave desktop plan items, email, Admin, and Sign out as they are.

**Contract**: Replace the `sm:hidden` GET `<form method="GET" action="/dashboard">` / `onchange="this.form.submit()"` with a `sm:hidden` wrapper around `<PlanTabSelect client:load currentTab={selectTab} />`. Keep `selectTab` / `isDashboardPath` (for desktop current-tab marking) / desktop `sm:flex` `<a href="/dashboard?tab=…">` / current `<span class="text-white" aria-current="page">` / Sign out POST `/api/auth/signout` / email / Admin. Drop the `DASHBOARD_TABS` import from this file if the select map no longer lives here; keep `parseDashboardTab`. No `client:load` on the desktop cluster. Do not edit `Welcome.astro`.

#### 4. Dashboard panels follow the URL without reload

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Make the visible calendar / list / profile panel follow a Plan-island `replaceState` (S-133.2). `initialTab`-only is a no-op.

**Contract**: Keep `initialTab` as the first `selected` value. Store `selected` in `useState`. Subscribe to `DASHBOARD_TAB_EVENT` and `popstate`; set `selected` from the event `detail` or `parseDashboardTab` of `location.search`’s `tab`. Keep the three panels, `hidden={selected !== …}`, `PlanList active={selected === "list"}`, `liveRaces`, and no in-page `role="tablist"`. Inactive panels stay mounted (FU-037). `dashboard.astro` needs no prop change.

#### 5. Tests

**Files**: `src/components/Topbar.test.ts`, `src/components/dashboard/dashboard-tabs.test.ts`

**Intent**: Lock the island wiring and the replace/assign helper. Cookbook: test-plan §6.1 source-read + Node unit; no Playwright (§6.3). Do not add jsdom or change `vitest.config.ts` include.

**Contract**: `Topbar.test.ts`: drop assertions on `method="GET"`, `action="/dashboard"`, `name="tab"`, and `this.form.submit()`. Assert `client:load`, `PlanTabSelect`, `<select`, `aria-label="Plan"`, `sm:hidden`, desktop hrefs / `aria-current` spans, no signed-in `Dashboard` word, email / Sign out POST / Admin unchanged, no HardFeelings / `href="/"`. `DashboardTabs` source still has no `role="tablist"` and still contains the three panels; also assert it reads `DASHBOARD_TAB_EVENT` (or equivalent listener) rather than `selected = initialTab` only. `dashboard-tabs.test.ts`: `applyPlanTabChange` on `/dashboard` with extra search+hash calls `replaceState` with merged `tab` and `notify`, not `assign`; on `/` (and `/admin`) calls `assign("/dashboard?tab=…")` without `replaceState`; `/dashboard/` counts as dashboard.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/Topbar.test.ts src/components/dashboard/dashboard-tabs.test.ts` passes
- `npm test` passes
- `npm run lint` passes (if repo-wide lint is red only on files this change did not touch, eslint the touched set)
- `npm run build` passes without creating `.env` / `.dev.vars`; if it fails solely for missing secrets, STOP (do not copy placeholders)
- Mobile Plan control is a `client:load` `<select aria-label="Plan">` (Calendar / List / Profile); GET `this.form.submit()` is gone
- On-dashboard helper `replaceState`s `?tab=` keeping other params; `DashboardTabs` `selected` is stateful and listens for the tab event
- Desktop `sm:flex` Calendar / List / Profile remain `<a href="/dashboard?tab=…">` / current `<span>`; Sign out remains POST `/api/auth/signout`

#### Manual Verification:

- Signed in on `/dashboard` at ~390px: changing Plan swaps the visible panel without a full reload; the address bar `?tab=` updates; other query params already on the URL stay
- Signed in off `/dashboard` (e.g. `/`) at ~390px: changing Plan navigates to `/dashboard?tab=calendar|list|profile`
- Desktop `sm+`: Calendar / List / Profile are still full document loads; email, Admin, and Sign out are unchanged; Topbar is not restyled

## Testing Strategy

### Unit Tests:

- `applyPlanTabChange` replace vs assign, keep-other-params, `/dashboard/` treated as dashboard
- Topbar / DashboardTabs source contract as in Phase 1.5
- Deliberate-break: restore `this.form.submit()` or `const selected = initialTab` without an event listener and confirm the scans/helper tests go red

### Manual Testing Steps:

1. Narrow viewport on `/dashboard?tab=calendar`: switch Plan to List, then Profile — panels follow, no full reload
2. Same with an extra query param (e.g. `?foo=1&tab=calendar`) — `foo` remains after replaceState
3. Narrow viewport on `/`: Plan → Calendar loads `/dashboard?tab=calendar`
4. Desktop: click List — full navigation; Sign out still signs out

## Performance Considerations

One extra `client:load` island (the select) hydrates on every page that includes signed-in Topbar (`/`, `/dashboard`, auth, admin, privacy). That is required for S-133.3. Do not hydrate the desktop link row.

## References

- Locked spec: `context/changes/topbar-plan-nav-island/change.md`
- Prior GET select (to replace): `context/archive/2026-09-04-topbar-plan-nav/`
- Keep-other-params helper: `src/components/dashboard/dashboard-tabs.ts` (`dashboardTabHref`); FU-068 / `dashboard-tab-preserve-search`
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mobile Plan island + URL-following panels

#### Automated

- [x] 1.1 `npm test -- src/components/Topbar.test.ts src/components/dashboard/dashboard-tabs.test.ts` passes — c2e6f3c
- [x] 1.2 `npm test` passes — c2e6f3c
- [x] 1.3 `npm run lint` passes (if repo-wide lint is red only on files this change did not touch, eslint the touched set) — c2e6f3c
- [x] 1.4 `npm run build` passes without creating `.env` / `.dev.vars`; if it fails solely for missing secrets, STOP (do not copy placeholders) — c2e6f3c
- [x] 1.5 Mobile Plan control is a `client:load` `<select aria-label="Plan">` (Calendar / List / Profile); GET `this.form.submit()` is gone — c2e6f3c
- [x] 1.6 On-dashboard helper `replaceState`s `?tab=` keeping other params; `DashboardTabs` `selected` is stateful and listens for the tab event — c2e6f3c
- [x] 1.7 Desktop `sm:flex` Calendar / List / Profile remain `<a href="/dashboard?tab=…">` / current `<span>`; Sign out remains POST `/api/auth/signout` — c2e6f3c

#### Manual

- [x] 1.8 Signed in on `/dashboard` at ~390px: changing Plan swaps the visible panel without a full reload; the address bar `?tab=` updates; other query params already on the URL stay
- [x] 1.9 Signed in off `/dashboard` (e.g. `/`) at ~390px: changing Plan navigates to `/dashboard?tab=calendar|list|profile`
- [x] 1.10 Desktop `sm+`: Calendar / List / Profile are still full document loads; email, Admin, and Sign out are unchanged; Topbar is not restyled
