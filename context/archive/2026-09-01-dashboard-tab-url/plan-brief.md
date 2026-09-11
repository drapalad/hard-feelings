# Dashboard tab URL + drop welcome email — Plan Brief

> Full plan: `context/changes/dashboard-tab-url/plan.md`

## What & Why

Week / Profile live only in React state, so `/dashboard?tab=profile` still shows Week after hydrate, and the Dashboard H1 repeats the email already in the topbar. This change parses `?tab=week|profile`, keeps SSR and hydrate in sync, writes the query with `replaceState` on click, and removes the welcome line.

## Starting Point

`DashboardTabs` defaults to week in `useState` and does not read or write the URL. `dashboard-tabs.ts` owns ids/labels/default only. `dashboard.astro` hydrates that island and still prints `Welcome, {email}` under the H1.

## Desired End State

`/dashboard?tab=profile` shows Weekly kilometres and the race list without a click; refresh keeps the tab. Clicks update `?tab=` without pushing history. Unknown or missing `tab` shows Week. The H1 stays; the welcome paragraph is gone; the topbar still shows the email.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Allowed `tab` values | Exact `week` or `profile`; anything else or missing → week | Locked in change Notes; avoids aliases and case variants | Plan |
| SSR ↔ hydrate | Parse `Astro.url.searchParams` on the server and pass `initialTab` into the island | React 19 will not patch a hydrate mismatch | Plan |
| History API | `replaceState` on tab click only; never `pushState`; no `popstate` | Locked in Notes; Back should not walk a stack of tab clicks | Plan |
| First visit URL | Leave `/dashboard` query-less until a click writes `?tab=` | Notes say write on click, not on mount | Plan |
| Query on click | Replace search with `pathname?tab=<id>` only; drop other params and hash | Notes: same pathname with `?tab=`; do not invent other params | Unattended |
| Welcome copy | Delete the paragraph under the H1; keep H1 classes and topbar email | Locked in Notes; do not restyle chrome | Plan |
| Testing | Extend Node `dashboard-tabs.test.ts`; no Playwright / jsdom | Matches prior tab contract and test-plan §6.3 | Plan |
| Inactive panel | Keep `hidden` (both children mounted) | Already shipped (FU-037); out of scope to unmount | Plan |

## Scope

**In scope:** parser + href helper + tests; `initialTab` prop; `replaceState` on click; delete welcome paragraph.

**Out of scope:** SetupForm / PlanWorkspace / generate / chat; card / H1 / tab restyle; Topbar layout; other query params; `pushState` / `popstate`; Playwright.

## Architecture / Approach

`dashboard.astro` parses `tab` and passes `initialTab`. The island initializes from that prop. Clicks update state and `history.replaceState` to `dashboardTabHref`. Parser and href live in `dashboard-tabs.ts` so Node tests do not import the island.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parse `?tab=` in the tab contract | Exact parse + href locked in Vitest | Island later hard-codes a different fallback |
| 2. Wire the island, drop the welcome line | SSR tab + replaceState + no welcome line | Client-only URL read on first paint → hydrate mismatch |

**Prerequisites:** shipped Week/Profile island (`dashboard-profile-tab`).
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- Clicking a tab drops any unrelated query string (FU-068). Preserve-and-set-`tab` was the other reading.
- Removing the welcome `<p class="mb-6">` leaves H1 `mb-2` as the only gap above the tabs; restyling that gap is out of scope.
- Browser Back after `replaceState` will not restore the previous tab (no `popstate`) — accepted in Notes.

## Success Criteria (Summary)

- `/dashboard?tab=profile` shows Profile on first paint and after refresh.
- Tab clicks write `?tab=` without pushing history; junk/missing `tab` shows Week.
- Welcome email under the H1 is gone; topbar email remains.
