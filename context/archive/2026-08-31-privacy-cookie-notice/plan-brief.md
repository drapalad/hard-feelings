# Publish a short privacy and cookie notice — Plan Brief

> Full plan: `context/changes/privacy-cookie-notice/plan.md`

## What & Why

DEP-011: the app already sets Supabase SSR session cookies and has no privacy/cookie page. Before real EU/PL users, publish a short notice covering those cookies (purpose, retention, legal basis). No analytics → no CMP. The copy is not legal advice.

## Starting Point

`src/lib/supabase.ts` is the only cookie writer (`createServerClient` getAll/setAll). No footer, no `/privacy`, no tracker. `PROTECTED_ROUTES` is `/dashboard` and `/admin`. Landing and dashboard wrap themselves in `bg-cosmic`; `Layout.astro` does not.

## Desired End State

Public `/privacy` in English, linked from footers on `/` and `/dashboard`, covering strictly necessary session cookies plus a short note on where account/training data lives. DEP-011 Status: done (Done: 2026-08-31). No banner, no new cookies.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | One short combined privacy + cookie page; no CMP / banner / new cookies | LOCKED; DEP-011 | Plan |
| Route | `/privacy` as `src/pages/privacy.astro`, not on `PROTECTED_ROUTES` | Public notice; signed-out readers are the point | Unattended |
| Language | English | Product strings on `/` are English; Banner Polish is starter leftover | Plan |
| Footer placement | `SiteFooter` inside Welcome + dashboard `bg-cosmic` wrappers, not Layout | LOCKED “landing and/or dashboard”; Layout sits outside cosmic chrome | Unattended |
| Auth-page link | Out of this slice | Narrowest locked reading; second path recorded as FU-030 | Unattended |
| Controller identity | “HardFeelings / this website”; no invented company, DPO, or email | Nothing on disk names an operator; FU-031 | Unattended |
| Processors in copy | Supabase + Cloudflare + OpenAI (chat when enabled); cookies named `sb-…-auth-token` | DEP-011 is privacy + cookies, not cookies-only; code already uses those processors | Unattended |
| Retention wording | Until sign-out or session expiry; do not quote hosted max-age | Local `jwt_expiry` is not proof of production cookie TTL | Unattended |
| Legal basis | Performance of a contract; cookies strictly necessary for login | LOCKED asked for legal basis; not legal advice | Unattended |
| Tests | No new Vitest/Playwright; greps + `npm test` / lint / build; 200-without-auth is Manual | Test-plan cost×signal; Node Vitest cannot cheaply hit SSR | Unattended |
| Close DEP-011 | Same phase, Done: 2026-08-31 | LOCKED | Plan |

## Scope

**In scope:** `/privacy` page, `SiteFooter` on landing + dashboard, close DEP-011, FU-030/FU-031.

**Out of scope:** CMP, trackers, new cookies, custom domain, Playwright, Polish translation, FU-011–014, other DEPs, Layout footer, invented legal entity.

## Architecture / Approach

Static SSR Astro page. Shared Astro footer component imported where the cosmic background already lives. Middleware unchanged. Cookie behavior unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Public notice, footer links, close DEP-011 | `/privacy` + footers + DEP-011 done | Accidental Layout footer (broken chrome) or protecting `/privacy` |

**Prerequisites:** none (auth cookies already ship)
**Estimated effort:** one short session, one phase

## Open Risks & Assumptions

- Controller wording is a guess (FU-031). Cookie TTL on hosted Supabase may differ from local `jwt_expiry`; copy stays qualitative.
- Footer-not-on-auth is a defensible alternative (FU-030).
- Copy is transparency, not counsel (stated on the page).

## Success Criteria (Summary)

- Signed-out `/privacy` is readable and not behind login.
- Landing and dashboard link to it.
- DEP-011 is done.
- No banner, no new cookies.
