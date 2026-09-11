# Solid dashboard card and drop duplicate sign out Implementation Plan

## Overview

Restyle the `/dashboard` main card from glass (`bg-white/10` + `backdrop-blur-xl`) to solid `bg-slate-950`, render the page H1 as solid white, and remove the duplicate Sign out form at the bottom of the card. Keep Topbar Sign out, Week/Profile tabs, nested glass on setup/week/chat, SiteFooter, and `bg-cosmic`.

## Current State Analysis

`src/pages/dashboard.astro` is a cosmic padded page (`bg-cosmic min-h-screen p-4 sm:p-8`) with Topbar, one glass card (`rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl sm:p-8`), and SiteFooter. Inside the card: a gradient H1 (`bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent`), a welcome line with `user?.email`, the `DashboardTabs` island (`client:load` — Week / Profile from `dashboard-profile-tab`), then a second Sign out form (`POST /api/auth/signout`). Topbar already posts the same sign-out action.

Auth sign-in/sign-up already use this card treatment (`bg-slate-950`, `border-white/10`, no blur) from `signin-with-nav`. Nested glass lives in child components (`DashboardTabs` tab buttons, `SetupForm` fields, `PlanChat` / `PlanCalendar`), not on the page card. No Vitest or Playwright file asserts dashboard chrome.

## Desired End State

A signed-in member on `/dashboard` sees a solid slate card (`bg-slate-950`, `border-white/10`) with a solid-white **Dashboard** heading. There is one Sign out control — in Topbar. Week/Profile tabs and nested glass on setup/week/chat look as they do today. SiteFooter and `bg-cosmic` remain.

### Key Discoveries:

- Chrome lives only in `src/pages/dashboard.astro` (card class list, H1 classes, bottom form). `DashboardTabs.tsx` owns Week/Profile; do not restyle those tabs.
- Topbar Sign out is `src/components/Topbar.astro` (POST `/api/auth/signout`). After this change `dashboard.astro` must not contain that form.
- `signin-with-nav` already swapped the same two card tokens on auth pages; copy that class delta, not a new pattern.
- AGENTS.md `cn()` applies to merged class strings; this page uses a static Astro `class=""` like siblings — replace tokens in place, do not concatenate.
- Test-plan §6.3 / §7: do not add Playwright; visual chrome is not a risk-map scenario.

## What We're NOT Doing

- Editing `Topbar.astro` (layout, wordmark, email in the bar, Sign out control).
- Restyling or reverting Week/Profile tabs (`DashboardTabs.tsx`, `dashboard-tabs.ts`).
- Changing nested glass on setup/week/chat (`SetupForm`, `PlanWorkspace`, `PlanChat`, `PlanCalendar`).
- Removing SiteFooter or `bg-cosmic`.
- Changing the welcome paragraph (`Welcome, {email}`) or data-fetch `try/catch` blocks.
- Auth, APIs, migrations, RLS, or `PROTECTED_ROUTES`.
- New Vitest or Playwright tests (chrome is source-gated; visual quality is Manual).
- Other pages’ glass cards or gradient titles (privacy, admin, confirm-email).

## Implementation Approach

One markup edit in `dashboard.astro`: swap the card background tokens, solid-white H1, delete the bottom Sign out form. Verify with source greps plus existing lint, unit tests, and build.

## User experience spec

The member must still reach Week (plan + chat) and Profile (setup) from the same card. Sign out remains available from Topbar only. Nested surfaces inside the tabs stay glass so the solid card is the outer chrome, not a restyle of the week/chat/setup UI.

## Phase 1: Solid dashboard card

### Overview

Replace the dashboard card glass and gradient title with the solid-slate treatment already used on auth, and drop the in-card Sign out form.

### Changes Required:

#### 1. Dashboard page chrome

**File**: `src/pages/dashboard.astro`

**Intent**: The dashboard card should match the solid-slate auth cards, the title should read as solid white, and Sign out should exist only in Topbar.

**Contract**: Stay in this file. Do not convert markup to a React island. Do not concatenate class strings.

- On the main card `div`, keep `rounded-2xl border border-white/10 p-6 text-white sm:p-8`. Replace `bg-white/10` with `bg-slate-950`. Remove `backdrop-blur-xl`. The card class string must include `bg-slate-950` and `border-white/10`, and must not include `bg-white/10` or `backdrop-blur`.
- H1 text stays `Dashboard`. Replace `bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-transparent` with `text-white`. Keep existing type scale and spacing (`mb-2`, `text-3xl`, `font-bold`).
- Delete the bottom `<form method="POST" action="/api/auth/signout">` and its Sign out button. After the edit, this file must not contain `/api/auth/signout` or the button label `Sign out`.
- Keep `Layout`, `bg-cosmic`, `<Topbar />`, the welcome paragraph, `<DashboardTabs client:load … />` with the same props, and `<SiteFooter />`. Keep existing data-fetch `try/catch` blocks.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` main card class string includes `bg-slate-950` and `border-white/10`, and includes neither `bg-white/10` nor `backdrop-blur`
- Hero `<h1>` is `Dashboard` and its class list includes `text-white` and does not include `bg-clip-text`, `text-transparent`, or `bg-gradient-to-r`
- `src/pages/dashboard.astro` does not contain `/api/auth/signout` or `Sign out`
- File still imports `Topbar`, `SiteFooter`, and `DashboardTabs`; still has `bg-cosmic` and `<DashboardTabs` with `client:load`
- `src/components/Topbar.astro` still contains `Sign out` and `{user.email}` (file otherwise unchanged)
- `src/components/dashboard/DashboardTabs.tsx` still contains `role="tab"` and still uses `bg-white/10` on the unselected tab; `src/components/dashboard/dashboard-tabs.ts` still lists labels `Week` then `Profile`
- `src/components/plan/PlanChat.tsx` and `src/components/setup/SetupForm.tsx` still contain `bg-white/10`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Signed in at `/dashboard`: main card is solid dark (not frosted glass); H1 is solid white; no Sign out button at the bottom of the card; Topbar still shows email and Sign out; Week/Profile tabs still switch; nested glass on week/chat/setup still looks glass

---

## Testing Strategy

### Unit Tests:

- None new. Dashboard chrome is static Astro markup; existing `npm test` must still pass. Test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6).

### Integration Tests:

- None. `npm run build` loading `dashboard.astro` is the compile check. Do not add Playwright (test-plan §6.3).

### Manual Testing Steps:

1. Sign in, open `/dashboard`.
2. Confirm solid slate card, solid-white H1, no in-card Sign out, Topbar Sign out still works.
3. Switch Week / Profile; confirm nested glass on calendar, chat, and setup is unchanged.

## Performance Considerations

Static SSR markup only; removing one form slightly reduces DOM. No extra islands or client JS.

## Migration Notes

None. No schema, no URL contract. `dashboard-profile-tab` already shipped Week/Profile in this file — chrome edits must not revert the `DashboardTabs` island.

## References

- `context/changes/dashboard-chrome/change.md` — locked Notes
- Sibling (already shipped): `context/changes/dashboard-profile-tab/`
- Card-class precedent: `context/changes/signin-with-nav/plan.md`
- `src/pages/dashboard.astro`
- `src/components/Topbar.astro`
- Test-plan: `context/foundation/test-plan.md` §6.3 / §7

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Solid dashboard card

#### Automated

- [x] 1.1 `src/pages/dashboard.astro` main card class string includes `bg-slate-950` and `border-white/10`, and includes neither `bg-white/10` nor `backdrop-blur` — 457155a
- [x] 1.2 Hero `<h1>` is `Dashboard` and its class list includes `text-white` and does not include `bg-clip-text`, `text-transparent`, or `bg-gradient-to-r` — 457155a
- [x] 1.3 `src/pages/dashboard.astro` does not contain `/api/auth/signout` or `Sign out` — 457155a
- [x] 1.4 File still imports `Topbar`, `SiteFooter`, and `DashboardTabs`; still has `bg-cosmic` and `<DashboardTabs` with `client:load` — 457155a
- [x] 1.5 `src/components/Topbar.astro` still contains `Sign out` and `{user.email}` (file otherwise unchanged) — 457155a
- [x] 1.6 `src/components/dashboard/DashboardTabs.tsx` still contains `role="tab"` and still uses `bg-white/10` on the unselected tab; `src/components/dashboard/dashboard-tabs.ts` still lists labels `Week` then `Profile` — 457155a
- [x] 1.7 `src/components/plan/PlanChat.tsx` and `src/components/setup/SetupForm.tsx` still contain `bg-white/10` — 457155a
- [x] 1.8 `npm test` exits 0 — 457155a
- [x] 1.9 `npm run lint` exits 0 — 457155a
- [x] 1.10 `npm run build` exits 0 — 457155a

#### Manual

- [x] 1.11 Signed in at `/dashboard`: main card is solid dark (not frosted glass); H1 is solid white; no Sign out button at the bottom of the card; Topbar still shows email and Sign out; Week/Profile tabs still switch; nested glass on week/chat/setup still looks glass
