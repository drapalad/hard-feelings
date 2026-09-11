# Drop the Welcome source-read unit test Implementation Plan

## Overview

Remove the colocated `Welcome.test.ts` source-read test. Leave Welcome feature-card chrome as shipped. Do not add a replacement unit test. Chrome stays a grep/review check, not CI.

## Current State Analysis

`landing-feature-solid` restyled the three landing feature cards in `src/components/Welcome.astro` to solid `bg-slate-950` (no `backdrop-blur`, no `bg-white/5`) and added `src/components/Welcome.test.ts`. That test `readFileSync`s `Welcome.astro` via `import.meta.dirname` (PlanChat pattern) and asserts card class tokens plus a keep-list (H1, tagline, CTA hrefs, Topbar/SiteFooter imports, grid, titles).

FU-048 recorded that choice against sibling chrome changes (`landing-quiet`, `signin-with-nav`) that used grep-only gates. Human 2026-09-02 promoted FU-048 to this change: drop the test.

`src/lib/test/quality-gates.test.ts` does not name `Welcome.test.ts`. Vitest include is `src/**/*.test.ts`; deleting the file drops it from the suite with no other wiring. No other test file reads `Welcome.astro`. Welcome is static Astro (no React island, no `cn()`). `src/pages/index.astro` is a one-line `Welcome` wrapper. Test-plan §1 cost×signal: this is not risk-map #1–#6. §6.3 forbids Playwright. §7 forbids visual snapshots of layout.

## Desired End State

`src/components/Welcome.test.ts` is gone. No new unit test asserts Welcome chrome. Shipped Welcome markup is unchanged: three solid slate feature cards, quiet H1, tagline, Sign In / Sign Up, Topbar, SiteFooter. Implementer and reviewer prove chrome with source greps; CI does not lock class tokens. `npm test` / `lint` / `build` stay green.

### Key Discoveries:

- The only production-adjacent file that must change is the test: `src/components/Welcome.test.ts` (1934 bytes, two `it` blocks). `Welcome.astro` already matches the keep-list the test encodes.
- `quality-gates.test.ts` PHASE_1_3_TESTS does not include Welcome; no CI YAML, lint-staged path, or import points at this file.
- AGENTS.md `cn()` and no-`"use client"` do not apply: this change deletes a Node Vitest file and does not edit markup.
- Parent plan Automated 1.1–1.4 are already the grep/review keep-list; this change reuses those greps as implementer gates instead of Vitest.

## What We're NOT Doing

- Restyling Welcome cards, H1, tagline, CTAs, Topbar, or footer.
- Adding a replacement unit test, Playwright, visual snapshot, or a `quality-gates.test.ts` lock that the file stays absent.
- Editing `Welcome.astro`, `index.astro`, dashboard, auth, privacy, or admin.
- Rewriting `landing-feature-solid` historical plan/review artifacts.
- Reopening FU-048.
- Schema, API, middleware, or auth changes.

## Implementation Approach

One phase: delete `src/components/Welcome.test.ts`. Prove absence and that Welcome chrome is still the shipped keep-list via implementer greps. Run the repo suite, lint, and build. Do not add tests. Skip the goal-implement deliberate-break check (this phase deletes tests, it does not add or change assertions).

## Critical Implementation Details

This phase only deletes a test file. `/10x-goal-implement` break-check applies to phases that add or change tests — skip it. `npm run build` needs `SUPABASE_URL` / `SUPABASE_KEY` in a worktree `.env` copied from `.env.example` with dummy placeholders; never commit `.env`; never copy env files from another checkout. Do not `npm install`. Do not stage the `node_modules` symlink.

## Phase 1: Delete Welcome.test.ts

### Overview

Remove the colocated source-read test and leave Welcome chrome and the rest of the suite as they are.

### Changes Required:

#### 1. Colocated chrome test

**File**: `src/components/Welcome.test.ts`

**Intent**: Stop locking Welcome class tokens in Vitest. The human does not want this source-read test.

**Contract**: Delete the file. Do not add `src/components/Welcome.test.ts` (or any other `src/**/*.test.ts`) that reads `Welcome.astro`. Do not edit `src/lib/test/quality-gates.test.ts`.

### Success Criteria:

#### Automated Verification:

- `src/components/Welcome.test.ts` does not exist
- No `src/**/*.test.ts` file contains the string `Welcome.astro`
- `src/components/Welcome.astro` contains exactly three `bg-slate-950` tokens; the three feature-card `div` class lists include `rounded-xl`, `border-white/10`, `bg-slate-950`, and `p-6`; the file contains neither `backdrop-blur` nor `bg-white/5`
- Hero `<h1>` is `HardFeelings` with `text-white` and without `bg-gradient-to-r` / `bg-clip-text`; hero `<p>` is exactly `Training plans for amateur runners.`; Sign In / Sign Up hrefs are `/auth/signin` and `/auth/signup`; file still imports `Topbar` and `SiteFooter`; feature grid still includes `sm:grid-cols-3`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff`
- `src/components/Welcome.astro` does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `overflow-hidden`, or `z-10`
- `src/lib/test/quality-gates.test.ts` is unchanged (still does not mention `Welcome.test.ts`)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/` signed out and confirm: the three cards under the hero still look solid slate (not frosted glass); H1, tagline, Sign In / Sign Up, Topbar, and footer are unchanged; no stars, orbs, or gradient title

---

## Testing Strategy

### Unit Tests:

- None added. Delete `src/components/Welcome.test.ts`. Chrome is not a test-plan §2 risk; keep it off CI per locked Notes.

### Integration Tests:

- None. `npm test` must still pass the existing Phase 1–3 floor (`quality-gates.test.ts` unchanged).

### Manual Testing Steps:

1. Open `/` signed out.
2. Confirm the three feature cards still look solid slate, not glass.
3. Confirm hero, CTAs, Topbar, and footer are unchanged.

## Performance Considerations

None. One fewer Node test file. No runtime change.

## Migration Notes

None. Test-only deletion; no schema, cookies, or middleware.

## References

- `context/changes/landing-welcome-no-unit-test/change.md` — locked Notes (FU-048)
- `context/changes/landing-feature-solid/plan.md` — shipped chrome keep-list and the test this change removes
- `src/components/Welcome.astro` — shipped markup (do not edit)
- `src/lib/test/quality-gates.test.ts` — Phase 1–3 floor (do not edit)
- `context/foundation/test-plan.md` §1, §6, §7

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete Welcome.test.ts

#### Automated

- [x] 1.1 `src/components/Welcome.test.ts` does not exist — 1699249
- [x] 1.2 No `src/**/*.test.ts` file contains the string `Welcome.astro` — 1699249
- [x] 1.3 `src/components/Welcome.astro` contains exactly three `bg-slate-950` tokens; the three feature-card `div` class lists include `rounded-xl`, `border-white/10`, `bg-slate-950`, and `p-6`; the file contains neither `backdrop-blur` nor `bg-white/5` — 1699249
- [x] 1.4 Hero `<h1>` is `HardFeelings` with `text-white` and without `bg-gradient-to-r` / `bg-clip-text`; hero `<p>` is exactly `Training plans for amateur runners.`; Sign In / Sign Up hrefs are `/auth/signin` and `/auth/signup`; file still imports `Topbar` and `SiteFooter`; feature grid still includes `sm:grid-cols-3`; the three `<h3>` titles remain `Race priorities A–D`, `Algorithmic generation`, and `Chat with a diff` — 1699249
- [x] 1.5 `src/components/Welcome.astro` does not contain `blur-[120px]`, `blur-[100px]`, `blur-[140px]`, `radial-gradient`, `overflow-hidden`, or `z-10` — 1699249
- [x] 1.6 `src/lib/test/quality-gates.test.ts` is unchanged (still does not mention `Welcome.test.ts`) — 1699249
- [x] 1.7 `npm test` exits 0 — 1699249
- [x] 1.8 `npm run lint` exits 0 — 1699249
- [x] 1.9 `npm run build` exits 0 — 1699249

#### Manual

- [x] 1.10 Open `/` signed out and confirm: the three cards under the hero still look solid slate (not frosted glass); H1, tagline, Sign In / Sign Up, Topbar, and footer are unchanged; no stars, orbs, or gradient title
