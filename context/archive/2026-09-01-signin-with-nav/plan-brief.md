# Sign-in page with site topbar and solid card — Plan Brief

> Full plan: `context/changes/signin-with-nav/plan.md`

## What & Why

`/auth/signin` is a glass card on `bg-cosmic` with no site nav, while landing and privacy already show Topbar. This change imports the existing Topbar above the sign-in card and swaps the card from `bg-white/10` + blur to solid `bg-slate-950`, keeping the form, H1, Privacy footer, and cosmic background.

## Starting Point

Sign-in and sign-up share one glass card class string. Topbar already has signed-out copy (“Not signed in” + Sign in / Sign up) and is used on Welcome and privacy. No tests assert auth-page chrome.

## Desired End State

A signed-out visitor on sign-in sees Topbar above a solid dark card, with the same form and footer as today. Sign-up’s card uses the same two classes but still has no Topbar. Topbar itself is untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Sign-up scope | Copy the two card classes onto `signup.astro`; do not add Topbar there | LOCKED DECISIONS: signup is out of scope unless those two classes are trivial — the class string is identical | Plan |
| Topbar placement | Full-width bar at the top of the cosmic column with `p-4 sm:p-8`, not constrained to `max-w-sm` | Matches Welcome/privacy/dashboard padding so the bar is not flush to the viewport or squeezed to card width | Unattended |
| Signed-in visitor on `/auth/signin` | Reuse Topbar as-is (email / Dashboard / Sign out); no redirect | LOCKED: do not restyle Topbar; notes describe the signed-out case, not a new auth gate | Plan |
| Duplicate Sign up links | Keep the in-card “Don't have an account? Sign up” plus Topbar links | LOCKED: keep form fields and existing card copy; Topbar is additional chrome, not a replacement | Plan |
| H1 and inner fields | Keep gradient H1 and FormField glass; do not restyle inputs | LOCKED: keep H1 and form fields; only the outer card drops glass | Plan |
| Testing | No new Vitest/Playwright; source greps + lint/test/build; visual is Manual | Test-plan §1 cost×signal — not a risk-map item; same pattern as landing-product-copy | Plan |
| confirm-email | Leave glass, no Topbar | Not named in LOCKED DECISIONS; adding it would widen the slice | Plan |

## Scope

**In scope:** `signin.astro` Topbar + solid card; trivial two-class copy on `signup.astro`.

**Out of scope:** Topbar restyle; Topbar on signup/confirm-email; form logic; H1 restyle; dashboard/landing/privacy; new tests; auth API/middleware.

## Architecture / Approach

Static Astro markup only. Import the existing Topbar island-free component; replace two Tailwind tokens on the card `div`. No new client JS, routes, or `cn()` merges.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Topbar and solid auth cards | Sign-in nav + solid cards on sign-in and sign-up | Topbar flush or card-width if padding/width is wrong |

**Prerequisites:** Existing Topbar and auth pages on disk (already shipped).
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- Topbar full-width + `p-4 sm:p-8` is the natural reading vs a bar stacked inside `max-w-sm` (FU-036; was FU-032 in this run, remapped on merge).
- Sign-up without Topbar will look one chrome step behind sign-in until a later change if anyone wants parity.

## Success Criteria (Summary)

- Signed-out `/auth/signin` shows Topbar (“Not signed in” + Sign in / Sign up) above a `bg-slate-950` card with the same form and Privacy footer.
- Sign-up card uses the same two classes; Topbar.astro is unchanged.
