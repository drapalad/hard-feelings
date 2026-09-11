# Quiet landing without starfield and gradient title — Plan Brief

> Full plan: `context/changes/landing-quiet/plan.md`

## What & Why

The public landing still ships 10x-starter decoration: blur orbs, a dotted star field, a clipped blue→pink H1, and a subtitle that advertises Cloudflare. Quiet it so `/` reads as HardFeelings on `bg-cosmic` — solid white title, product subtitle only.

## Starting Point

`Welcome.astro` is the landing. Cards, Sign In / Sign Up, Topbar, SiteFooter, and `bg-cosmic` are already right. Overlays and the gradient title live only in this file.

## Desired End State

Signed-out `/` has no orbs or star dots. H1 is solid `text-white`. Subtitle is exactly `Training plans for amateur runners.` Product cards and CTAs are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| File / page scope | `Welcome.astro` only; dashboard, auth, privacy, admin untouched | Locked Notes: dashboard and auth out of scope; orbs/stars exist only on landing | Plan |
| Overlay markup | Delete the three orb `div`s and the star-field `div` | Locked Notes: remove orbs and star field | Plan |
| Overlay-only stacking | Drop `overflow-hidden` on the root and `relative z-10` on the content column | Those classes only clipped/stacked overlays; dashboard cosmic pages do not use them | Unattended |
| H1 treatment | Solid `text-white`; keep existing type scale (`text-5xl` / `sm:text-6xl` / `lg:text-7xl`) | Locked Notes: H1 solid `text-white`; scale is already the landing voice | Plan |
| Subtitle copy | Exactly `Training plans for amateur runners.` | Locked Notes: that string, including the period | Plan |
| Feature cards | Leave titles, bodies, icons, and `backdrop-blur-xl` chrome unchanged | Locked Notes: do not redo cards (landing-product-copy); blur on cards is chrome, not orbs | Plan |
| Keep list | Topbar, Sign In / Sign Up, `bg-cosmic` class, SiteFooter | Locked keep list plus existing privacy footer; do not edit the `bg-cosmic` utility | Plan |
| Testing | Source greps + `npm test` / `lint` / `build`; no new Vitest or Playwright | Same cost×signal as landing-product-copy; not a test-plan risk-map scenario | Unattended |

## Scope

**In scope:** Overlay removal, leftover overlay stacking classes, solid-white H1, exact subtitle in `Welcome.astro`.

**Out of scope:** Other pages’ gradient titles; product cards; `global.css` `bg-cosmic`; dashboard/auth; new tests; APIs/schema.

## Architecture / Approach

Single Astro markup edit. `index.astro` stays a wrapper. No React island, no `cn()` merge, no class-string concatenation.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Quiet landing chrome | Overlay-free Welcome with white H1 and shortened subtitle | Accidentally restyling cards or other cosmic pages |

**Prerequisites:** landing-product-copy cards already on disk (they are).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Overlay-only stacking drop (FU-032) is the natural reading; leaving `overflow-hidden` / `z-10` would also match a literal Notes parse.
- Visual quietness is human-judged (Progress 1.9); source greps cannot prove “no stars on screen.”

## Success Criteria (Summary)

- `/` hero is white **HardFeelings** plus `Training plans for amateur runners.` with no orbs, stars, or Cloudflare clause.
- Product cards, CTAs, Topbar, SiteFooter, and `bg-cosmic` remain.
- Dashboard and auth files still have their gradient titles.
