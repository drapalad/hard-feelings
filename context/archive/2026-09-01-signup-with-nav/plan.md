# Sign-up page with the same Topbar as sign-in Implementation Plan

## Overview

Put the existing site Topbar on `/auth/signup` using the same page chrome as `/auth/signin`: outer cosmic padding, Topbar above the card, inner flex without a second `p-4`. Do not restyle the card, fields, or Create account button.

## Current State Analysis

`src/pages/auth/signup.astro` is a cosmic full-viewport column (`bg-cosmic flex min-h-screen flex-col`) with a centered `max-w-sm` solid card (`rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`) wrapping a gradient H1, the `SignUpForm` React island (`client:load`), an in-card Sign in link, and `SiteFooter`. There is no Topbar. The centering wrapper still has its own `p-4`.

`src/pages/auth/signin.astro` already has the target chrome: cosmic root `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, `<Topbar />` as the first child, then `flex flex-1 items-center justify-center` with no extra `p-4`, then the same card class string. Signed-out Topbar (`src/components/Topbar.astro` lines 29–39) already renders “Not signed in” plus Sign in / Sign up.

`signin-with-nav` (archived 2026-09-01) added Topbar to sign-in and copied the solid card classes onto signup; it explicitly left Topbar off signup. `confirm-email.astro` is still glass and is not named in this change’s notes. No Vitest file asserts signup chrome today. Test-plan §6.3 forbids adding Playwright; §1 cost×signal still applies.

## Desired End State

A signed-out visitor on `/auth/signup` sees the same Topbar as sign-in (“Not signed in / Sign in / Sign up”) above the existing sign-up card. Card classes, H1, `SignUpForm` (including validation), in-card Sign in link, Privacy footer, and `bg-cosmic` are unchanged except for the chrome wrapper. `signin.astro` and `Topbar.astro` are not edited.

### Key Discoveries:

- Topbar already implements the signed-out copy the notes require (`src/components/Topbar.astro` lines 29–39) — import it; do not duplicate those links in signup.
- Sign-in is the chrome template: outer `p-4 sm:p-8` on the cosmic flex root, Topbar first, centering wrapper without `p-4` (`src/pages/auth/signin.astro` lines 11–14). FU-036 already confirmed full-width Topbar with that padding for sign-in.
- Signup’s card is already `bg-slate-950` from `signin-with-nav`; this change must not restyle it.
- Inner `FormField` chrome lives in `SignUpForm.tsx`; LOCKED DECISIONS keep validation and field chrome out of this slice.
- AGENTS.md `cn()` applies to merged class strings; sibling auth pages use a static Astro `class=""` — copy sign-in’s tokens in place, do not concatenate.

## What We're NOT Doing

- Editing `src/pages/auth/signin.astro` or `src/components/Topbar.astro` (current-page Dashboard text is `dashboard-nav-current`).
- Restyling the signup card, form fields, or Create account button.
- Changing `SignUpForm` validation or behavior.
- Adding Topbar to `/auth/confirm-email`.
- Redirecting already-signed-in visitors away from `/auth/signup`.
- Dashboard, landing, privacy, admin, Layout, cookies, auth API, or middleware.
- Playwright / e2e (test-plan §6.3).

## Implementation Approach

One markup pass on `signup.astro` that copies sign-in’s wrapper (import + padding + Topbar placement), plus a colocated source-read Vitest lock so the chrome cannot drop without a failing unit test. Verify with that test plus `npm test`, `npm run lint`, and `npm run build`.

## User experience spec

Topbar must sit above the card, full width of the cosmic content column — not squeezed into `max-w-sm`. Signed-out visitors must see “Not signed in” plus Sign in / Sign up from Topbar itself. The in-card “Already have an account? Sign in” line stays. Privacy footer stays inside the cosmic wrapper.

## Phase 1: Sign-up Topbar chrome

### Overview

Add Topbar to sign-up with sign-in’s cosmic padding, and lock the chrome with a source Vitest file.

### Changes Required:

#### 1. Sign-up page chrome

**File**: `src/pages/auth/signup.astro`

**Intent**: Signed-out visitors get the same site nav as sign-in, without changing the form card.

**Contract**: Import `Topbar` from `@/components/Topbar.astro`. Keep `Layout title="Sign up"`, `SignUpForm` with `client:load`, the H1 text `Sign up` (existing gradient classes), the in-card Sign in paragraph, and `SiteFooter` inside the cosmic wrapper. Change the cosmic root to `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8` (same tokens as sign-in). Place `<Topbar />` as the first child of that root, then the existing centering wrapper (`flex flex-1 items-center justify-center`) **without** its current extra `p-4` — do not stack inner `p-4` on outer `p-4 sm:p-8`. Do not wrap Topbar in `max-w-sm`. Leave the card `div` class string exactly `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`. Do not edit `SignUpForm`. Use a static `class=""` like sign-in; do not introduce `cn()`.

#### 2. Chrome source lock

**File**: `src/pages/auth/signup.test.ts`

**Intent**: Cheap Node-side regression lock for the chrome contract (test-plan §6.1 colocated `src/**/*.test.ts`; not a risk-map scenario, not Playwright).

**Contract**: Colocated Vitest file. `readFileSync` the sibling `signup.astro` (same pattern as `src/components/plan/PlanChat.test.ts`). Assert: import of `@/components/Topbar.astro`; `<Topbar />` appears in source before the card class string; cosmic root contains `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`; centering wrapper is `flex flex-1 items-center justify-center` and the file does not contain `flex flex-1 items-center justify-center p-4`; card class string is exactly `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`; `SignUpForm` with `client:load` remains. Do not render the page. Do not add Playwright.

### Success Criteria:

#### Automated Verification:

- `src/pages/auth/signup.astro` imports `Topbar` from `@/components/Topbar.astro`, renders `<Topbar />` as the first child of the cosmic root (before the card column), and the cosmic root class is `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8` while the centering wrapper is `flex flex-1 items-center justify-center` without a separate `p-4`
- Sign-up card class string remains `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`; H1 text `Sign up`, `SignUpForm` with `client:load`, in-card Sign in link, `SiteFooter`, and `bg-cosmic` remain
- `src/pages/auth/signup.test.ts` reads `signup.astro` and asserts Topbar import/placement, cosmic padding, no inner centering `p-4`, and the unchanged card class string
- `src/pages/auth/signin.astro` and `src/components/Topbar.astro` are unchanged
- `src/components/auth/SignUpForm.tsx` is unchanged
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/auth/signup` signed out: Topbar shows “Not signed in” plus Sign in / Sign up above the existing card; card, fields, and Create account look unchanged vs today

---

## Testing Strategy

### Unit Tests:

- Colocated `src/pages/auth/signup.test.ts` source-reads `signup.astro` and asserts the chrome contract above. Test-plan §1: this is not risk-map #1–#6; the cheapest lock that proves Topbar cannot silently disappear. Existing `npm test` must still pass.

### Integration Tests:

- None. `npm run build` compiling the auth page is the compile check.

### Manual Testing Steps:

1. Open `/auth/signup` signed out and confirm Topbar (“Not signed in” + Sign in / Sign up) above the existing card, with Privacy footer and cosmic background.
2. Confirm Topbar Sign in and the in-card Sign in link both go to `/auth/signin`.
3. Confirm the card, fields, and Create account button were not restyled.

## Performance Considerations

Static SSR plus the existing `SignUpForm` island. No new client JS. Topbar has no `client:` directive.

## Migration Notes

None. Markup-only; no schema, cookies, or middleware. If `npm run build` needs `SUPABASE_URL` / `SUPABASE_KEY` in this worktree, copy `.env.example` to `.env` with dummy placeholders; never commit `.env`.

## References

- `context/changes/signup-with-nav/change.md` — LOCKED DECISIONS
- `src/pages/auth/signup.astro`
- `src/pages/auth/signin.astro` — chrome template
- `src/components/Topbar.astro`
- `context/archive/2026-09-01-signin-with-nav/plan.md` — sibling that left Topbar off signup
- `src/components/plan/PlanChat.test.ts` — source-read Vitest pattern
- `context/foundation/test-plan.md` §1, §6.1, §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sign-up Topbar chrome

#### Automated

- [x] 1.1 `src/pages/auth/signup.astro` imports `Topbar` from `@/components/Topbar.astro`, renders `<Topbar />` as the first child of the cosmic root (before the card column), and the cosmic root class is `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8` while the centering wrapper is `flex flex-1 items-center justify-center` without a separate `p-4` — 516a74a
- [x] 1.2 Sign-up card class string remains `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`; H1 text `Sign up`, `SignUpForm` with `client:load`, in-card Sign in link, `SiteFooter`, and `bg-cosmic` remain — 516a74a
- [x] 1.3 `src/pages/auth/signup.test.ts` reads `signup.astro` and asserts Topbar import/placement, cosmic padding, no inner centering `p-4`, and the unchanged card class string — 516a74a
- [x] 1.4 `src/pages/auth/signin.astro` and `src/components/Topbar.astro` are unchanged — 516a74a
- [x] 1.5 `src/components/auth/SignUpForm.tsx` is unchanged — 516a74a
- [x] 1.6 `npm test` exits 0 — 516a74a
- [x] 1.7 `npm run lint` exits 0 — 516a74a
- [x] 1.8 `npm run build` exits 0 — 516a74a

#### Manual

- [x] 1.9 Open `/auth/signup` signed out: Topbar shows “Not signed in” plus Sign in / Sign up above the existing card; card, fields, and Create account look unchanged vs today
