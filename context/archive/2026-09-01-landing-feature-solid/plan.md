# Solid landing feature cards Implementation Plan

## Overview

Restyle the three product feature cards on the public landing so they use the same solid slate surface as the dashboard card: drop frost-glass blur, set `bg-slate-950`, keep border/icons/copy. Do not touch the hero, CTAs, Topbar, or footer.

## Current State Analysis

`src/pages/index.astro` renders `Welcome` inside `Layout`. All landing markup lives in `src/components/Welcome.astro`. After `landing-quiet`, the hero is already solid white **HardFeelings** plus `Training plans for amateur runners.`; orbs and star-field are gone. The three feature cards still use glass chrome: `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl` (three identical `div`s under `<!-- Feature cards -->`).

Dashboard (`src/pages/dashboard.astro`) and auth sign-in/sign-up cards already use solid `bg-slate-950` with `border border-white/10`. Dashboard rounding is `rounded-2xl`; landing cards are `rounded-xl`. Privacy, admin, and confirm-email still use glass (`bg-white/10` + `backdrop-blur-xl`). Those pages are out of scope.

Welcome is static Astro (no React island, no `cn()`). Class strings are literal attributes, same as sign-in/dashboard siblings. No Vitest file currently asserts Welcome chrome; `PlanChat.test.ts` shows the colocated `readFileSync` source-read pattern.

## Desired End State

A signed-out visitor on `/` sees three solid slate feature cards under the hero — same `bg-slate-950` token as the dashboard card, not frosted glass. Icons, titles (`Race priorities A–D`, `Algorithmic generation`, `Chat with a diff`), body copy, borders, hero, Sign In / Sign Up, Topbar, and SiteFooter are unchanged. Stars, orbs, and a gradient H1 stay gone.

### Key Discoveries:

- Card chrome is three identical class strings in `src/components/Welcome.astro` lines 32, 57, and 79; `index.astro` is a one-line wrapper.
- Dashboard card is `rounded-2xl border border-white/10 bg-slate-950 p-6 text-white sm:p-8` (`src/pages/dashboard.astro` line 64). Notes lock background + drop blur + keep border; they do not ask to copy dashboard rounding or extra text/padding tokens.
- `bg-white/5` on the cards is the translucent fill that reads as glass with `backdrop-blur-xl`. Replacing it with `bg-slate-950` and dropping blur is the whole visual delta. Topbar’s own `bg-white/5` lives in `src/components/Topbar.astro` and must not be edited.
- AGENTS.md `cn()` applies when merging class strings. This change replaces tokens in a static Astro `class=""` — do not concatenate, do not introduce `cn()`, do not convert Welcome to a React island.
- Test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6). §6.3: do not add Playwright. §7: no visual snapshots. Sibling chrome changes (landing-quiet, signin-with-nav) used agent source greps only; `PlanChat.test.ts` source-reads TSX into Vitest.

## What We're NOT Doing

- H1, tagline, Sign In / Sign Up CTAs, Topbar, or SiteFooter.
- Restyling auth, dashboard, privacy, admin, or confirm-email cards.
- Bringing back stars, orbs, or a gradient H1.
- Changing card rounding to `rounded-2xl`, adding `text-white` on the card wrapper, or copying dashboard padding.
- Editing `bg-cosmic` in `src/styles/global.css`.
- Translating copy, new API routes, schema, or auth changes.
- Playwright or visual snapshots.

## Implementation Approach

One markup pass on the three feature-card `class` attributes in `Welcome.astro`, plus a colocated source-read Vitest file so `npm test` locks the class tokens. Verify with that test, source greps that other surfaces stayed put, lint, and build.

## Phase 1: Solid feature card chrome

### Overview

Make the three landing feature cards solid slate and lock that chrome in Vitest without touching the rest of Welcome or any other page.

### Changes Required:

#### 1. Feature card classes

**File**: `src/components/Welcome.astro`

**Intent**: The three cards under the hero should read as solid slate, consistent with the dashboard card fill, not frosted glass.

**Contract**: Edit only the `class` attribute on the three feature-card `div`s (the ones wrapping each icon + `<h3>` + body). On each: drop `backdrop-blur-xl`; replace `bg-white/5` with `bg-slate-950`; keep `rounded-xl`, `border`, `border-white/10`, and `p-6`. After the edit, `Welcome.astro` must not contain `backdrop-blur` or `bg-white/5`. Do not change H1, the hero `<p>`, CTA `<a>`s, Topbar/SiteFooter imports, icons, `<h3>` titles, or body copy. Stay Astro; do not add a React island; do not concatenate class strings.

#### 2. Source-read chrome test

**File**: `src/components/Welcome.test.ts`

**Intent**: `npm test` should fail if the feature cards regress to glass or if the keep-list in this file is edited by accident.

**Contract**: Colocated Vitest, Node environment, `readFileSync` of `Welcome.astro` via `import.meta.dirname` (same pattern as `src/components/plan/PlanChat.test.ts`). Assert `class="…rounded-xl…"` attributes that belong to the feature cards: exactly three such cards; each class list includes `rounded-xl`, `border-white/10`, `bg-slate-950`, and `p-6`; none includes `backdrop-blur` or `bg-white/5`. Assert the file has no `backdrop-blur` and no `bg-white/5` at all. Assert H1 text `HardFeelings`, H1 classes include `text-white` and do not include `bg-gradient-to-r` / `bg-clip-text`, hero `<p>` is exactly `Training plans for amateur runners.`, `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`, and Sign In / Sign Up hrefs remain `/auth/signin` and `/auth/signup`. Do not render Astro. Do not add Playwright.

### Success Criteria:

#### Automated Verification:

- `src/components/Welcome.astro` contains exactly three `bg-slate-950` tokens; the three feature-card `div` class lists include `rounded-xl`, `border-white/10`, `bg-slate-950`, and `p-6`; the file contains neither `backdrop-blur` nor `bg-white/5`
- Hero `<h1>` is `HardFeelings` with `text-white` and without `bg-gradient-to-r` / `bg-clip-text`; hero `<p>` is exactly `Training plans for amateur runners.`; Sign In / Sign Up hrefs are `/auth/signin` and `/auth/signup`; file still imports `Topbar` and `SiteFooter`; feature grid still includes `sm:grid-cols-3`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`
- `src/components/Welcome.astro` does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `overflow-hidden`, or `z-10`
- `src/pages/dashboard.astro` still contains `rounded-2xl border border-white/10 bg-slate-950`; `src/pages/auth/signin.astro` and `src/pages/auth/signup.astro` still contain `bg-slate-950` and do not gain `backdrop-blur`; `src/pages/auth/confirm-email.astro`, `src/pages/privacy.astro`, and `src/pages/admin.astro` still contain `backdrop-blur-xl`
- `src/components/Welcome.test.ts` exists and the assertions in its Contract pass under `npm test`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/` signed out and confirm: the three cards under the hero look solid slate (not frosted glass); H1, tagline, Sign In / Sign Up, Topbar, and footer are unchanged; no stars, orbs, or gradient title

---

## Testing Strategy

### Unit Tests:

- Colocated `src/components/Welcome.test.ts` source-reads `Welcome.astro` (test-plan §6.1 Node Vitest). Asserts card class tokens and the keep-list in that file. Not a risk-map scenario; this is a cheap chrome lock, not Playwright and not a visual snapshot (§6.3 / §7).

### Integration Tests:

- None. `npm run build` compiling `Welcome.astro` is the compile check.

### Manual Testing Steps:

1. Open `/` signed out.
2. Confirm the three feature cards look solid slate like the dashboard card fill, not glass.
3. Confirm hero, CTAs, Topbar, and footer are unchanged.

## Performance Considerations

Static SSR markup only. Dropping `backdrop-blur-xl` removes a blur filter on three nodes. No new islands or client JS.

## Migration Notes

None. Markup-only; no schema, cookies, or middleware.

## References

- `context/changes/landing-feature-solid/change.md` — locked Notes
- `context/archive/2026-09-01-landing-quiet/` — quiet hero; cards left glass on purpose
- `src/pages/dashboard.astro` — solid `bg-slate-950` card
- `src/components/plan/PlanChat.test.ts` — colocated source-read pattern
- `context/foundation/test-plan.md` §1, §6, §7

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Solid feature card chrome

#### Automated

- [x] 1.1 `src/components/Welcome.astro` contains exactly three `bg-slate-950` tokens; the three feature-card `div` class lists include `rounded-xl`, `border-white/10`, `bg-slate-950`, and `p-6`; the file contains neither `backdrop-blur` nor `bg-white/5` — 5877324
- [x] 1.2 Hero `<h1>` is `HardFeelings` with `text-white` and without `bg-gradient-to-r` / `bg-clip-text`; hero `<p>` is exactly `Training plans for amateur runners.`; Sign In / Sign Up hrefs are `/auth/signin` and `/auth/signup`; file still imports `Topbar` and `SiteFooter`; feature grid still includes `sm:grid-cols-3`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff` — 5877324
- [x] 1.3 `src/components/Welcome.astro` does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `overflow-hidden`, or `z-10` — 5877324
- [x] 1.4 `src/pages/dashboard.astro` still contains `rounded-2xl border border-white/10 bg-slate-950`; `src/pages/auth/signin.astro` and `src/pages/auth/signup.astro` still contain `bg-slate-950` and do not gain `backdrop-blur`; `src/pages/auth/confirm-email.astro`, `src/pages/privacy.astro`, and `src/pages/admin.astro` still contain `backdrop-blur-xl` — 5877324
- [x] 1.5 `src/components/Welcome.test.ts` exists and the assertions in its Contract pass under `npm test` — 5877324
- [x] 1.6 `npm test` exits 0 — 5877324
- [x] 1.7 `npm run lint` exits 0 — 5877324
- [x] 1.8 `npm run build` exits 0 — 5877324

#### Manual

- [x] 1.9 Open `/` signed out and confirm: the three cards under the hero look solid slate (not frosted glass); H1, tagline, Sign In / Sign Up, Topbar, and footer are unchanged; no stars, orbs, or gradient title
