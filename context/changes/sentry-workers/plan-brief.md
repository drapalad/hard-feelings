# Wire Sentry on the Cloudflare Worker entry — Plan Brief

> Full plan: `context/changes/sentry-workers/plan.md`

## What & Why

M3L5 OPT: production errors should show up without grepping `wrangler tail`. Wrap the Worker fetch handler with Sentry so unhandled exceptions and console warn/error become issues.

## Starting Point

Astro 6 on Cloudflare Workers; wrangler `main` is the stock adapter entry. Cloudflare observability logs are on; no error tracker. Secrets live in `.dev.vars` / `wrangler secret put`.

## Desired End State

Same app, with `sentry.server.config.ts` as the Worker entry. DSN from Worker env; empty means no-op. Operator still pastes DSN once the Sentry project exists.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Entry | Custom wrangler `main` → `sentry.server.config.ts` | Astro 6 + adapter 13 does not wrap the stock entry | User / docs |
| SDK | `@sentry/cloudflare` only (`withSentry`) | Lesson lists `@sentry/astro` too; client SDK and source maps are out of scope | Plan |
| Console | `captureConsoleIntegration` warn+error | M3L5 lesson hook for swallowed `console.warn` | Course |
| DSN | Server/Worker secret, not `astro:env` client | Must not ship to the browser | User |
| Missing DSN | No-op, do not crash | Local and CI have no Sentry project | Course |
| CI | No Sentry job; pin wrap in quality-gates | Same floor as “no Playwright in CI” | Plan |

## Scope

**In scope:** Worker wrap, wrangler `main`, quality-gates pin, docs, DEP-033.

**Out of scope:** Client SDK, MCP, source maps, Playwright, inventing a swallow, committing a DSN.

## Architecture / Approach

`withSentry(env => ({ dsn, captureConsoleIntegration }), astroCloudflareHandler)` is the Worker default export. Runtime reads `env.SENTRY_DSN`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Worker wrap and pins | Code + docs; works with empty DSN | Wrong `main` → Sentry never inits |
| 2. Production DSN smoke | Human secret + one issue | Secret never set, wrap is dead |

**Prerequisites:** Sentry account (human, in parallel). Local wrap does not need it.
**Estimated effort:** one wiring session + a few minutes after DSN exists.

## Open Risks & Assumptions

- Empty DSN stays no-op on current `@sentry/cloudflare` (≥ 10.44).
- Workers Builds must receive the same runtime secret as `wrangler secret put`.

## Success Criteria (Summary)

- Wrangler boots through the Sentry wrap
- CI still has no Playwright/Sentry job
- After DSN: one real issue in the Sentry project
