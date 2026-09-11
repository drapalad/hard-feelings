# Current-page Dashboard in Topbar — Implementation Plan

## Overview

When a signed-in member is already on `/dashboard` (or `/dashboard/`), the topbar “Dashboard” control is current-page text, not a self-link. Every other path keeps the existing purple Dashboard link. Email, Sign out, and Admin stay as they are.

## Current State Analysis

`src/components/Topbar.astro` is the signed-in chrome used on `/` (`Welcome.astro`), `/dashboard`, `/admin`, `/privacy`, and `/auth/signin`. When `Astro.locals.user` is set, it always renders:

- left: `{user.email}` in `text-blue-100/70`
- right: `<a href="/dashboard" class="text-purple-300 …">Dashboard</a>`, optional Admin link, Sign out `POST` form

There is no `Astro.url.pathname` check today (`grep` finds none under `src/`). Guests see “Not signed in” + Sign in / Sign up — no Dashboard control. `astro.config.mjs` does not set `trailingSlash` (default `ignore`), so both `/dashboard` and `/dashboard/` can appear. Query strings (`/dashboard?tab=…`) do not change `pathname`.

Vitest is Node-only (`src/**/*.test.ts`). Astro templates are not imported by tests; copy/layout contracts are asserted by reading source, as in `src/components/plan/PlanChat.test.ts`. Playwright is not a suite (test-plan §6.3). `cn()` lives in `@/lib/utils` and is used in React islands; Topbar currently uses static class strings on distinct elements.

## Desired End State

A signed-in visitor on `/dashboard` or `/dashboard/` sees “Dashboard” as a `span` with `text-white` and `aria-current="page"` — not an `<a>`. On every other path, the existing purple `/dashboard` link remains. Email stays on the left; Sign out stays a purple control; Admin is unchanged. No product wordmark and no HardFeelings link to `/`.

### Key Discoveries:

- Current self-link is `src/components/Topbar.astro` lines 13–15 (`<a href="/dashboard" class="text-purple-300 …">`).
- Call sites import Topbar only; they do not pass a current-page prop — `Astro.url.pathname` is the right input.
- Source-read Vitest is the established UI-contract pattern (`PlanChat.test.ts`); do not add Playwright.
- LOCKED scope is this file plus tests; `dashboard-tab-url` owns welcome/tabs.

## What We're NOT Doing

- Removing the email from the topbar.
- Adding a product wordmark or a HardFeelings link to `/`.
- Changing Sign out, Admin, the Dashboard H1, tabs, or welcome.
- Treating Admin (or any other path) as current-page text.
- Adding a Dashboard control for signed-out visitors.
- Extracting a new `.ts` helper module (would widen past the locked production file).
- Playwright / e2e, React islands, `"use client"`, class-string concatenation, or `cn()` for this markup (two complete class strings on different tags).

## Implementation Approach

One phase. In the signed-in cluster of `Topbar.astro`, branch on exact pathname `/dashboard` or `/dashboard/`: current page → `span`; otherwise keep the existing `<a>`. Colocate a source-contract test that locks the branch, classes, `aria-current`, and the unchanged email / Sign out / Admin markup.

## Phase 1: Current-page Dashboard in Topbar

### Overview

Replace the always-on Dashboard self-link with a current-page `span` on `/dashboard` and `/dashboard/`, and add a Vitest source contract so the branch cannot regress to a link or drop email/Sign out.

### Changes Required:

#### 1. Topbar current-page branch

**File**: `src/components/Topbar.astro`

**Intent**: When the signed-in member is on the dashboard path (with or without a trailing slash), show “Dashboard” as non-interactive current-page text. On every other path, keep the existing purple link. Leave email, Admin, Sign out, and the signed-out cluster untouched.

**Contract**: Compute a local boolean from `Astro.url.pathname === "/dashboard" || Astro.url.pathname === "/dashboard/"`. In the signed-in right-hand cluster, if true, render `<span class="text-white" aria-current="page">Dashboard</span>`; if false, keep the existing `<a href="/dashboard" class="text-purple-300 transition-colors hover:text-purple-100 hover:underline">Dashboard</a>`. Do not change `{user.email}`, the Admin `{Astro.locals.isAdmin ? …}` link, the Sign out form, or the guest Sign in / Sign up cluster. Do not add `href="/"`.

#### 2. Source-contract test

**File**: `src/components/Topbar.test.ts` (new)

**Intent**: Lock the current-page markup and the “do not” list without rendering Astro (Node Vitest cannot import `.astro`). Follow `PlanChat.test.ts`: `readFileSync` the sibling template.

**Contract**: The test file is picked up by `vitest.config.ts` `include: ["src/**/*.test.ts"]`. Assertions against `Topbar.astro` source must include: both exact pathname literals `/dashboard` and `/dashboard/`; a current-page `span` with `text-white` and `aria-current="page"`; the existing purple `<a href="/dashboard"` still present for the non-current branch; `{user.email}` still rendered; Sign out still `method="POST"` to `/api/auth/signout`; Admin still `<a href="/admin"`; no signed-in HardFeelings/`href="/"` wordmark.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/Topbar.test.ts` passes
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes (if `.env` is missing in this worktree, copy `.env.example` to `.env` with dummy `SUPABASE_URL` / `SUPABASE_KEY` placeholders; do not commit `.env`)
- `src/components/Topbar.astro` signed-in Dashboard is a `span` with `text-white` and `aria-current="page"` when pathname is `/dashboard` or `/dashboard/`, and an `<a href="/dashboard">` with `text-purple-300` otherwise
- Email, Sign out, and Admin markup in `Topbar.astro` are unchanged from today’s structure

#### Manual Verification:

- Signed in on `/dashboard`: topbar “Dashboard” is white current-page text (not a link); Sign out stays a purple control; the email is still visible
- Signed in on `/` or `/auth/signin`: “Dashboard” remains a purple link
- Signed in on `/admin` (if Admin): “Dashboard” remains a purple link; Admin control is unchanged

---

## Testing Strategy

### Unit Tests:

- Colocated `Topbar.test.ts` source contract: current-page `span` vs off-page `<a>`, both path literals, email / Sign out / Admin preserved, no home wordmark.
- Deliberate-break: weaken the current-page branch (always render the `<a>`) and confirm the source-contract test fails.

### Integration Tests:

- None. No API, persist, or auth change.

### Manual Testing Steps:

1. Sign in, open `/dashboard`, confirm white current-page “Dashboard”, visible email, purple Sign out.
2. Open `/` and `/auth/signin` while still signed in; Dashboard is a link.
3. If Admin, open `/admin`; Dashboard is still a link; Admin is unchanged.

## Performance Considerations

None. One pathname compare per Topbar render.

## Migration Notes

None. Markup-only; no schema, cookies, or deploy steps.

## References

- Locked spec: `context/changes/dashboard-nav-current/change.md`
- Topbar today: `src/components/Topbar.astro`
- Source-contract pattern: `src/components/plan/PlanChat.test.ts`
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3
- Welcome/tabs owned by `dashboard-tab-url`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Current-page Dashboard in Topbar

#### Automated

- [x] 1.1 `npm test -- src/components/Topbar.test.ts` passes — f1c1655
- [x] 1.2 `npm test` passes — f1c1655
- [x] 1.3 `npm run lint` passes — f1c1655
- [x] 1.4 `npm run build` passes (if `.env` is missing in this worktree, copy `.env.example` to `.env` with dummy `SUPABASE_URL` / `SUPABASE_KEY` placeholders; do not commit `.env`) — f1c1655
- [x] 1.5 `src/components/Topbar.astro` signed-in Dashboard is a `span` with `text-white` and `aria-current="page"` when pathname is `/dashboard` or `/dashboard/`, and an `<a href="/dashboard">` with `text-purple-300` otherwise — f1c1655
- [x] 1.6 Email, Sign out, and Admin markup in `Topbar.astro` are unchanged from today’s structure — f1c1655

#### Manual

- [x] 1.7 Signed in on `/dashboard`: topbar “Dashboard” is white current-page text (not a link); Sign out stays a purple control; the email is still visible
- [x] 1.8 Signed in on `/` or `/auth/signin`: “Dashboard” remains a purple link
- [x] 1.9 Signed in on `/admin` (if Admin): “Dashboard” remains a purple link; Admin control is unchanged
