# Keep other query params when switching dashboard tabs — Plan Brief

> Full plan: `context/changes/dashboard-tab-preserve-search/plan.md`

## What & Why

Tab clicks `replaceState` to `pathname?tab=<id>` and drop every other query key and the hash. A future `weekStart` (or any already-present param) would vanish on click. This change merges `tab` into the existing search, keeps the hash, and leaves SSR tab parsing alone.

## Starting Point

`dashboardTabHref` concatenates pathname + `?tab=` only. `DashboardTabs` passes `window.location.pathname` into that helper. `parseDashboardTab` and `dashboard.astro` `initialTab` already keep SSR and hydrate in sync.

## Desired End State

A tab click updates `tab` and leaves every other search param and the hash in place. History still replaces, not pushes. Missing or unknown `tab` still shows Week; `?tab=profile` still SSR-selects Profile. No new keys are invented. Chrome is unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Query on click | Merge `tab` into the existing search; preserve other params | Locked in change Notes (FU-068); stop dropping what is already there | Plan |
| Hash | Preserve the current hash on tab click | Locked in Notes | Plan |
| History API | Keep `replaceState` on click; never `pushState`; no `popstate` | Locked in Notes; Back must not walk a tab-click stack | Plan |
| Invent `weekStart` | Do not add it; only preserve if already present | Locked in Notes — this change is preserve-only | Plan |
| Helper signature | `dashboardTabHref(tab, pathname, search = "", hash = "")` | Extends the existing positional helper; empty defaults keep the two-arg island compiling until Phase 2 | Unattended |
| Merge mechanics | `URLSearchParams` from `search`, then `set("tab", tab)` | Replaces a duplicate `tab` once without dropping other keys; Node and the browser share the API | Unattended |
| SSR / parse | Leave `parseDashboardTab` and `initialTab` unchanged | Other keys do not affect tab selection; hydrate must stay a server prop | Plan |
| Testing | Extend Node `dashboard-tabs.test.ts`; no Playwright / jsdom | Helper is logic, not chrome; test-plan §6.3 | Plan |
| Chrome / welcome | Do not restyle tabs/H1/card; do not restore the welcome email | Locked in Notes | Plan |

## Scope

**In scope:** widen `dashboardTabHref`; pass search+hash from the click; unit tests of merge/hash/empty-search.

**Out of scope:** inventing `weekStart`; `pushState` / `popstate`; parse/hydrate rewrite; chrome; welcome email; Playwright; PlanWorkspace / SetupForm.

## Architecture / Approach

`dashboardTabHref` builds the next URL from pathname + current search + hash. The island keeps `replaceState` and passes `window.location.search` / `hash`. `dashboard.astro` still parses only `tab`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Merge `tab` in the href helper | Query merge + hash locked in Vitest | Island later still calls the two-arg form |
| 2. Pass search and hash from the tab click | Click writes the merged URL | Forgetting hash, or inventing keys in the helper |

**Prerequisites:** shipped `dashboard-tab-url` (`?tab=` + `replaceState`).
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- `URLSearchParams.toString()` may re-encode existing values; preservation is key/value, not byte-identical query text.
- Browser Back after `replaceState` still will not restore the previous tab (no `popstate`) — accepted in Notes.
- A `weekStart` in the URL is not read by `dashboard.astro` yet; this change only stops dropping it.

## Success Criteria (Summary)

- Tab click keeps other search params and the hash; `tab` is updated in place.
- Empty URL still becomes `pathname?tab=<id>` with no invented keys.
- Parse/SSR tab selection is unchanged; chrome and the missing welcome line stay.
