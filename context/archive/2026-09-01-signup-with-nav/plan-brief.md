# Sign-up page with the same Topbar as sign-in — Plan Brief

> Full plan: `context/changes/signup-with-nav/plan.md`

## What & Why

`/auth/signup` is a centered solid card on `bg-cosmic` with no site nav, while `/auth/signin` already shows Topbar. This change imports the existing Topbar above the sign-up card and matches sign-in’s cosmic padding so a signed-out visitor sees “Not signed in / Sign in / Sign up” on both auth pages.

## Starting Point

Signup already has the solid `bg-slate-950` card from `signin-with-nav`, but still pads only the inner centering flex and has no Topbar. Topbar already has signed-out copy. `signin.astro` is the chrome template.

## Desired End State

A signed-out visitor on sign-up sees Topbar above the same card, fields, and Create account button as today. Sign-in and Topbar source are untouched. Confirm-email stays without Topbar.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| File scope | `signup.astro` only; leave `confirm-email.astro` without Topbar | LOCKED: file is signup only; confirm-email was never named | Plan |
| Chrome match | Copy sign-in’s outer `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, `<Topbar />` first, inner flex without a second `p-4` | LOCKED: match sign-in chrome; FU-036 already confirmed this padding for the sibling page | Plan |
| Card / fields / button | Do not restyle the card class string, fields, or Create account | LOCKED: chrome only | Plan |
| SignUpForm | Leave validation and the island (`client:load`) unchanged | LOCKED: do not change SignUpForm validation | Plan |
| Duplicate Sign in links | Keep the in-card “Already have an account? Sign in” plus Topbar links | LOCKED: do not restyle the card; Topbar is additional chrome, not a replacement | Plan |
| Signed-in visitor on `/auth/signup` | Reuse Topbar as-is (email / Dashboard / Sign out); no redirect | Notes describe the signed-out visible case; a new auth gate would be middleware, out of scope | Unattended |
| Testing | Colocated source-read Vitest on `signup.astro`; no Playwright; visual is Manual | Orchestrator allowed UI tests; test-plan §6.3 forbids Playwright; sibling `signin-with-nav` used greps only (FU-058) | Unattended |
| Class merging | Static `class=""` tokens copied from sign-in; do not introduce `cn()` | Sibling auth pages do not concatenate; the locked class strings are already complete | Plan |

## Scope

**In scope:** `signup.astro` Topbar + cosmic padding; colocated chrome unit test.

**Out of scope:** `signin.astro` / `Topbar.astro` edits; card/field/button restyle; SignUpForm validation; confirm-email; auth redirect; Playwright; dashboard-nav-current.

## Architecture / Approach

Static Astro markup only. Import the existing island-free Topbar; move padding from the inner centering wrapper to the cosmic root to match sign-in. No new client JS, routes, or `cn()` merges.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Sign-up Topbar chrome | Signup nav matching sign-in + source lock | Inner `p-4` left in place, double-padding the card |

**Prerequisites:** Sign-in already has Topbar (`signin-with-nav` shipped).
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- Source Vitest vs source-grep-only (no new test file) is a defensible split; shipped the test (FU-058).
- Signed-in visitors on `/auth/signup` will see the signed-in Topbar; no redirect is added.

## Success Criteria (Summary)

- Signed-out `/auth/signup` shows Topbar (“Not signed in” + Sign in / Sign up) above the existing `bg-slate-950` card with the same form and Privacy footer.
- `signin.astro`, `Topbar.astro`, and `SignUpForm.tsx` are unchanged.
