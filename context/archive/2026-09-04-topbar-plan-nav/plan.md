# Calendar List Profile replace Dashboard in the topbar — Implementation Plan

## Overview

Replace the signed-in Topbar “Dashboard” item with Calendar / List / Profile (`/dashboard?tab=calendar|list|profile`), mark the current tab from `Astro.url`, show a native `<select>` below `sm`, and remove the in-page Dashboard tablist so panels stay URL-driven.

## What We're NOT Doing

- Shipping option (b) — keeping both the Topbar plan items and the in-page tablist
- Changing Sign out, email, Admin gating, auth pages, landing CTAs, or `?tab=` semantics (`week` → calendar)
- Restyling landing CTAs or the Topbar chrome owned by `landing-signed-in-cta` (S-07.4)
- Turning Topbar into a React island / adding `"use client"`
- Changing `parseDashboardTab` / `dashboardTabHref` in `dashboard-tabs.ts`
- Playwright / e2e

## Phase 1: Topbar plan items + drop in-page tablist

### Overview

Signed-in Topbar owns Calendar / List / Profile (links at `sm+`, native select below `sm`). `DashboardTabs` keeps the three panels and drops the in-page tablist. Current tab comes from `Astro.url`.

### Changes Required:

#### 1. Signed-in Topbar plan nav

**File**: `src/components/Topbar.astro`

**Intent**: Replace the Dashboard control with Calendar, List, and Profile on the same row and in the same purple-link style as Admin. Mark the current dashboard tab from `Astro.url`. Below `sm`, show a native select that navigates to that `?tab=`. Do not show the word Dashboard in the signed-in cluster.

**Contract**: Import `DASHBOARD_TABS` and `parseDashboardTab` from `@/components/dashboard/dashboard-tabs`. On `/dashboard` or `/dashboard/`, current id is `parseDashboardTab(Astro.url.searchParams.get("tab"))` (so `tab=week` still counts as Calendar). At `sm` and up (`hidden sm:flex` / equivalent): each non-current plan item is `<a href="/dashboard?tab=<id>" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">`; the current item is `<span class="text-white" aria-current="page">` with that label — not an `<a>`. Off `/dashboard`, all three are those purple anchors (none `aria-current`). Below `sm` (`sm:hidden`): a GET `<form action="/dashboard">` with `<select name="tab" aria-label="Plan">` whose options are the three tabs, `selected` matching the current id when on dashboard (else Calendar), and `onchange="this.form.submit()"`. Keep `{user.email}`, Admin `{Astro.locals.isAdmin ? …}` with the existing `/admin` classes, and the Sign out POST form. Guest cluster unchanged. No signed-in `Dashboard` text. No `client:load`. No `cn()` unless a single element needs merged conditionals.

#### 2. Remove in-page tablist; keep URL-driven panels

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Option (a): delete the in-page `role="tablist"` so there is no second tab row. Panels stay driven by the URL tab already passed as `initialTab`.

**Contract**: Remove the tablist and its `history.replaceState` click handlers. Keep the three panels (`PlanWorkspace` / `PlanList` / `SetupForm`) with the same `hidden={selected !== …}` and `PlanList active={selected === "list"}` / `liveRaces` wiring. `selected` is `initialTab` (SSR `parseDashboardTab` of `?tab=`). Remove the `useLayoutEffect` that sets List on a narrow viewport when `urlTab` is empty — that overlay is not URL-driven and would disagree with Topbar’s current-tab mark. Drop unused `urlTab` from the props. Do not change `dashboard-tabs.ts`. After the tablist is gone, do not leave `role="tabpanel"` / `aria-labelledby` pointing at missing tab ids.

#### 3. Dashboard page call site

**File**: `src/pages/dashboard.astro`

**Intent**: Stop passing `urlTab` once `DashboardTabs` no longer reads it. Do not restyle the page, Topbar slot, or landing CTAs.

**Contract**: Remove the `urlTab={urlTab}` attribute from `<DashboardTabs>`. Keep `initialTab={initialTab}`, `client:load`, and every other prop. `const urlTab` / `parseDashboardTab` on this page stay — they still feed `initialTab`.

#### 4. Source-contract tests

**File**: `src/components/Topbar.test.ts`

**Intent**: Rewrite the Dashboard current-page source-scan into a contract for plan items, current-tab marking, mobile select, no Dashboard label, and no in-page tablist. Keep email / Sign out / Admin locks. Cookbook: test-plan §6.1 source-read; no Playwright (§6.3).

**Contract**: `readFileSync` `Topbar.astro` and `dashboard/DashboardTabs.tsx`. Assert: hrefs `/dashboard?tab=calendar`, `?tab=list`, `?tab=profile`; `aria-current="page"` on a `text-white` span (not those three as always-links); GET form `action="/dashboard"` + `<select name="tab"` + `this.form.submit()`; `sm:hidden` (or equivalent) on the select cluster and `hidden sm:flex` (or equivalent) on the three links; signed-in cluster has no `Dashboard` word; email / Sign out POST `/api/auth/signout` / Admin `/admin` purple link unchanged; no HardFeelings / `href="/"`. DashboardTabs source has no `role="tablist"` / `aria-label="Dashboard"` tablist and still contains `<PlanWorkspace`, `<PlanList`, `<SetupForm`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/Topbar.test.ts` passes
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes (if `.env` is missing in this worktree, copy `.env.example` to `.env` with dummy `SUPABASE_URL` / `SUPABASE_KEY` placeholders; do not commit `.env`)
- Signed-in Topbar has Calendar / List / Profile `/dashboard?tab=` items, current tab is `aria-current="page"` not a link, mobile GET `<select name="tab">` below `sm`, and no signed-in `Dashboard` label
- `DashboardTabs` has no in-page `role="tablist"`; panels still mount from `initialTab`

#### Manual Verification:

- Signed in on `/dashboard?tab=calendar|list|profile` (desktop / `sm+`): Topbar shows Calendar / List / Profile on one row with Admin; the current tab is white text not a link; there is no second tab row and no Dashboard label
- At ~390px (below `sm`): the three links are replaced by a native select; changing it navigates to that `?tab=`
- Email, Sign out, and Admin gating are unchanged; landing CTAs are unchanged

## Testing Strategy

### Unit Tests:

- Colocated `Topbar.test.ts` source contract as in Phase 1.4. Deliberate-break: restore a signed-in `Dashboard` label or the in-page tablist and confirm the scan goes red.

## References

- Locked spec: `context/changes/topbar-plan-nav/change.md`
- Research: `context/changes/topbar-plan-nav/research.md`
- Tab ids / `week` → calendar: `src/components/dashboard/dashboard-tabs.ts`
- Prior current-page Topbar: `context/archive/2026-09-01-dashboard-nav-current/`
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Topbar plan items + drop in-page tablist

#### Automated

- [x] 1.1 `npm test -- src/components/Topbar.test.ts` passes — 386a070
- [x] 1.2 `npm test` passes — 386a070
- [x] 1.3 `npm run lint` passes — 386a070
- [x] 1.4 `npm run build` passes (if `.env` is missing in this worktree, copy `.env.example` to `.env` with dummy `SUPABASE_URL` / `SUPABASE_KEY` placeholders; do not commit `.env`) — 386a070
- [x] 1.5 Signed-in Topbar has Calendar / List / Profile `/dashboard?tab=` items, current tab is `aria-current="page"` not a link, mobile GET `<select name="tab">` below `sm`, and no signed-in `Dashboard` label — 386a070
- [x] 1.6 `DashboardTabs` has no in-page `role="tablist"`; panels still mount from `initialTab` — 386a070

#### Manual

- [ ] 1.7 Signed in on `/dashboard?tab=calendar|list|profile` (desktop / `sm+`): Topbar shows Calendar / List / Profile on one row with Admin; the current tab is white text not a link; there is no second tab row and no Dashboard label
- [ ] 1.8 At ~390px (below `sm`): the three links are replaced by a native select; changing it navigates to that `?tab=`
- [ ] 1.9 Email, Sign out, and Admin gating are unchanged; landing CTAs are unchanged
