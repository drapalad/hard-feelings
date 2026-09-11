---
change_id: sentry-workers
title: Wire Sentry on the Cloudflare Worker entry
status: implemented
created: 2026-09-07
updated: 2026-09-07
archived_at: null
---

## Notes

M3L5 OPT. Wrap the Astro 6 Cloudflare Worker with `@sentry/cloudflare` (`sentry.server.config.ts` as wrangler `main`) so unhandled exceptions and `console.warn`/`console.error` reach Sentry. Server-only `SENTRY_DSN` (Worker secret / `.dev.vars`); empty DSN is no-op. No client SDK, no Playwright, no CI Sentry job. Human verified ingest 2026-09-07 (local + preview smoke issues). Production Worker has `SENTRY_DSN` (DEP-033).
