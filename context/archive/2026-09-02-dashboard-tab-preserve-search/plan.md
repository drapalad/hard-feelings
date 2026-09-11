# Keep other query params when switching dashboard tabs Implementation Plan

## Overview

Tab clicks currently `replaceState` to `pathname?tab=<id>` and drop every other search param and the hash. Merge `tab` into the existing query instead, keep `replaceState`, and leave SSR `initialTab` parsing unchanged.

## Current State Analysis

`dashboardTabHref(tab, pathname)` returns `` `${pathname}?tab=${tab}` `` (`src/components/dashboard/dashboard-tabs.ts:19–21`). The island calls it with `window.location.pathname` only (`DashboardTabs.tsx:62`), so a URL like `/dashboard?tab=week&weekStart=2026-08-31#x` becomes `/dashboard?tab=profile` after a click.

`parseDashboardTab` already accepts exact `week` | `profile` and maps missing/anything else to week. `dashboard.astro` already computes `initialTab` from `Astro.url.searchParams.get("tab")` and passes it into the island — other query keys do not affect that parse. Hydrate stays aligned as long as the island still initializes from that prop.

`dashboard-tabs.test.ts` currently asserts the replace-only href shape (`pathname?tab=` with no other params). Playwright is not a suite (`context/foundation/test-plan.md` §6.3). Node Vitest cannot import `DashboardTabs.tsx` (PlanWorkspace).

Card, H1, and tab chrome are out of scope. The welcome email was already removed by `dashboard-tab-url` and must stay gone.

## Desired End State

A tab click writes `tab` onto the current query string: other search params stay, the hash stays, and an existing `tab` value is replaced. History still uses `replaceState` (no `pushState`). `/dashboard?tab=profile` still SSR-selects Profile; missing or unknown `tab` still selects Week. No `weekStart` (or any other key) is invented in this change. Chrome and the missing welcome line stay as they are.

### Key Discoveries:

- Href builder at `dashboard-tabs.ts:19–21` concatenates pathname + `?tab=` only — this is the drop.
- Click site at `DashboardTabs.tsx:62` never passes `location.search` or `location.hash`.
- `parseDashboardTab` + `dashboard.astro` `initialTab` already implement the parse/hydrate contract; they do not need a behavior change.
- `window.location.search` includes a leading `?` (or is `""`); `window.location.hash` includes a leading `#` (or is `""`).

## What We're NOT Doing

- Inventing `weekStart` or any other query key; only preserving keys already on the URL.
- `pushState`, `popstate`, or `replaceState` on mount.
- Changing `parseDashboardTab`, SSR `initialTab`, or hydrate (still server-parsed prop, not a first-paint `window.location` read).
- Restyling tabs, H1, or the dashboard card.
- Restoring the welcome email under the H1.
- SetupForm, PlanWorkspace, generate, chat, Topbar.
- shadcn Tabs, new packages, jsdom, or Playwright.
- Unmounting the inactive tabpanel (FU-037 stays).

## Implementation Approach

Widen `dashboardTabHref` so it takes the current search and hash, merges `tab` with `URLSearchParams.set`, and reattaches the hash. Point the existing `replaceState` call at that helper. Prove merge/replace/hash in the colocated Node test. Leave `dashboard.astro` and `parseDashboardTab` alone.

## Critical Implementation Details

**Timing & lifecycle.** Keep parsing `tab` on the server and hydrating from `initialTab`. Do not read `window.location` during the first client render. Write the URL only in the tab `onClick` (`replaceState`).

**State sequencing.** Pass `window.location.search` and `window.location.hash` into the helper at click time — those strings already carry the `?` / `#` prefixes (or are empty). Do not add a `popstate` listener.

---

## Phase 1: Merge `tab` in the href helper

### Overview

Change `dashboardTabHref` so it merges `tab` into the current query and preserves the hash, and lock that in Node tests before the island call site moves.

### Changes Required:

#### 1. Href helper

**File**: `src/components/dashboard/dashboard-tabs.ts`

**Intent**: One function owns the URL written on tab click so extra query keys and the hash cannot be dropped, and so the island cannot invent keys.

**Contract**: Keep `DASHBOARD_TABS`, `DashboardTab`, `DEFAULT_DASHBOARD_TAB`, and `parseDashboardTab` unchanged. Change `dashboardTabHref` to `dashboardTabHref(tab: DashboardTab, pathname: string, search = "", hash = ""): string`. Defaults keep the current two-arg island call compiling until Phase 2. Build the query with `URLSearchParams` from `search` (which may start with `?` or be empty), `set("tab", tab)` (replace an existing `tab`; do not duplicate the key), then return `` `${pathname}?${params.toString()}${hash}` ``. Do not add keys that were not in `search`. Do not invent `weekStart`. `hash` is appended as given (`""` or a `#…` fragment). Pathname stays a path (no origin).

#### 2. Unit tests

**File**: `src/components/dashboard/dashboard-tabs.test.ts`

**Intent**: Prove merge, tab-replace, empty search, and hash preservation in Node without importing the island.

**Contract**: Keep existing default/label and `parseDashboardTab` assertions. Replace the replace-only href cases with: empty `search`/`hash` still `/dashboard?tab=week` and `/dashboard?tab=profile`; extra keys (including `weekStart`) survive; an existing `tab` is replaced not duplicated; a `#` hash is kept. Do not import `DashboardTabs.tsx`. Follow `PlanCalendar.test.ts`. No Playwright.

### Success Criteria:

#### Automated Verification:

- `dashboardTabHref` merges `tab` into existing search (preserves other keys including `weekStart`, replaces an existing `tab`) and appends the given hash
- `dashboardTabHref` with empty search and hash still returns `pathname?tab=<id>` only and does not invent `weekStart`
- `parseDashboardTab` still returns `week` for `null`, `""`, `"Profile"`, and `"admin"`, and the matching id for `"week"` and `"profile"`
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`

---

## Phase 2: Pass search and hash from the tab click

### Overview

Feed the live query and hash into the helper on click so `replaceState` stops wiping them. Leave SSR parse and chrome alone.

### Changes Required:

#### 1. Island click URL

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: The address bar after a tab click is the current URL with only `tab` updated.

**Contract**: Keep `history.replaceState` (do not `pushState`). Change the href argument to `dashboardTabHref(tab.id, window.location.pathname, window.location.search, window.location.hash)`. Do not `replaceState` on mount. Do not add `popstate`. Do not change tablist markup, `cn()` classes, `hidden` panels, or SetupForm / PlanWorkspace props.

#### 2. Page parse unchanged

**File**: `src/pages/dashboard.astro` (verify only — no edit unless drift is found)

**Intent**: SSR `initialTab` stays the same contract so hydrate still matches.

**Contract**: Keep `const initialTab = parseDashboardTab(Astro.url.searchParams.get("tab"))` and `initialTab={initialTab}`. Do not write `weekStart` (or any other new key) onto the page URL. Do not restore `Welcome,` copy. Do not restyle the H1 or card.

### Success Criteria:

#### Automated Verification:

- `DashboardTabs.tsx` calls `history.replaceState` (not `pushState`) with `dashboardTabHref(tab.id, window.location.pathname, window.location.search, window.location.hash)`
- `dashboard.astro` still computes `initialTab` with `parseDashboardTab(Astro.url.searchParams.get("tab"))`, does not invent `weekStart` in the URL, and contains no `Welcome,` copy
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`
- Production build passes: `npm run build` (dummy `SUPABASE_URL` / `SUPABASE_KEY` from `.env.example` copied to gitignored `.env` in this worktree if missing; never commit `.env`)

#### Manual Verification:

- Signed in, open `/dashboard?tab=week&weekStart=2026-08-31#keep`, click Profile: address bar has `tab=profile`, still has `weekStart=2026-08-31` and `#keep`, and Back does not walk a stack of tab clicks
- Clicking Week from that URL restores `tab=week` with the same other params and hash
- `/dashboard` and `/dashboard?tab=nope` show Week; `/dashboard?tab=profile` still SSR-selects Profile
- Card, H1, and tab chrome look as they do today; no “Welcome,” line under the H1

---

## Testing Strategy

### Unit Tests:

- Empty search/hash: pathname plus `?tab=` only (no invented keys).
- Extra keys (including `weekStart`) survive; existing `tab` is replaced once.
- Hash fragment is appended unchanged.
- Parser: exact `week` / `profile`; missing, empty, wrong case, unknown → week (unchanged).

### Integration Tests:

- None. No API or persist change. Do not add Playwright (test-plan §6.3).

### Manual Testing Steps:

1. Sign in, open `/dashboard?tab=week&weekStart=2026-08-31#keep`, click Profile, confirm other params and hash remain and Back is not a tab stack.
2. Click Week; confirm `tab=week` with the same extras.
3. Confirm `/dashboard` and junk `tab` still show Week; `?tab=profile` still paints Profile on first load.
4. Confirm chrome and the missing welcome line are unchanged.

## Performance Considerations

No extra fetch. `replaceState` remains one history mutation per click. Both tabpanels stay mounted.

## Migration Notes

None. No schema. Existing `/dashboard` and `/dashboard?tab=` links keep working. First visit stays query-less until a tab click writes `?tab=`. A URL that already has other keys no longer loses them on click.

## References

- Change notes: `context/changes/dashboard-tab-preserve-search/change.md`
- Prior tab URL change: `context/changes/dashboard-tab-url/`
- Island: `src/components/dashboard/DashboardTabs.tsx`
- Contract: `src/components/dashboard/dashboard-tabs.ts`
- Page: `src/pages/dashboard.astro`
- Test-plan: `context/foundation/test-plan.md` §6.1 / §6.3
- Promoted from: FU-068

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Merge `tab` in the href helper

#### Automated

- [x] 1.1 `dashboardTabHref` merges `tab` into existing search (preserves other keys including `weekStart`, replaces an existing `tab`) and appends the given hash — c406deb
- [x] 1.2 `dashboardTabHref` with empty search and hash still returns `pathname?tab=<id>` only and does not invent `weekStart` — c406deb
- [x] 1.3 `parseDashboardTab` still returns `week` for `null`, `""`, `"Profile"`, and `"admin"`, and the matching id for `"week"` and `"profile"` — c406deb
- [x] 1.4 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — c406deb
- [x] 1.5 Full suite passes: `npm test` — c406deb

### Phase 2: Pass search and hash from the tab click

#### Automated

- [x] 2.1 `DashboardTabs.tsx` calls `history.replaceState` (not `pushState`) with `dashboardTabHref(tab.id, window.location.pathname, window.location.search, window.location.hash)` — a4e9687
- [x] 2.2 `dashboard.astro` still computes `initialTab` with `parseDashboardTab(Astro.url.searchParams.get("tab"))`, does not invent `weekStart` in the URL, and contains no `Welcome,` copy — a4e9687
- [x] 2.3 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — a4e9687
- [x] 2.4 Full suite passes: `npm test` — a4e9687
- [x] 2.5 Lint passes: `npm run lint` — a4e9687
- [x] 2.6 Production build passes: `npm run build` (dummy `SUPABASE_URL` / `SUPABASE_KEY` from `.env.example` copied to gitignored `.env` in this worktree if missing; never commit `.env`) — a4e9687

#### Manual

- [x] 2.7 Signed in, open `/dashboard?tab=week&weekStart=2026-08-31#keep`, click Profile: address bar has `tab=profile`, still has `weekStart=2026-08-31` and `#keep`, and Back does not walk a stack of tab clicks
- [x] 2.8 Clicking Week from that URL restores `tab=week` with the same other params and hash
- [x] 2.9 `/dashboard` and `/dashboard?tab=nope` show Week; `/dashboard?tab=profile` still SSR-selects Profile
- [x] 2.10 Card, H1, and tab chrome look as they do today; no “Welcome,” line under the H1
