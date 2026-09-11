---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "landing-signed-in-cta: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: landing-signed-in-cta

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `Welcome.astro` always renders hero Sign In → `/auth/signin` and Sign Up → `/auth/signup` (`src/components/Welcome.astro:15-26`). It does not read `Astro.locals.user`.
- The same file already imports `Topbar` (`:2`, `:8`). Topbar branches on `Astro.locals.user` (email, Dashboard, Sign out) (`src/components/Topbar.astro:2-34`).
- `/` is not in `PROTECTED_ROUTES` (`src/middleware.ts:6`); signed-in users can hit landing.

## Code References

- `src/components/Welcome.astro:15-26` - hero CTAs
- `src/components/Welcome.astro:2-8` - Topbar import / render
- `src/components/Topbar.astro:2-34` - signed-in Dashboard + Sign out
- `src/middleware.ts:6` - PROTECTED_ROUTES `/dashboard`, `/admin`

## Architecture Insights

Landing is a static Astro page with a Topbar island-less component that already has the user. Hero duplication vs Topbar is the gap. No React island on Welcome.

## Open Questions

- Test harness: no `Welcome` test file found; `Topbar.test.ts` is source-scan only. Cookbook §6.1 is colocated `src/**/*.test.ts` (`context/foundation/test-plan.md:117-119`).
- Footer / auth pages not opened (Notes: do not change).
