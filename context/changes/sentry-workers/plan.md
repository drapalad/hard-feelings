# Wire Sentry on the Cloudflare Worker entry

## Overview

Wrap the Astro 6 Cloudflare Worker fetch handler with Sentry so production exceptions and `console.warn` / `console.error` show up as issues. Empty or missing `SENTRY_DSN` keeps the same code path in no-op. The human still has to put the DSN on the Worker after creating the Sentry project.

## Current State Analysis

- `wrangler.jsonc` `main` is `@astrojs/cloudflare/entrypoints/server`. `nodejs_compat` is already on. Cloudflare `observability.enabled` is log streaming, not error tracking.
- Roadmap Foundations: **Observability: absent**.
- Secrets today: `.dev.vars` locally, `wrangler secret put` in production; `astro:env` covers Supabase/OpenAI only.
- CI (`npm test` / build) must not gain a Playwright or Sentry job. `quality-gates.test.ts` already forbids Playwright in `ci.yml`.

## Desired End State

`wrangler.jsonc` `main` points at `./sentry.server.config.ts`, which exports `Sentry.withSentry(..., astroHandler)`. Production with a DSN reports Worker failures to Sentry. Local/CI without a DSN still boot. Docs tell the operator where to put the secret.

## What We're NOT Doing

- Browser/client Sentry SDK or exposing DSN to the client
- Sentry MCP / source-map upload / release auth token
- Playwright or a CI Sentry job
- Changing product API error mapping (M3L5 #1 found no swallow to fix)
- Putting a real DSN in git

## Implementation Approach

Cloudflare env callback (lesson + current Sentry Astro 6 docs): custom wrangler entry wrapping `@astrojs/cloudflare/entrypoints/server`. Pin the wrap in Vitest so the next agent cannot silently restore the stock `main`. Document DSN; leave production secret as DEP-033 for the human.

## Critical Implementation Details

- **Timing & lifecycle** — `withSentry` must wrap the Worker default export. Pointing wrangler `main` at the generated `dist/server/entry.mjs` skips the wrap.
- **Debug & observability** — `captureConsoleIntegration({ levels: ["warn", "error"] })` is the M3L5 lesson hook. Empty DSN is no-op; do not crash `astro dev` / CI build when unset.

## Phase 1: Worker wrap and pins

### Overview

Install `@sentry/cloudflare` (≥ 10.44), add the entry wrapper, retarget wrangler `main`, pin it in quality-gates, document the secret.

### Changes Required:

#### 1. Sentry Worker entry

**File**: `sentry.server.config.ts`

**Intent**: Own the Worker default export so Sentry wraps every fetch, including SSR and `/api/*`.

**Contract**: Default export is `Sentry.withSentry((env) => ({ dsn: env.SENTRY_DSN || undefined, integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })] }), handler)` where `handler` is the default from `@astrojs/cloudflare/entrypoints/server`. Treat missing/empty DSN as unset.

#### 2. Wrangler entry

**File**: `wrangler.jsonc`

**Intent**: Load that wrapper instead of the stock Astro entry.

**Contract**: `"main": "./sentry.server.config.ts"`. Keep existing `nodejs_compat`, assets, and `observability`.

#### 3. Quality-gates pin

**File**: `src/lib/test/quality-gates.test.ts`

**Intent**: Fail CI if someone reverts wrangler `main` or drops `withSentry`.

**Contract**: Assert `wrangler.jsonc` contains `"./sentry.server.config.ts"`; assert `sentry.server.config.ts` contains `withSentry` and `captureConsoleIntegration`. Do not add Playwright. Do not require `SENTRY_DSN` in `ci.yml`.

#### 4. Operator docs

**Files**: `.env.example`, `README.md`, `AGENTS.md`, `context/foundation/roadmap.md`, `context/deployment/deferred.md`

**Intent**: Tell operators the secret exists; record the production put as DEP-033.

**Contract**: `.env.example` has optional `SENTRY_DSN=`. README runtime-secrets line includes it. AGENTS.md lists it with other `.dev.vars` secrets. Roadmap Observability line notes Worker Sentry (DSN optional). New open `DEP-033` — put `SENTRY_DSN` on the production Worker (and Workers Builds if needed). **Source:** M3L5 OPT / this change.

### Success Criteria:

#### Automated Verification:

- `sentry.server.config.ts` exists and wrangler `main` points at it
- Quality-gates assertions pass: `npm test`
- Typecheck: `npm run typecheck`
- Lint: `npx eslint sentry.server.config.ts wrangler.jsonc src/lib/test/quality-gates.test.ts`
- CI workflow still has no Playwright and no Sentry job

#### Manual Verification:

Omit — DSN smoke is Phase 2.

---

## Phase 2: Production DSN smoke

### Overview

Human creates the Sentry project and sets the Worker secret. Agent does not write the DSN.

### Changes Required:

#### 1. Human secret + one event

**File**: production Worker secrets (not in git)

**Intent**: Live ingest so M3L5 OPT is actually on.

**Contract**: `SENTRY_DSN` on the production Worker. Confirm one issue appears after a `console.error` or a thrown request (operator chooses a throwaway path). Then tick DEP-033 and checklist M3L5 OPT.

### Success Criteria:

#### Manual Verification:

- Production (or local `.dev.vars`) has `SENTRY_DSN`
- One Sentry issue exists for this project
- DEP-033 and checklist M3L5 OPT ticked

## Testing Strategy

### Unit Tests:

- Source pin in `quality-gates.test.ts` (entry path + `withSentry`)

### Manual Testing Steps:

1. Add `SENTRY_DSN` to `.dev.vars` or the Worker
2. Trigger `console.error` or an unhandled throw
3. Confirm the issue in Sentry

## References

- Course: `10-devs/lekcje/m3/m3l5-debugowanie-z-ai-od-stack-trace.md` (Sentry Deep Dive)
- Docs: https://docs.sentry.io/platforms/javascript/guides/cloudflare/frameworks/astro/
- Issue: https://github.com/getsentry/sentry-javascript/issues/19762

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Worker wrap and pins

#### Automated

- [x] 1.1 sentry.server.config.ts exists and wrangler main points at it — c78343e
- [x] 1.2 Quality-gates assertions pass (`npm test`) — c78343e
- [x] 1.3 Typecheck (`npm run typecheck`) — c78343e
- [x] 1.4 Lint on touched TS/JSONC — c78343e
- [x] 1.5 CI workflow still has no Playwright and no Sentry job — c78343e

### Phase 2: Production DSN smoke

#### Manual

- [x] 2.1 Production or local .dev.vars has SENTRY_DSN
- [x] 2.2 One Sentry issue exists for this project
- [x] 2.3 DEP-033 and checklist M3L5 OPT ticked
