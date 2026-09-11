# Quiet landing without starfield and gradient title Implementation Plan

## Overview

Quiet the public landing in `src/components/Welcome.astro`: drop the blur orbs and dotted star-field overlay, render the H1 as solid white, and shorten the subtitle to `Training plans for amateur runners.` Keep product cards, auth CTAs, Topbar, SiteFooter, and `bg-cosmic`.

## Current State Analysis

`src/pages/index.astro` renders `Welcome` inside `Layout`. The landing root is `bg-cosmic relative min-h-screen w-full overflow-hidden` with three absolute blur orbs (`blur-[120px]` / `blur-[100px]` / `blur-[140px]`) and a full-inset star-field `div` whose inline `background-image` is three `radial-gradient(circle, …)` layers. Content sits in a `relative z-10` column so it stacks above those overlays.

The hero H1 uses `bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text … text-transparent`. The hero `<p>` is `Training plans for amateur runners — live on Cloudflare Workers.` Feature cards (landing-product-copy), Sign In / Sign Up, Topbar, and SiteFooter are already product-shaped. Dashboard, auth, privacy, and admin still use their own gradient titles; those pages are out of scope. No Vitest or Playwright file asserts this chrome.

## Desired End State

A signed-out visitor on `/` sees the same cosmic page background and the same product cards and CTAs, without floating orbs or a dotted star overlay. **HardFeelings** is solid white. The subtitle is exactly `Training plans for amateur runners.` (period included, no Cloudflare clause).

### Key Discoveries:

- Landing markup lives only in `src/components/Welcome.astro`; `src/pages/index.astro` is a one-line wrapper.
- `bg-cosmic` is a Tailwind `@utility` in `src/styles/global.css` (dark vertical gradient). Keep the class on Welcome; do not edit the utility.
- Orbs and star field exist only in Welcome — not on dashboard, auth, or privacy.
- `overflow-hidden` on the root and `relative z-10` on the content column exist to clip and stack above the overlays. After the overlays go, those stacking classes are leftover (dashboard uses `bg-cosmic min-h-screen p-4 sm:p-8` with neither).
- Card `backdrop-blur-xl` is card chrome, not an orb. Keep it.
- AGENTS.md `cn()` applies to new class merges; this change must not concatenate class strings or convert Welcome to a React island.

## What We're NOT Doing

- Dashboard, auth, privacy, or admin pages (gradient titles there stay).
- Rewriting the three product cards (landing-product-copy already shipped).
- Editing `bg-cosmic` in `src/styles/global.css`.
- Removing Topbar, Sign In / Sign Up, SiteFooter, or the feature grid.
- Translating the landing to Polish.
- New Vitest or Playwright tests (chrome is asserted by source gates; visual quality is Manual).
- New API routes, schema, or auth changes.

## Implementation Approach

One markup edit in `Welcome.astro`: delete overlay nodes, drop overlay-only stacking classes, solid-white H1, exact subtitle. Verify with source greps plus existing lint, unit tests, and build.

## User experience spec

Hero copy and the absence of overlay decoration are part of the contract (the implementer must not invent a second subtitle or leave a star-field style elsewhere in this file). Card titles/bodies, CTA labels, Topbar, and SiteFooter stay as they are today.

## Phase 1: Quiet landing chrome

### Overview

Remove Welcome’s decorative overlays and gradient title so `/` reads as a quiet cosmic landing with a solid-white product name.

### Changes Required:

#### 1. Landing chrome

**File**: `src/components/Welcome.astro`

**Intent**: Visitors on `/` should see HardFeelings on `bg-cosmic` without blur orbs, a dotted star field, or a clipped gradient title.

**Contract**: Stay in this file. Do not convert to a React island. Do not concatenate class strings.

- Delete the three Cosmic orbs `div`s and the Star field `div` (the one with inline `radial-gradient` / `background-size` / `background-position`).
- After overlays are gone, drop overlay-only stacking: outer wrapper becomes `bg-cosmic min-h-screen w-full` (no `relative overflow-hidden`); the content column keeps `p-4 sm:p-8` and loses `relative z-10`.
- H1 text stays `HardFeelings`. Replace `bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-transparent` with `text-white`. Keep the existing type scale and spacing (`mb-6`, `text-5xl leading-tight font-bold sm:text-6xl lg:text-7xl`).
- Hero `<p>` body is exactly `Training plans for amateur runners.` including the period. Do not keep `— live on Cloudflare Workers.`
- Keep Topbar, Sign In (`/auth/signin`), Sign Up (`/auth/signup`), `bg-cosmic`, the three product cards (titles `Race priorities A–D`, `Algorithmic generation`, `Chat with a diff`, chrome `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`), and SiteFooter.

### Success Criteria:

#### Automated Verification:

- `src/components/Welcome.astro` contains `bg-cosmic` and does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `bg-clip-text`, `text-transparent`, `overflow-hidden`, or `z-10`
- Hero `<h1>` is `HardFeelings` and its class list includes `text-white` and does not include `bg-gradient-to-r`
- Hero `<p>` is exactly `Training plans for amateur runners.` and the file does not contain `Cloudflare Workers`
- Feature grid still includes `sm:grid-cols-3`; cards still include `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`; file still imports `Topbar` and `SiteFooter` and still has Sign In / Sign Up hrefs `/auth/signin` and `/auth/signup`
- `src/pages/dashboard.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`, `src/pages/privacy.astro`, and `src/pages/admin.astro` still contain `bg-clip-text` (untouched)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/` signed out and confirm: no blur orbs, no dotted star overlay, H1 is solid white, subtitle is `Training plans for amateur runners.` with no Cloudflare clause; Topbar, Sign In / Sign Up, three product cards, and the privacy footer remain

---

## Testing Strategy

### Unit Tests:

- None new. Landing chrome is static Astro markup; existing `npm test` must still pass. Test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6).

### Integration Tests:

- None. `npm run build` loading `Welcome.astro` is the compile check.

### Manual Testing Steps:

1. Open `/` signed out.
2. Confirm the quiet hero (white title, shortened subtitle, no orbs/stars) and that cards, CTAs, Topbar, and footer are unchanged.

## Performance Considerations

Static SSR markup only; removing overlay nodes slightly reduces DOM. No extra islands or client JS.

## References

- `context/changes/landing-quiet/change.md` — locked Notes
- `context/archive/2026-08-31-landing-product-copy/` — cards already shipped
- `src/components/Welcome.astro`
- `src/pages/index.astro`
- `src/styles/global.css` — `@utility bg-cosmic`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Quiet landing chrome

#### Automated

- [x] 1.1 `src/components/Welcome.astro` contains `bg-cosmic` and does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `bg-clip-text`, `text-transparent`, `overflow-hidden`, or `z-10` — 0e7ed77
- [x] 1.2 Hero `<h1>` is `HardFeelings` and its class list includes `text-white` and does not include `bg-gradient-to-r` — 0e7ed77
- [x] 1.3 Hero `<p>` is exactly `Training plans for amateur runners.` and the file does not contain `Cloudflare Workers` — 0e7ed77
- [x] 1.4 Feature grid still includes `sm:grid-cols-3`; cards still include `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`; file still imports `Topbar` and `SiteFooter` and still has Sign In / Sign Up hrefs `/auth/signin` and `/auth/signup` — 0e7ed77
- [x] 1.5 `src/pages/dashboard.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`, `src/pages/privacy.astro`, and `src/pages/admin.astro` still contain `bg-clip-text` (untouched) — 0e7ed77
- [x] 1.6 `npm test` exits 0 — 0e7ed77
- [x] 1.7 `npm run lint` exits 0 — 0e7ed77
- [x] 1.8 `npm run build` exits 0 — 0e7ed77

#### Manual

- [x] 1.9 Open `/` signed out and confirm: no blur orbs, no dotted star overlay, H1 is solid white, subtitle is `Training plans for amateur runners.` with no Cloudflare clause; Topbar, Sign In / Sign Up, three product cards, and the privacy footer remain
