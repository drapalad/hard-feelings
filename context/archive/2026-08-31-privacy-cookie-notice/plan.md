# Publish a short privacy and cookie notice Implementation Plan

## Overview

Ship a public English privacy & cookie notice covering Supabase SSR session cookies (purpose, retention, legal basis), link it from footers on the landing and dashboard so the URL is not an orphan, and close DEP-011. No CMP, no new cookies, no tracker, no legal-advice claim.

## Current State Analysis

Production is `https://hard-feelings.ikul.workers.dev`. Auth uses `@supabase/ssr` `createServerClient` with cookie `getAll` / `setAll` in `src/lib/supabase.ts`. There are no analytics, advertising, or other optional cookies in `src/`. `PROTECTED_ROUTES` is `["/dashboard", "/admin"]` (`src/middleware.ts`). There is no footer, no `/privacy` page, and no consent banner.

DEP-011 is open: publish a short notice covering auth cookies before real EU/PL users; a full CMP is not required for strictly necessary session cookies alone; do not treat the copy as legal advice.

PRD privacy is a guardrail (“Training data privacy is preserved”) plus NFR isolation (one member’s training data is not visible to others). Product UI strings on `/` are English; Layout’s missing-config Banner is leftover Polish starter copy and is not the product language.

`Layout.astro` only wraps `<slot />` (plus the Banner). Landing (`Welcome.astro`) and dashboard each wrap themselves in `bg-cosmic min-h-screen`. A footer in Layout would render *outside* those wrappers on the default body background.

Local `supabase/config.toml` has `jwt_expiry = 3600`; `[auth.sessions]` timebox is commented out. Hosted project session length is not in this repo.

## Desired End State

A signed-out visitor can open `/privacy` (HTTP 200, not redirected to sign-in) and read a short English notice that states: what the strictly necessary session cookies are for, how long they last, the legal basis, that this is not legal advice, and that we did not add analytics cookies. The same page still makes sense if the hostname is `*.workers.dev` or a later custom domain. `/` and `/dashboard` each show a footer link to that page. DEP-011 is Status: done with Done: 2026-08-31. No consent banner blocks the app. No new cookies or trackers.

### Key Discoveries:

- Cookie adapter is only `src/lib/supabase.ts` (`createServerClient` + `parseCookieHeader` / `cookies.set`); no other cookie writers in app code.
- No footer exists; Topbar is the only chrome shared across landing and dashboard (`src/components/Topbar.astro`).
- Footer cannot live in `Layout.astro` without sitting outside `bg-cosmic` (see Critical Implementation Details).
- `PROTECTED_ROUTES` is the page gate; `/privacy` must stay off that list or signed-out visitors get `/auth/signin`.
- Test-plan Vitest is Node-only (`src/**/*.test.ts`); Playwright is not in this rollout. A 200-without-auth check is human/browser, not a cheap unit test.

## What We're NOT Doing

- Consent / CMP / cookie banner that blocks the app.
- New cookies, analytics, or other trackers.
- Pretending the copy is legal advice, naming a legal entity or DPO we do not have, or writing a full Art. 13 policy (SCCs, transfer mechanisms, request forms).
- Putting `/privacy` on `PROTECTED_ROUTES`.
- React islands for the notice or footer.
- New Supabase tables or migrations.
- Playwright / Vitest HTTP tests of `/privacy`.
- Custom domain (DEP-001), Workers Paid (DEP-002), or other DEP/FU items.
- Editing FU-011 / FU-012 / FU-013 / FU-014.
- Translating product copy to Polish.
- Account self-delete UX, cookie preference center, or changing `src/lib/supabase.ts` cookie behavior.

## Implementation Approach

Add a static SSR Astro page at `src/pages/privacy.astro` and a tiny `SiteFooter.astro` included at the bottom of `Welcome.astro` and `dashboard.astro` (inside each `bg-cosmic` wrapper). Leave middleware unchanged except to verify `/privacy` stays public. Close DEP-011 in the same phase. Record FU-030 / FU-031 for unattended placement and controller-identity choices.

## Critical Implementation Details

**Timing & lifecycle** — omit (static page).

**User experience spec** — Footer must be rendered *inside* each page’s `bg-cosmic` wrapper (`Welcome.astro`, `dashboard.astro`), not in `Layout.astro`. Layout’s slot sits outside those wrappers; a Layout footer would appear as a light bar below the full-viewport cosmic background. The privacy page itself uses the same cosmic + Topbar + card chrome as dashboard so it does not look like a second visual system.

**Performance constraints** — omit.

**State sequencing** — omit.

**Debug & observability** — omit.

## Phase 1: Public notice, footer links, close DEP-011

### Overview

Add `/privacy`, link it from landing and dashboard footers, close DEP-011, and record the two unattended follow-ups.

### Changes Required:

#### 1. Privacy page

**File**: `src/pages/privacy.astro`

**Intent**: Give visitors and members a public, short English notice so session-cookie use is not invisible. Must work signed-out and on the current workers.dev hostname.

**Contract**: Static Astro page (no React island, no `prerender` export). Use `Layout` with `title="Privacy & cookies"`. Visual chrome: `bg-cosmic min-h-screen`, `Topbar`, then a single readable card (`rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl`, `max-w-3xl`) and `SiteFooter` inside the cosmic wrapper. Do not add `/privacy` to `PROTECTED_ROUTES`.

Exact `<h1>` text: `Privacy & cookies`.

Required body (English, implementer may wrap in `<h2>` / `<p>` but must include these facts — do not invent a company name, contact email, or DPO):

1. One-liner that this page is **not legal advice**.
2. **Who** — HardFeelings is a training-plan web app. This notice applies on the hostname in the browser’s address bar (including today’s Cloudflare Worker and a later custom domain).
3. **Cookies — purpose** — Strictly necessary session cookies set by Supabase Auth via the SSR cookie adapter (`createServerClient` in `src/lib/supabase.ts`). Purpose: keep you signed in. Cookie names follow Supabase’s `sb-…-auth-token` pattern (sometimes split into chunks). We do not set analytics, advertising, or other optional cookies, and we did not add a tracker.
4. **Cookies — retention** — Cookies last until you sign out or the auth session expires. Access tokens are short-lived and refreshed while you remain signed in. Do not quote a hosted max-age we cannot see from this repo.
5. **Legal basis** — Providing the account and training-plan service you requested (performance of a contract). These cookies are strictly necessary for that login.
6. **Other data (short)** — Account email and training data (profile weekly km, races, plan units, workout logs, chat) live in Supabase, isolated per member. Cloudflare hosts the app. When chat LLM is enabled, OpenAI may process chat content. No CMP because there are no optional cookies.
7. Link back to `/` (and dashboard is available via Topbar when signed in).

Do not add a consent banner or extra `cookies.set` calls.

#### 2. Shared footer

**File**: `src/components/SiteFooter.astro`

**Intent**: One markup snippet so the notice is discoverable and not an orphan URL.

**Contract**: A `<footer>` with a single link: visible text `Privacy & cookies`, `href="/privacy"`. Style with existing Topbar/link tokens (`text-purple-300`, hover underline) as a single class string — do not concatenate class strings. No React. No extra cookies. No banner.

#### 3. Landing footer

**File**: `src/components/Welcome.astro`

**Intent**: Signed-out visitors on `/` can reach the notice.

**Contract**: Import `SiteFooter` and render it after the feature-card grid, still inside the outer `bg-cosmic` / `relative z-10` wrappers. Do not change hero copy, card titles, or Topbar.

#### 4. Dashboard footer

**File**: `src/pages/dashboard.astro`

**Intent**: Signed-in members can reach the notice without hunting.

**Contract**: Import `SiteFooter` and render it after the sign-out form, still inside the `bg-cosmic min-h-screen` wrapper. Do not change SetupForm / PlanWorkspace behavior.

#### 5. Close DEP-011

**File**: `context/deployment/deferred.md`

**Intent**: The deploy backlog stays honest once the notice is on disk.

**Contract**: Tick DEP-011, set **Status:** done, move the item under `## Done`, add **Done:** 2026-08-31 and a one-line Notes note that `/privacy` covers Supabase SSR session cookies (purpose, retention, legal basis) and is linked from landing and dashboard. Do not edit DEP-001–DEP-010, DEP-012–DEP-015. Do not add DEP-018/DEP-019 unless a new infra leftover appears (none expected).

#### 6. Unattended follow-ups

**File**: `context/backlog.md`

**Intent**: Record the two decisions this run made without a human.

**Contract**: Ensure these two items exist under `## Open` (write them if missing). Do not edit FU-011 / FU-012 / FU-013 / FU-014.

- **FU-030** — Footer on landing + dashboard, not Layout/auth. Kind: decision. Next step: confirm keep SiteFooter on `/` and `/dashboard` only, or `/10x-new privacy-notice-auth-footer` to also link from auth pages (and/or Layout if cosmic wrapping is solved).
- **FU-031** — Controller named as this website / HardFeelings, no legal entity or contact email. Kind: question. Next step: confirm the shipped controller wording, or replace with a real operator name/email in a later copy edit.

### Success Criteria:

#### Automated Verification:

- `src/pages/privacy.astro` exists, has no React `client:` directive, uses Layout, has `<h1>` text `Privacy & cookies`, and contains the phrases `not legal advice`, `strictly necessary`, `Supabase`, `sb-`, `sign out`, and `contract` (case-insensitive)
- `src/middleware.ts` `PROTECTED_ROUTES` does not include `/privacy`
- `src/components/SiteFooter.astro` exists, contains `<footer`, and contains `href="/privacy"` with visible text `Privacy & cookies`
- `src/components/Welcome.astro` and `src/pages/dashboard.astro` each import `SiteFooter` and still contain `bg-cosmic`
- `context/deployment/deferred.md` DEP-011 is Status: done, checkbox ticked, listed under `## Done` with Done: 2026-08-31; DEP-001 heading remains under `## Open`
- `context/backlog.md` FU-030 and FU-031 headings exist with Status: open; FU-011 heading unchanged
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Open `/privacy` signed out in a desktop browser: the page loads (not redirected to sign-in); copy is readable English; no consent banner blocks the app
- On `/` and `/dashboard`, a footer link labeled `Privacy & cookies` navigates to `/privacy`

---

## Testing Strategy

### Unit Tests:

- None new. The page is static Astro markup. Test-plan §1 cost×signal: this is not a risk-map scenario (#1–#6). Existing `npm test` must still pass.

### Integration Tests:

- None. Public access is enforced by *not* listing `/privacy` on `PROTECTED_ROUTES` (Automated grep) plus Manual 200-without-auth in the browser. Node Vitest cannot cheaply fetch SSR pages; Playwright is out of scope.

### Manual Testing Steps:

1. Signed out, open `/privacy` and read purpose, retention, legal basis, and the not-legal-advice line.
2. From `/`, use the footer link; from `/dashboard` (signed in), use the footer link.
3. Confirm no banner overlays the landing, dashboard, or notice.

## Performance Considerations

Static SSR markup only; no extra islands or client JS.

## Migration Notes

No schema or cookie-behavior change. Existing sessions keep working. Closing DEP-011 does not attach a custom domain (DEP-001 stays open).

## References

- `context/deployment/deferred.md` — DEP-011
- `src/lib/supabase.ts` — SSR cookie adapter
- `src/middleware.ts` — `PROTECTED_ROUTES`
- `context/foundation/prd.md` — Guardrail “Training data privacy is preserved”; NFR isolation
- `src/components/Welcome.astro`, `src/pages/dashboard.astro`, `src/layouts/Layout.astro`
- Production: `https://hard-feelings.ikul.workers.dev`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Public notice, footer links, close DEP-011

#### Automated

- [x] 1.1 `src/pages/privacy.astro` exists, has no React `client:` directive, uses Layout, has `<h1>` text `Privacy & cookies`, and contains the phrases `not legal advice`, `strictly necessary`, `Supabase`, `sb-`, `sign out`, and `contract` (case-insensitive) — 59deb02
- [x] 1.2 `src/middleware.ts` `PROTECTED_ROUTES` does not include `/privacy` — 59deb02
- [x] 1.3 `src/components/SiteFooter.astro` exists, contains `<footer`, and contains `href="/privacy"` with visible text `Privacy & cookies` — 59deb02
- [x] 1.4 `src/components/Welcome.astro` and `src/pages/dashboard.astro` each import `SiteFooter` and still contain `bg-cosmic` — 59deb02
- [x] 1.5 `context/deployment/deferred.md` DEP-011 is Status: done, checkbox ticked, listed under `## Done` with Done: 2026-08-31; DEP-001 heading remains under `## Open` — 59deb02
- [x] 1.6 `context/backlog.md` FU-030 and FU-031 headings exist with Status: open; FU-011 heading unchanged — 59deb02
- [x] 1.7 `npm test` exits 0 — 59deb02
- [x] 1.8 `npm run lint` exits 0 — 59deb02
- [x] 1.9 `npm run build` exits 0 — 59deb02

#### Manual

- [ ] 1.10 Open `/privacy` signed out in a desktop browser: the page loads (not redirected to sign-in); copy is readable English; no consent banner blocks the app
- [ ] 1.11 On `/` and `/dashboard`, a footer link labeled `Privacy & cookies` navigates to `/privacy`
