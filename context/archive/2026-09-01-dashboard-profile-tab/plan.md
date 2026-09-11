# Dashboard Week / Profile Tabs Implementation Plan

## Overview

Put athlete setup (weekly km + race calendar) behind a **Profile** tab so `/dashboard` opens on the training week and chat. Today `SetupForm` stacks above `PlanWorkspace`, so the plan sits below the fold.

## Current State Analysis

`src/pages/dashboard.astro` hydrates two `client:load` islands in a `space-y-10` stack: `SetupForm` then `PlanWorkspace`. The glass card (`rounded-2xl border border-white/10 bg-white/10 … backdrop-blur-xl`) and gradient H1 (`bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text`) are owned by `dashboard-chrome` and must not be restyled here. A bottom Sign out form still sits under the stack; Topbar already has Sign out (`dashboard-chrome` will remove the duplicate later).

There is no tab pattern in the app (no `src/components/ui/tabs.tsx`, no `role="tab"`). React islands live under `src/components/setup/` and `src/components/plan/`. Shared hooks belong in `src/components/hooks/`; this slice does not need a shared hook.

Vitest is Node-only (`src/**/*.test.ts`). Component tests that exist (`PlanCalendar.test.ts`) import a pure helper from a `.tsx` file — they do not render React. Playwright is not a suite (`context/foundation/test-plan.md` §6.3). `collapsed-add-race` will later collapse the add-race form **inside** SetupForm; this slice only relocates that form onto Profile.

## Desired End State

A signed-in member opening `/dashboard` sees **Week** selected and `PlanWorkspace` (calendar + chat) without scrolling past setup. **Profile** shows `SetupForm` (weekly km + race calendar) unchanged in behavior. Switching tabs does not restyle the glass card or gradient H1, does not change chat markup or handlers, and does not unmount the week island so in-session week/chat state survives.

### Key Discoveries:

- Two `client:load` islands on one page (`dashboard.astro:73–82`) cannot share tab state; the wrapper must be **one** island that imports both as React children.
- `PlanWorkspace` keeps messages, week navigation, and busy flags in `useState` (`src/components/plan/PlanWorkspace.tsx:140–149`). Unmounting it on Profile would reset that session state — conflicts with “do not change chat.”
- AGENTS.md: React islands only when interactivity is required; merge classes with `cn()`; no `"use client"`.
- Test-plan §6.3: do not add Playwright for this UI move. Node Vitest can lock tab ids/labels/default the same way `formatRevisionLabel` is locked.

## What We're NOT Doing

- Restyling the dashboard glass card, gradient H1, Topbar, or SiteFooter (`dashboard-chrome`).
- Changing `PlanChat` / chat API / Enter-to-send / accept-reject (`plan-chat-ui` and S-03/S-07).
- Collapsing the add-race form (`collapsed-add-race`).
- URL/hash/`?tab=` persistence, shadcn `Tabs`, new Radix packages, jsdom, or Playwright.
- Moving Sign out into Profile, or removing the bottom Sign out form (chrome owns that).
- Auth, APIs, migrations, RLS, or `PROTECTED_ROUTES`.

## Implementation Approach

Extract a tiny tab contract (`week` | `profile`, default `week`, visible labels) for Node tests. Add one React island `DashboardTabs` with a native `tablist` (Week / Profile). Hide the inactive `tabpanel` with the `hidden` attribute so both children stay mounted. Replace the stacked islands in `dashboard.astro` with a single `client:load` wrapper; leave the card, H1, welcome line, and Sign out form untouched.

---

## Phase 1: Tab contract

### Overview

Lock tab ids, default, and labels in a Node-testable module so the island cannot silently rename Week/Profile or default to Profile.

### Changes Required:

#### 1. Tab contract

**File**: `src/components/dashboard/dashboard-tabs.ts` (new)

**Intent**: One source of truth for which tab is default and what the member sees, so the island and the test cannot drift.

**Contract**: Export `DashboardTab` as `"week" | "profile"`. Export `DASHBOARD_TABS` as a two-item list in display order: `{ id: "week", label: "Week" }`, `{ id: "profile", label: "Profile" }`. Export `DEFAULT_DASHBOARD_TAB` as `"week"`. No URL parsing.

#### 2. Unit test

**File**: `src/components/dashboard/dashboard-tabs.test.ts` (new)

**Intent**: Prove default and labels in Node before the island exists, so Phase 2 cannot rename Week/Profile without a red test.

**Contract**: Import from `dashboard-tabs.ts` (not a `.tsx` file). Assert default is `week`, two tabs, labels `Week` and `Profile` in that order. Follow `PlanCalendar.test.ts` (vitest `describe`/`it`, no jsdom).

### Success Criteria:

#### Automated Verification:

- `src/components/dashboard/dashboard-tabs.ts` exports `DEFAULT_DASHBOARD_TAB === "week"` and labels `Week` then `Profile` in that order
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`

---

## Phase 2: Dashboard tab island

### Overview

Hydrate one island that switches Week (`PlanWorkspace`) and Profile (`SetupForm`) without restyling chrome or changing chat.

### Changes Required:

#### 1. Island

**File**: `src/components/dashboard/DashboardTabs.tsx` (new)

**Intent**: Own tab selection in the client so `/dashboard` can show the plan first without a round-trip.

**Contract**:

- Props: `SetupForm`’s `weeklyKm` + `races` plus all `PlanWorkspace` props (`weekStart`, `units`, `logs`, `messages`, `proposition`, `revisions`). Forward them unchanged.
- Initial selected tab is `DEFAULT_DASHBOARD_TAB` (`week`).
- Native ARIA tabs: `role="tablist"` (accessible name e.g. “Dashboard”), `role="tab"` with `aria-selected` / `aria-controls`, matching `role="tabpanel"`. Labels from `DASHBOARD_TABS`.
- Inactive panel uses the `hidden` attribute (keep both children mounted). Do not unmount `PlanWorkspace` or `SetupForm`.
- Tab chrome uses existing glass tokens (`border-white/10`, `bg-white/10`, selected state readable on the cosmic card). Merge classes with `cn()`. Do not add shadcn Tabs or new dependencies.
- Import `SetupForm` and `PlanWorkspace` as React components (not nested Astro islands). No `"use client"`.

#### 2. Page wiring

**File**: `src/pages/dashboard.astro`

**Intent**: Stop stacking setup above the plan; keep SSR data loading and chrome as they are.

**Contract**: Replace the `SetupForm` + `PlanWorkspace` pair and the wrapping `space-y-10` with one `<DashboardTabs client:load … />` passing the same props the page already loads. Do not change the glass card class list, the gradient H1, the welcome paragraph, the bottom Sign out form, Topbar, or SiteFooter. Keep existing data-fetch `try/catch` blocks. Re-run `dashboard-tabs.test.ts` as a regression gate; do not recreate it.

### Success Criteria:

#### Automated Verification:

- `src/pages/dashboard.astro` hydrates exactly one dashboard island (`DashboardTabs` with `client:load`) and does not instantiate `SetupForm` or `PlanWorkspace` as Astro islands
- `DashboardTabs.tsx` renders `role="tab"` controls labeled Week and Profile, default-selects Week, and applies `hidden` to the inactive tabpanel
- Glass card (`bg-white/10`, `backdrop-blur-xl`) and gradient H1 classes on `dashboard.astro` are unchanged
- `PlanChat.tsx` is not modified
- Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts`
- Full suite passes: `npm test`
- Lint passes: `npm run lint`

#### Manual Verification:

- Signed in at `/dashboard`: Week is selected; week calendar + chat are visible without scrolling past weekly-km / race setup
- Profile tab shows weekly km and the race calendar; Week tab returns to the plan
- After chatting or changing week on Week, switching to Profile and back still shows that in-session week/chat state
- Glass card and gradient H1 look as they do today; chat layout and send/accept/reject are unchanged

---

## Testing Strategy

### Unit Tests:

- Tab contract (Phase 1): default `week`, labels `Week` / `Profile`, id order.
- Do not render React; do not import `DashboardTabs.tsx` from the test (would pull `PlanWorkspace` into Node). Phase 2 re-runs the same file as a regression gate.

### Integration Tests:

- None. No API or persist change. Do not add Playwright (test-plan §6.3).

### Manual Testing Steps:

1. Sign in, open `/dashboard`, confirm Week is selected and `PlanWorkspace` is above the fold.
2. Open Profile, confirm weekly km + races; add or save km still works.
3. Return to Week; confirm chat and week navigation from this session are still there.
4. Confirm card glass + gradient title unchanged.

## Performance Considerations

One island instead of two. Both panels stay in the tree (hidden, not unmounted) so Profile’s form state and Week’s chat state survive switches; the extra DOM is the existing setup + week, not a new fetch.

## Migration Notes

None. No schema, no URL contract, no feature flag. Parallel `dashboard-chrome` edits the same `dashboard.astro` chrome classes — do not touch those class strings so the later merge is additive.

## References

- Change notes: `context/changes/dashboard-profile-tab/change.md`
- Sibling (do not implement): `context/changes/collapsed-add-race/change.md`, `context/changes/dashboard-chrome/change.md`
- Current stack: `src/pages/dashboard.astro`
- Island pattern: `src/components/setup/SetupForm.tsx`, `src/components/plan/PlanWorkspace.tsx`
- Test pattern: `src/components/plan/PlanCalendar.test.ts`
- Test-plan: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tab contract

#### Automated

- [x] 1.1 `src/components/dashboard/dashboard-tabs.ts` exports `DEFAULT_DASHBOARD_TAB === "week"` and labels `Week` then `Profile` in that order — 895e9d4
- [x] 1.2 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — 895e9d4
- [x] 1.3 Full suite passes: `npm test` — 895e9d4

### Phase 2: Dashboard tab island

#### Automated

- [x] 2.1 `src/pages/dashboard.astro` hydrates exactly one dashboard island (`DashboardTabs` with `client:load`) and does not instantiate `SetupForm` or `PlanWorkspace` as Astro islands — fb7002c
- [x] 2.2 `DashboardTabs.tsx` renders `role="tab"` controls labeled Week and Profile, default-selects Week, and applies `hidden` to the inactive tabpanel — fb7002c
- [x] 2.3 Glass card (`bg-white/10`, `backdrop-blur-xl`) and gradient H1 classes on `dashboard.astro` are unchanged — fb7002c
- [x] 2.4 `PlanChat.tsx` is not modified — fb7002c
- [x] 2.5 Unit tests pass: `npm test -- src/components/dashboard/dashboard-tabs.test.ts` — fb7002c
- [x] 2.6 Full suite passes: `npm test` — fb7002c
- [x] 2.7 Lint passes: `npm run lint` — fb7002c

#### Manual

- [x] 2.8 Signed in at `/dashboard`: Week is selected; week calendar + chat are visible without scrolling past weekly-km / race setup
- [x] 2.9 Profile tab shows weekly km and the race calendar; Week tab returns to the plan
- [x] 2.10 After chatting or changing week on Week, switching to Profile and back still shows that in-session week/chat state
- [x] 2.11 Glass card and gradient H1 look as they do today; chat layout and send/accept/reject are unchanged — human 2026-09-01: card/H1 restyled by dashboard-chrome; chat unchanged
