# Solid landing feature cards — Plan Brief

> Full plan: `context/changes/landing-feature-solid/plan.md`

## What & Why

The landing hero is already quiet and solid white, but the three product cards under it still use frost-glass (`bg-white/5` + `backdrop-blur-xl`) while the dashboard card is solid `bg-slate-950`. Make those three cards solid slate so `/` matches the rest of the product chrome.

## Starting Point

`Welcome.astro` is the landing. Quiet hero, Topbar, Sign In / Sign Up, product copy, and SiteFooter are already right. Card class strings are three identical glass tokens. Dashboard/auth cards are already solid.

## Desired End State

Signed-out `/` shows three solid slate feature cards (no blur, `bg-slate-950`, same border/icons/titles/bodies). Hero, CTAs, Topbar, and footer are untouched. Stars, orbs, and gradient H1 stay gone.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| File / page scope | `Welcome.astro` three feature cards only | Locked Notes: that file; do not restyle auth or dashboard cards | Plan |
| Card class delta | Drop `backdrop-blur-xl`; replace `bg-white/5` with `bg-slate-950`; keep `rounded-xl`, `border border-white/10`, `p-6` | Locked Notes: drop blur, set `bg-slate-950`, keep border/icons/copy | Plan |
| Rounding vs dashboard | Keep `rounded-xl`; do not copy dashboard `rounded-2xl` or extra `text-white` / `sm:p-8` | Notes lock fill + blur only; changing radius would restyle beyond the named tokens | Unattended |
| Testing | Colocated `Welcome.test.ts` source-read plus `npm test` / `lint` / `build`; no Playwright | Invocation allowed UI tests; class tokens are CI-assertable via the PlanChat `readFileSync` pattern; §6.3 forbids Playwright | Unattended |
| Class merge / island | Static Astro `class=""` token replace; no `cn()`, no React island | No class merge happens; sign-in/dashboard siblings are static Astro strings | Plan |
| Other glass surfaces | Leave privacy, admin, confirm-email glass; leave Topbar `bg-white/5` | Locked Notes: do not restyle auth/dashboard; Topbar is on the do-not list | Plan |

## Scope

**In scope:** Three feature-card class attributes in `Welcome.astro`; colocated source-read Vitest for those tokens and the Welcome keep-list.

**Out of scope:** Hero, CTAs, Topbar, footer; auth/dashboard/privacy/admin cards; stars/orbs/gradient H1; Playwright; schema/API.

## Architecture / Approach

Single Astro markup edit on three identical class strings, plus a Node Vitest file that reads the source. `index.astro` stays a wrapper.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Solid feature card chrome | Solid-slate Welcome cards + source-read test | Accidentally restyling hero/Topbar or other cosmic pages |

**Prerequisites:** landing-quiet hero already on disk (it is).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Keeping `rounded-xl` (vs matching dashboard `rounded-2xl`) is the natural Notes parse; a human could still want radius unification.
- Visual solidity is human-judged (Progress 1.9); source greps cannot prove “not frosted” on screen.
- Adding `Welcome.test.ts` instead of grep-only chrome gates (landing-quiet / signin-with-nav) is recorded as FU-048.

## Success Criteria (Summary)

- `/` feature cards are solid `bg-slate-950` with no `backdrop-blur`.
- Hero, CTAs, Topbar, footer, and other pages’ cards are unchanged.
- `npm test` / `lint` / `build` pass.
