# Sign-in page with site topbar and solid card Implementation Plan

## Overview

Put the existing site Topbar on `/auth/signin` and restyle that page’s form card from glass (`bg-white/10` + `backdrop-blur-xl`) to solid `bg-slate-950`. Copy the same two card classes onto `/auth/signup` because the markup is identical. Do not restyle Topbar.

## Current State Analysis

`src/pages/auth/signin.astro` is a cosmic full-viewport column: a centered `max-w-sm` glass card (`rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl`) wrapping a gradient H1, the `SignInForm` React island (`client:load`), an in-card Sign up link, and `SiteFooter` at the bottom. There is no Topbar.

Landing (`src/components/Welcome.astro`) and privacy (`src/pages/privacy.astro`) already import `src/components/Topbar.astro`. Signed-out Topbar renders “Not signed in” plus Sign in / Sign up links; signed-in Topbar renders email, Dashboard, optional Admin, and Sign out. Topbar is a static Astro component that reads `Astro.locals.user` — no restyle in this change.

`src/pages/auth/signup.astro` uses the same glass card class string as sign-in. `src/pages/auth/confirm-email.astro` is the same glass pattern but is not named in the change notes. No Vitest or Playwright file asserts auth-page chrome. `bg-slate-950` is not used on any page yet.

## Desired End State

A signed-out visitor on `/auth/signin` sees the same Topbar as landing/privacy above a solid dark card. The card still has the Sign in H1, email/password fields, in-card Sign up link, Privacy footer, and `bg-cosmic`. Sign-up’s card matches the two new classes; it still has no Topbar. Topbar markup and classes are unchanged.

### Key Discoveries:

- Topbar already implements the signed-out copy the notes describe (`src/components/Topbar.astro` lines 29–39) — import it; do not duplicate those links.
- Privacy/dashboard place Topbar at the top of a padded cosmic wrapper (`p-4 sm:p-8`); sign-in currently pads only the centering flex around the card (`p-4`).
- Sign-in and sign-up share one card class string; swapping `bg-white/10` + `backdrop-blur-xl` for `bg-slate-950` on signup is a one-line copy.
- Inner form fields (`FormField` `bg-white/10`) are a different surface; LOCKED DECISIONS keep form fields, not restyle inputs.
- AGENTS.md `cn()` applies to merged class strings; this page uses a static Astro `class=""` like siblings — replace tokens in place, do not concatenate.

## What We're NOT Doing

- Restyling `Topbar.astro` (layout, classes, copy, or wordmark).
- Adding Topbar to `/auth/signup` or `/auth/confirm-email`.
- Changing SignInForm / SignUpForm behavior, validation, or field chrome.
- Changing the sign-in H1 (keep the existing gradient clip-text).
- Redirecting already-signed-in visitors away from `/auth/signin`.
- Dashboard, landing, privacy, admin, or Layout.
- New Vitest or Playwright tests (chrome is source-gated; visual quality is Manual).
- New cookies, auth API, or middleware changes.

## Implementation Approach

One markup pass: import Topbar on sign-in, place it above the card using the existing cosmic flex column, swap the card background classes on sign-in and sign-up. Verify with source greps plus `npm test`, `npm run lint`, and `npm run build`.

## User experience spec

Topbar must sit above the card, full width of the page content column — not squeezed into `max-w-sm`. Signed-out visitors must see “Not signed in” plus Sign in / Sign up from Topbar itself. The in-card “Don't have an account? Sign up” line stays. Privacy footer stays inside the cosmic wrapper.

## Phase 1: Topbar and solid auth cards

### Overview

Add Topbar to sign-in and restyle the sign-in (and sign-up) cards to solid slate.

### Changes Required:

#### 1. Sign-in page chrome

**File**: `src/pages/auth/signin.astro`

**Intent**: Signed-out visitors get the same site nav as landing/privacy, and the form card matches the solid-slate treatment instead of glass.

**Contract**: Import `Topbar` from `@/components/Topbar.astro`. Keep `Layout title="Sign in"`, `SignInForm` with `client:load`, the H1 text `Sign in` (existing gradient classes), the in-card Sign up paragraph, and `SiteFooter` inside the cosmic wrapper. Cosmic root stays `bg-cosmic flex min-h-screen flex-col` and **gains** `p-4 sm:p-8` (same tokens as Welcome/privacy/dashboard). Place `<Topbar />` as the first child of that root, then the existing centering wrapper (`flex flex-1 items-center justify-center`) **without** its current extra `p-4` — do not stack inner `p-4` on outer `p-4 sm:p-8`. Do not wrap Topbar in `max-w-sm`. On the card `div`, keep `w-full max-w-sm rounded-2xl border border-white/10 p-8 text-white`; replace `bg-white/10` with `bg-slate-950`; remove `backdrop-blur-xl`. The card class string must not contain `bg-white/10` or `backdrop-blur`. Do not edit `SignInForm`.

#### 2. Sign-up card classes (trivial copy)

**File**: `src/pages/auth/signup.astro`

**Intent**: Sign-up keeps the same card surface as sign-in so the two auth forms do not split glass vs solid. Topbar stays off this page.

**Contract**: Apply the same two card-class edits as sign-in (`bg-slate-950`; drop `bg-white/10` and `backdrop-blur-xl`). Do not import or render Topbar. Keep H1, `SignUpForm`, in-card Sign in link, `SiteFooter`, and `bg-cosmic`.

### Success Criteria:

#### Automated Verification:

- `src/pages/auth/signin.astro` imports `Topbar` from `@/components/Topbar.astro`, renders `<Topbar />` before the card `div`, and the cosmic root includes `p-4 sm:p-8` while the centering wrapper does not include a separate `p-4`
- Sign-in card class string includes `bg-slate-950` and `border-white/10`, and includes neither `bg-white/10` nor `backdrop-blur`
- Sign-in still has H1 text `Sign in`, `SignInForm` with `client:load`, `bg-cosmic`, and `SiteFooter`
- `src/pages/auth/signup.astro` card class string includes `bg-slate-950` and includes neither `bg-white/10` nor `backdrop-blur`; the file does not import Topbar
- `src/components/Topbar.astro` still contains the signed-out span `Not signed in` and the `bg-white/5` bar class (file otherwise unchanged)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/auth/signin` signed out: Topbar shows “Not signed in” plus Sign in / Sign up above a solid dark card (not frosted glass); H1, email/password, Privacy footer, and cosmic background remain

---

## Testing Strategy

### Unit Tests:

- None new. Auth chrome is static Astro markup; test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6). Existing `npm test` must still pass.

### Integration Tests:

- None. `npm run build` compiling the auth pages is the compile check.

### Manual Testing Steps:

1. Open `/auth/signin` signed out and confirm Topbar + solid card + form + Privacy footer.
2. Confirm Topbar Sign up and the in-card Sign up link both go to `/auth/signup`.
3. Glance at `/auth/signup`: solid card, no Topbar.

## Performance Considerations

Static SSR plus the existing `SignInForm` island. No new client JS. Topbar has no `client:` directive.

## Migration Notes

None. Markup-only; no schema, cookies, or middleware.

## References

- `context/changes/signin-with-nav/change.md` — LOCKED DECISIONS
- `src/pages/auth/signin.astro`
- `src/pages/auth/signup.astro`
- `src/components/Topbar.astro`
- `src/pages/privacy.astro` — Topbar + cosmic + footer pattern
- `src/components/Welcome.astro` — signed-out Topbar on a public page
- `context/foundation/test-plan.md` §1, §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Topbar and solid auth cards

#### Automated

- [x] 1.1 `src/pages/auth/signin.astro` imports `Topbar` from `@/components/Topbar.astro`, renders `<Topbar />` before the card `div`, and the cosmic root includes `p-4 sm:p-8` while the centering wrapper does not include a separate `p-4` — af668dc
- [x] 1.2 Sign-in card class string includes `bg-slate-950` and `border-white/10`, and includes neither `bg-white/10` nor `backdrop-blur` — af668dc
- [x] 1.3 Sign-in still has H1 text `Sign in`, `SignInForm` with `client:load`, `bg-cosmic`, and `SiteFooter` — af668dc
- [x] 1.4 `src/pages/auth/signup.astro` card class string includes `bg-slate-950` and includes neither `bg-white/10` nor `backdrop-blur`; the file does not import Topbar — af668dc
- [x] 1.5 `src/components/Topbar.astro` still contains the signed-out span `Not signed in` and the `bg-white/5` bar class (file otherwise unchanged) — af668dc
- [x] 1.6 `npm test` exits 0 — af668dc
- [x] 1.7 `npm run lint` exits 0 — af668dc
- [x] 1.8 `npm run build` exits 0 — af668dc

#### Manual

- [x] 1.9 Open `/auth/signin` signed out: Topbar shows “Not signed in” plus Sign in / Sign up above a solid dark card (not frosted glass); H1, email/password, Privacy footer, and cosmic background remain
