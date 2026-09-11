# Current-page Dashboard in Topbar — Plan Brief

> Full plan: `context/changes/dashboard-nav-current/plan.md`

## What & Why

On `/dashboard`, the topbar still links to `/dashboard`, so the current page looks like another destination. This change renders “Dashboard” as white current-page text there, and keeps the purple link everywhere else.

## Starting Point

Signed-in `Topbar.astro` always emits `<a href="/dashboard" class="text-purple-300 …">`. Email is on the left; Sign out and optional Admin on the right. Guests get Sign in / Sign up.

## Desired End State

On `/dashboard` or `/dashboard/`, signed-in “Dashboard” is a `span` (`text-white`, `aria-current="page"`). On other paths it stays the existing purple link. Email and Sign out are unchanged. No wordmark.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Production file | `src/components/Topbar.astro` only | Locked Notes forbid other chrome (H1, tabs, welcome, Sign out, Admin). | Plan |
| Path match | Exact `/dashboard` and `/dashboard/` | Locked; covers `trailingSlash: ignore`; query strings do not change `pathname`. | Plan |
| Current-page markup | `span` + `text-white` + `aria-current="page"` | Locked visible spec; not a self-link. | Plan |
| Off-page markup | Existing purple `<a href="/dashboard">` | Locked: keep the link on every other path. | Plan |
| Guest chrome | No Dashboard control for signed-out users | Today’s guest cluster is Sign in / Sign up; adding Dashboard would widen scope. | Plan |
| Admin current-page | Do not restyle Admin | Locked: do not change Admin. | Plan |
| Tests | Colocated source-read `Topbar.test.ts`, no Playwright | Node Vitest cannot import `.astro`; `PlanChat.test.ts` is the pattern; test-plan §6.3 leaves Playwright unwired. | Plan |
| Helper module | None — keep the boolean in the `.astro` file | A new `.ts` production file would violate the locked file list. | Plan |

## Scope

**In scope:** `Topbar.astro` current-page branch; `Topbar.test.ts` source contract.

**Out of scope:** email removal, wordmark / `/` link, Sign out, Admin, Dashboard H1, tabs, welcome, Playwright, new TS helper.

## Architecture / Approach

SSR-only: `Astro.url.pathname` in the existing Astro component. Signed-in right cluster branches `span` vs `<a>`. Tests read the template source.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Current-page Dashboard in Topbar | Pathname branch + source-contract test | Trailing-slash miss or accidentally dropping email/Sign out |

**Prerequisites:** none (LOCKED Notes + current Topbar).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Source-read tests lock markup strings, not a live DOM — Manual rows cover the browser.
- `/dashboard?tab=…` stays current because `pathname` ignores search (tabs owned by `dashboard-tab-url`).

## Success Criteria (Summary)

- On dashboard paths, “Dashboard” is white current-page text, not a link.
- Off dashboard, the purple Dashboard link remains.
- Email and Sign out are still in the bar; no wordmark.
