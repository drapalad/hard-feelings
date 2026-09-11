# Signed-in landing hero opens the dashboard — Implementation Plan

## Overview

When `Astro.locals.user` is set, the landing hero primary CTA is **Open dashboard** linking to `/dashboard` via a normal document-load `<a>`. Signed-out visitors keep the current Sign In / Sign Up pair. Topbar, auth pages, middleware, and footer stay untouched.

## What We're NOT Doing

- Restyling or editing `src/components/Topbar.astro` (S-07.4)
- Changing auth pages, middleware, or footer
- Adding a React island / `"use client"` / `client:load` on Welcome
- Playwright / e2e
- Migrations

## Phase 1: Signed-in hero Open dashboard

### Overview

Branch the landing hero on `Astro.locals.user` in `Welcome.astro`. Signed-in: one primary **Open dashboard** `<a href="/dashboard">`. Signed-out: existing Sign In / Sign Up hrefs and styles. Colocated source-scan test.

### Changes Required:

#### 1. Welcome hero CTA branch

**File**: `src/components/Welcome.astro`

**Intent**: Read `Astro.locals.user` (same pattern as Topbar). When set, render a single primary CTA **Open dashboard** as a document-load `<a href="/dashboard">` and do not render hero Sign In or Sign Up. When unset, keep the current Sign In (`/auth/signin`) and Sign Up (`/auth/signup`) anchors with their existing class strings.

**Contract**: `const { user } = Astro.locals` in the frontmatter. Signed-in branch: one `<a href="/dashboard">` whose visible text is `Open dashboard`, using the current Sign In filled-purple class string. Signed-out branch: both existing `<a>` elements unchanged (hrefs and `class` attributes). Keep `<Topbar />` and `<SiteFooter />` as they are. No `client:load`. No edits to `Topbar.astro`, auth pages, middleware, or footer.

#### 2. Source-contract tests

**File**: `src/components/Welcome.test.ts`

**Intent**: Cookbook §6.1 colocated source-scan (same approach as `Topbar.test.ts`). Lock signed-in vs signed-out hero chrome so a later edit cannot silently restore always-on Sign In / Sign Up.

**Contract**: `readFileSync` `Welcome.astro`. Assert: `Astro.locals` user read; signed-in `href="/dashboard"` and the text `Open dashboard`; signed-in branch does not render `Sign In` / `Sign Up` as sibling hero CTAs; signed-out `href="/auth/signin"` and `href="/auth/signup"` with the current class strings; no `client:load`. Do not assert Topbar internals.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/Welcome.test.ts` passes
- `npm test` passes
- `npm run lint` passes (if it fails only on files this phase did not touch, `npx eslint` the touched Welcome files instead)
- Welcome source reads `Astro.locals.user`; signed-in hero is **Open dashboard** → `/dashboard` without Sign In / Sign Up; signed-out hero keeps Sign In / Sign Up hrefs and styles; no `client:load`

#### Manual Verification:

- Signed in, open `/`: hero shows **Open dashboard** only; click is a normal navigation to `/dashboard`; no Sign In / Sign Up in the hero
- Signed out, open `/`: hero still shows Sign In and Sign Up with the same look and destinations as today
- Topbar chrome is unchanged (signed-in plan tabs + Sign out; guest Sign in / Sign up)

## Testing Strategy

### Unit Tests:

- Colocated `Welcome.test.ts` source contract as in Phase 1.2. Deliberate-break: restore always-on Sign In / Sign Up (drop the `user` branch) and confirm the scan goes red.

## References

- Locked spec: `context/changes/landing-signed-in-cta/change.md` `## Notes`
- Research: `context/changes/landing-signed-in-cta/research.md`
- Pattern: `src/components/Topbar.astro` (`Astro.locals.user`), `src/components/Topbar.test.ts` (source-scan)
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Signed-in hero Open dashboard

#### Automated

- [x] 1.1 `npm test -- src/components/Welcome.test.ts` passes — 3b9b351
- [x] 1.2 `npm test` passes — 3b9b351
- [x] 1.3 `npm run lint` passes (if it fails only on files this phase did not touch, `npx eslint` the touched Welcome files instead) — 3b9b351
- [x] 1.4 Welcome source reads `Astro.locals.user`; signed-in hero is **Open dashboard** → `/dashboard` without Sign In / Sign Up; signed-out hero keeps Sign In / Sign Up hrefs and styles; no `client:load` — 3b9b351

#### Manual

- [x] 1.5 Signed in, open `/`: hero shows **Open dashboard** only; click is a normal navigation to `/dashboard`; no Sign In / Sign Up in the hero
- [x] 1.6 Signed out, open `/`: hero still shows Sign In and Sign Up with the same look and destinations as today
- [x] 1.7 Topbar chrome is unchanged (signed-in plan tabs + Sign out; guest Sign in / Sign up)
