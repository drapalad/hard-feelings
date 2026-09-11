# Calendar List Profile replace Dashboard in the topbar — Plan Brief

> Full plan: `context/changes/topbar-plan-nav/plan.md`
> Research: `context/changes/topbar-plan-nav/research.md`

## What & Why

Signed-in Topbar still says Dashboard while Calendar / List / Profile live in a second in-page tablist. Move those three items into the Topbar (dropdown on mobile), drop the in-page tablist, and stop showing the word Dashboard there.

## Starting Point

Topbar is email + Dashboard (`aria-current` span on `/dashboard`) + optional Admin + Sign out. `?tab=` already selects the `DashboardTabs` panel (`week` → calendar). Narrow viewports currently overlay List when `?tab=` is empty via `useLayoutEffect`.

## Desired End State

Signed-in Topbar has Calendar / List / Profile (native `<select>` below `sm`), no Dashboard label, and no second tab row. Panels follow the URL tab. Email, Sign out, and Admin are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Option (a) vs (b) | (a) Topbar items + remove in-page tablist | LOCKED Notes; do not ship both navs | Plan |
| Mobile control | Native `<select>` in a GET form to `/dashboard` (`name="tab"`, `onchange` submit); Topbar stays Astro | Interactivity is a full navigation; AGENTS.md forbids an island unless required; Notes allow select or details | Unattended |
| Empty `?tab=` / phone List overlay | Drive panels from `initialTab` (`parseDashboardTab`); remove the narrow-viewport List `useLayoutEffect` | S-11.4: panels follow the URL; SSR Topbar cannot mark List current when the URL says calendar | Plan |
| Current-tab rule | `parseDashboardTab` of `?tab=` when pathname is `/dashboard` or `/dashboard/`; that item is `aria-current` span, others purple `/dashboard?tab=` links | LOCKED S-11.2; keeps `week` → calendar | Plan |
| Hrefs | Literal `/dashboard?tab=calendar\|list\|profile` | LOCKED Notes; do not invent query merge | Plan |
| `sm` vs 390 | Tailwind `sm` (640px); 390 is the phone width to verify | Matches existing `MOBILE_MAX_WIDTH_QUERY`; Notes say “below the sm breakpoint (390)” | Plan |

## Scope

**In scope:** `Topbar.astro`, `DashboardTabs.tsx`, `Topbar.test.ts`; drop unused `urlTab` on the `dashboard.astro` call site if the prop goes unused.

**Out of scope:** Sign out / email / Admin / auth pages / landing CTAs / `?tab=` semantics / Topbar island / option (b) / `dashboard-tabs.ts` helpers / Playwright.

## Architecture / Approach

SSR Topbar reads `Astro.url` and renders either three anchors or a GET select. `DashboardTabs` keeps the three panels keyed by `initialTab` and loses the tablist. Navigation is a document request, same as following an Admin link.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Topbar plan items + drop in-page tablist | One nav row; URL-driven panels; source-scan tests | Mobile select vs leftover tablist; Topbar/panel disagree on current tab |

**Prerequisites:** none (Depends on: none).
**Estimated effort:** One short session, one phase (XS).

## Open Risks & Assumptions

- `/dashboard` with no `?tab=` now shows Calendar on phones too (the old client List overlay is removed). That is required for Topbar and panels to agree.
- GET select is a full page load, not `replaceState`. Recorded as FU-133.

## Success Criteria (Summary)

- Topbar: Calendar / List / Profile, current tab not a link, select below `sm`, no Dashboard label, no second tab row.
- Email, Sign out, Admin, landing CTAs, and `week` → calendar unchanged.
- `npm test`, lint, and build pass.
