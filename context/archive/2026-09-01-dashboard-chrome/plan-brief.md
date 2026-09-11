# Solid dashboard card and drop duplicate sign out — Plan Brief

> Full plan: `context/changes/dashboard-chrome/plan.md`

## What & Why

The dashboard main card still uses frosted glass (`bg-white/10` + blur) and a clipped gradient H1, with a second Sign out under Week/Profile while Topbar already signs out. Match the solid-slate auth cards and leave one Sign out in the bar.

## Starting Point

`dashboard.astro` already hydrates `DashboardTabs` (Week default, Profile for setup). Topbar, SiteFooter, and `bg-cosmic` are in place. Nested glass lives in tab/setup/week/chat components, not on the page card.

## Desired End State

Signed-in `/dashboard` shows a solid `bg-slate-950` card with a solid-white **Dashboard** title. No in-card Sign out. Topbar Sign out, Week/Profile, nested glass, SiteFooter, and `bg-cosmic` stay.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| File / page scope | `src/pages/dashboard.astro` only | Locked Notes: that file only; tabs and Topbar are out of scope | Plan |
| Card chrome | `bg-slate-950`, keep `border-white/10`, drop `bg-white/10` and `backdrop-blur-xl` | Locked Notes; same token swap as `signin-with-nav` | Plan |
| H1 treatment | Solid `text-white`; keep `text-3xl font-bold` | Locked Notes: H1 solid `text-white`; scale is already the dashboard voice | Plan |
| Duplicate Sign out | Delete the bottom card form; keep Topbar Sign out | Locked Notes: Topbar already has Sign out | Plan |
| Nested glass and tabs | Leave `DashboardTabs`, setup, week, and chat glass tokens unchanged | Locked Notes: nested glass stays; do not revert Week/Profile | Plan |
| Welcome line | Keep `Welcome, {email}` in the card | Locked Notes name H1 and Sign out, not the greeting; Topbar email stays as-is | Unattended |
| Testing | Source greps + `npm test` / `lint` / `build`; no new Vitest or Playwright | Same cost×signal as landing-quiet / signin-with-nav; not a test-plan risk-map scenario | Unattended |

## Scope

**In scope:** Card background, H1 classes, removal of the in-card Sign out form in `dashboard.astro`.

**Out of scope:** Topbar layout/wordmark/email; Week/Profile restyle; nested glass; SiteFooter; `bg-cosmic`; other pages; new tests; APIs/schema.

## Architecture / Approach

Single Astro markup edit. No React island, no `cn()` merge, no class-string concatenation. `DashboardTabs` stays the one `client:load` island.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Solid dashboard card | Solid-slate card, white H1, one Sign out in Topbar | Accidentally restyling tabs or nested glass in the same file’s island |

**Prerequisites:** `dashboard-profile-tab` Week/Profile already on `master` (they are).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Welcome-line keep is the natural reading of Notes that only named H1; deleting the greeting would be a second product choice and is not taken.
- Visual solidity of the card is human-judged (Progress 1.11); source greps cannot prove “not frosted on screen.”

## Success Criteria (Summary)

- Dashboard card is solid slate with a white H1 and no in-card Sign out.
- Topbar Sign out, Week/Profile, nested glass, SiteFooter, and `bg-cosmic` remain.
