# Signed-in landing hero opens the dashboard — Plan Brief

> Full plan: `context/changes/landing-signed-in-cta/plan.md`
> Research: `context/changes/landing-signed-in-cta/research.md`

## What & Why

Signed-in visitors who hit `/` still see Sign In / Sign Up in the hero even though Topbar already knows they are signed in. This change branches the hero on `Astro.locals.user` so the primary CTA is **Open dashboard** → `/dashboard`.

## Starting Point

`Welcome.astro` always renders Sign In → `/auth/signin` and Sign Up → `/auth/signup` and never reads `user`. Topbar already branches on `Astro.locals.user`. `/` is not in `PROTECTED_ROUTES`.

## Desired End State

Signed-in `/` hero shows **Open dashboard** only (document-load `<a href="/dashboard">`). Signed-out `/` hero is unchanged. Topbar, auth pages, middleware, and footer are untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Signed-in hero primary CTA | **Open dashboard** → `/dashboard`, document-load `<a>` | Notes S-07.1 + locked `Klik:` | Plan |
| Signed-in Sign In / Sign Up | Do not render in the hero | Notes S-07.2 | Plan |
| Signed-out hero | Keep current Sign In / Sign Up hrefs and class strings | Notes S-07.3 | Plan |
| Topbar | Do not restyle or edit `Topbar.astro` | Notes S-07.4 | Plan |
| Open dashboard visual | Reuse the current Sign In filled-purple class string | Notes name a primary CTA; Sign In is already that style | Unattended |
| Test harness | Colocated `Welcome.test.ts` source-scan | Matches `Topbar.test.ts` and cookbook §6.1; research found no Welcome test | Unattended |

## Scope

**In scope:** `src/components/Welcome.astro` hero CTAs; colocated source-scan test.

**Out of scope:** Topbar, auth pages, middleware, footer, islands, Playwright, migrations.

## Architecture / Approach

SSR-only Astro: read `Astro.locals.user` in Welcome frontmatter (same as Topbar) and swap the hero CTA cluster. No new client interactivity.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Signed-in hero Open dashboard | User-branched hero + source-scan | Accidentally restyling Topbar or dropping signed-out styles |

**Prerequisites:** none
**Estimated effort:** one short session, one phase

## Open Risks & Assumptions

- Open dashboard classes are not named in Notes; reusing Sign In’s filled-purple string is the only reading that keeps “primary CTA” without inventing chrome.
- `npm run lint` may already be red on untouched files; then eslint the Welcome set only.

## Success Criteria (Summary)

- Signed-in `/` hero: **Open dashboard** only, navigates to `/dashboard`
- Signed-out `/` hero: Sign In / Sign Up unchanged
- Topbar unchanged
