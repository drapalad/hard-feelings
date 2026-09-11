# Dashboard tab URL + drop welcome email Implementation Plan

## Overview

Deep-link Week / Profile via `?tab=` and drop the duplicate “Welcome, {email}” line under the Dashboard H1. Today the selected tab lives only in React `useState` (always week), so `/dashboard?tab=profile` still paints Week after hydrate.

## Current State Analysis

`DashboardTabs` initializes `useState(DEFAULT_DASHBOARD_TAB)` and never reads the query. Tab clicks only call `setSelected`. `dashboard-tabs.ts` exports ids, labels, and default — no parser. `dashboard.astro` hydrates one `client:load` island and still renders `Welcome, {user.email}` under the H1 (`src/pages/dashboard.astro:65–68`); Topbar already shows `user.email` (`src/components/Topbar.astro:11`).

React 19 will not patch a hydrate mismatch: SSR HTML for the island must match the client’s first render. Parsing `tab` only in `useEffect` (or only from `window.location`) would SSR Week and hydrate Profile (or the reverse).

Vitest is Node-only (`src/**/*.test.ts`). `dashboard-tabs.test.ts` already locks default and labels the same way `PlanCalendar.test.ts` locks formatters. Playwright is not a suite (`context/foundation/test-plan.md` §6.3).

Card chrome is `rounded-2xl border border-white/10 bg-slate-950` with a plain white H1 (`mb-2 text-3xl font-bold text-white`). Inactive tabpanels stay mounted via `hidden` (FU-037, shipped).

## Desired End State

`/dashboard?tab=profile` SSR-selects Profile so Weekly kilometres and the race list are visible without a click. Refresh keeps the tab. Tab clicks `history.replaceState` to the same pathname with `?tab=week` or `?tab=profile`. Missing or unknown `tab` values select Week. The welcome paragraph under the H1 is gone; the H1 and the topbar email remain.

### Key Discoveries:

- `useState(DEFAULT_DASHBOARD_TAB)` at `DashboardTabs.tsx:37` ignores the URL; clicks at `:58–60` do not write history.
- Astro already reads `Astro.url.searchParams` for auth errors (`src/pages/auth/signin.astro:7`); dashboard should parse `tab` the same way and pass it as an island prop.
- Hydrate contract: `initialTab` must be a serialized prop from the server, not a client-only `location.search` read on first paint.
- Welcome copy is only in `dashboard.astro:66–68`; Topbar email is independent.

## What We're NOT Doing

- Changing SetupForm, PlanWorkspace, km/race validation, generate, or chat.
- Restyling the dashboard card, H1, or tabs (including H1 `mb-2` after the welcome line is removed).
- Changing Topbar layout, wordmark, or removing the topbar email.
- Inventing other query params; adding `pushState`; adding a `popstate` listener.
- shadcn Tabs, new packages, jsdom, or Playwright.
- Unmounting the inactive tabpanel (FU-037 stays).

## Implementation Approach

Extend the existing Node-testable tab module with a parser and a pathname+`?tab=` href helper. Pass `initialTab` from `Astro.url.searchParams` into `DashboardTabs` so SSR and hydrate agree. On tab click, `setSelected` and `history.replaceState` to that href. Delete the welcome paragraph only.

## Critical Implementation Details

**Timing & lifecycle.** Parse on the server and pass `initialTab` into the island. Use that prop as the `useState` initializer. Do not read `window.location` during the first client render — React 19 will not repair a mismatch with the SSR HTML.

**State sequencing.** Write the URL only in the tab `onClick` handler (`replaceState`, not `pushState`). Do not `replaceState` on mount (a first visit to `/dashboard` stays query-less until a click). No `popstate` listener — Back/Forward after replace is a no-op by design.

---

## Phase 1: Parse `?tab=` in the tab contract

### Overview

Lock parse and href rules in `dashboard-tabs.ts` so the island and the page cannot invent values, and Node tests prove unknown/missing → week.

### Changes Required:

#### 1. Parser and href

**File**: `src/components/dashboard/dashboard-tabs.ts`

**Intent**: One function decides the selected tab from a query value; one function builds the URL written on click, so Astro and the island cannot drift.

**Contract**: Keep existing `DASHBOARD_TABS`, `DashboardTab`, and `DEFAULT_DASHBOARD_TAB`. Export `parseDashboardTab(raw: string | null): DashboardTab` that returns `week` or `profile` only on exact match of those ids; `null`, empty string, wrong case (`Profile`), and any other string → `week`. Export `dashboardTabHref(tab: DashboardTab, pathname: string): string` that returns `${pathname}?tab=${tab}` with no other params, no hash. Do not use `URLSearchParams` to merge existing search.

#### 2. Unit tests

**File**: `src/components/dashboard/dashboard-tabs.test.ts`

**Intent**: Prove parser fallbacks and href shape in Node before wiring the island.

**Contract**: Keep existing default/label assertions. Add cases: `"week"` → week, `"profile"` → profile, `null` / `""` / `"Profile"` / `"admin"` → week. Assert `dashboardTabHref("profile", "/dashboard")` is `/dashboard?tab=profile` and the week variant is `/dashboard?tab=week`. Do not import `DashboardTabs.tsx` (would pull PlanWorkspace into Node). Follow `PlanCalendar.test.ts`.

### Success Criteria:

#### Automated Verification:

- `parseDashboardTab` returns `week` for `null`, `""`, `"Profile"`, and `"admin"`, and returns the matching id for `"week"` and `"profile"`
- `dashboardTabHref` for `/dashboard` is `/dashboard?tab=week` and `/dashboard?tab=profile` only
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`

---

## Phase 2: Wire the island, drop the welcome line

### Overview

SSR-select the tab from the query, write `?tab=` with `replaceState` on click, and remove the duplicate welcome email.

### Changes Required:

#### 1. Island

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Hydrate the same tab the server painted, and keep the URL in sync on click without growing history.

**Contract**: Add required prop `initialTab: DashboardTab`. Initialize `useState(initialTab)` — not `DEFAULT_DASHBOARD_TAB`. On tab click: `setSelected(tab.id)` and `history.replaceState(null, "", dashboardTabHref(tab.id, window.location.pathname))`. Do not `pushState`. Do not add `popstate`. Do not change tablist markup, `cn()` classes, `hidden` panels, or SetupForm / PlanWorkspace props.

#### 2. Page wiring and welcome removal

**File**: `src/pages/dashboard.astro`

**Intent**: SSR HTML matches the client tab; the H1 is no longer followed by a second copy of the member email.

**Contract**: In the Astro frontmatter, compute `const initialTab = parseDashboardTab(Astro.url.searchParams.get("tab"))` (same style as existing `weekStart`). Pass `initialTab={initialTab}` on `<DashboardTabs client:load … />`. Delete the welcome `<p>` (`Welcome, {user.email}`). Keep the Dashboard H1 and its existing classes (`mb-2 text-3xl font-bold text-white`). Keep Topbar. Do not add other query params. Do not restyle the card (`rounded-2xl border border-white/10 bg-slate-950`).

### Success Criteria:

#### Automated Verification:

- `dashboard.astro` computes `initialTab` with `parseDashboardTab(Astro.url.searchParams.get("tab"))`, passes it into `DashboardTabs`, and contains no `Welcome,` copy
- `DashboardTabs.tsx` initializes state from `initialTab` and calls `history.replaceState` (not `pushState`) on tab click
- `Topbar.astro` still renders `user.email` for a signed-in member
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build` (dummy `SUPABASE_URL` / `SUPABASE_KEY` from `.env.example` copied to gitignored `.env` in this worktree if missing; never commit `.env`)

#### Manual Verification:

- Signed in, open `/dashboard?tab=profile`: Profile is selected; Weekly kilometres and the race list are visible without clicking Profile
- Refresh on `/dashboard?tab=profile` keeps Profile selected
- Clicking Week then Profile updates the address bar to `?tab=week` / `?tab=profile` without adding a history entry (`replaceState`, not `pushState`)
- `/dashboard` and `/dashboard?tab=nope` show Week
- No “Welcome,” line under the Dashboard H1; the email remains in the topbar
- Card, H1, and tab chrome look as they do today

---

## Testing Strategy

### Unit Tests:

- Parser: exact `week` / `profile`; missing, empty, wrong case, unknown → week.
- Href: pathname plus `?tab=` only.
- Existing default/label assertions stay.

### Integration Tests:

- None. No API or persist change. Do not add Playwright (test-plan §6.3).

### Manual Testing Steps:

1. Sign in, open `/dashboard?tab=profile`, confirm Profile content without a click.
2. Refresh; confirm the tab stays Profile.
3. Click Week / Profile; confirm the query updates and Back does not walk a stack of tab clicks.
4. Confirm the welcome line is gone and the topbar still shows the email.

## Performance Considerations

No extra fetch. `replaceState` is one history mutation per click. Both tabpanels stay mounted (existing behavior).

## Migration Notes

None. No schema. Existing `/dashboard` links without `tab` keep defaulting to Week. First visit stays query-less until a tab click writes `?tab=`.

## References

- Change notes: `context/changes/dashboard-tab-url/change.md`
- Prior tab island: `context/archive/2026-09-01-dashboard-profile-tab/`
- Page: `src/pages/dashboard.astro`
- Island: `src/components/dashboard/DashboardTabs.tsx`
- Contract: `src/components/dashboard/dashboard-tabs.ts`
- SearchParams pattern: `src/pages/auth/signin.astro`
- Test-plan: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Parse `?tab=` in the tab contract

#### Automated

- [x] 1.1 `parseDashboardTab` returns `week` for `null`, `""`, `"Profile"`, and `"admin"`, and returns the matching id for `"week"` and `"profile"` — a66ce33
- [x] 1.2 `dashboardTabHref` for `/dashboard` is `/dashboard?tab=week` and `/dashboard?tab=profile` only — a66ce33
- [x] 1.3 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — a66ce33
- [x] 1.4 Full suite passes: `npm test` — a66ce33

### Phase 2: Wire the island, drop the welcome line

#### Automated

- [x] 2.1 `dashboard.astro` computes `initialTab` with `parseDashboardTab(Astro.url.searchParams.get("tab"))`, passes it into `DashboardTabs`, and contains no `Welcome,` copy — 92be359
- [x] 2.2 `DashboardTabs.tsx` initializes state from `initialTab` and calls `history.replaceState` (not `pushState`) on tab click — 92be359
- [x] 2.3 `Topbar.astro` still renders `user.email` for a signed-in member — 92be359
- [x] 2.4 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — 92be359
- [x] 2.5 Full suite passes: `npm test` — 92be359
- [x] 2.6 Lint passes: `npm run lint` — 92be359
- [x] 2.7 Production build passes: `npm run build` (dummy `SUPABASE_URL` / `SUPABASE_KEY` from `.env.example` copied to gitignored `.env` in this worktree if missing; never commit `.env`) — 92be359

#### Manual

- [x] 2.8 Signed in, open `/dashboard?tab=profile`: Profile is selected; Weekly kilometres and the race list are visible without clicking Profile
- [x] 2.9 Refresh on `/dashboard?tab=profile` keeps Profile selected
- [x] 2.10 Clicking Week then Profile updates the address bar to `?tab=week` / `?tab=profile` without adding a history entry (`replaceState`, not `pushState`)
- [x] 2.11 `/dashboard` and `/dashboard?tab=nope` show Week
- [x] 2.12 No “Welcome,” line under the Dashboard H1; the email remains in the topbar
- [x] 2.13 Card, H1, and tab chrome look as they do today
