---
project: hard-feelings
researched_at: 2026-07-29
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare v13
---

## Recommendation

**Deploy on Cloudflare Workers.**

HardFeelings is already wired for this path (`@astrojs/cloudflare` ^13.5, `wrangler` ^4.90, `output: "server"`, Workers-shaped `wrangler.jsonc`). It scored Pass on all five agent-friendly platform criteria, stays near $0 on free tier for light traffic, and fits an after-hours MVP with external Supabase. Interview constraints (cost ≈ DX, no platform preference, single region OK, data layer undecided) do not override that fit. Plan on **Workers Paid (~$5/mo)** once SSR auth + AI chat are live so the free-tier **10ms CPU** hard cap is not a production landmine — Paid defaults to **30s CPU** (configurable to 5 min). LLM wait time via `fetch()` does not count as CPU.

## Platform Comparison

Scored Pass / Partial / Fail against CLI-first ops, managed/serverless, agent-readable docs, stable deploy API, and MCP/integration. Hard filters: none (persistent-connections answer was “Don’t know”; TypeScript/Astro supported on all six). Soft weights: cost ≈ DX; no familiarity tie-break; single region (edge not decisive); external Supabase already assumed.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5 Pass |
| Vercel | Pass | Pass | Pass | Pass | Partial (MCP public beta) | 4 Pass + 1 Partial |
| Netlify | Partial (rollback UI/API) | Pass | Pass | Pass | Pass (GA MCP) | 4 Pass + 1 Partial |
| Render | Partial (no CLI rollback) | Pass | Pass | Pass | Pass | 4 Pass + 1 Partial |
| Railway | Partial (dashboard rollback) | Pass | Pass | Partial | Pass (GA MCP) | 3 Pass + 2 Partial |
| Fly.io | Pass | Pass | Partial (no llms.txt) | Partial (image redeploy) | Partial (experimental MCP) | 2 Pass + 3 Partial |

**Cloudflare** — Wrangler covers deploy / rollback / tail; `llms.txt` + markdown docs; MCP servers GA; free 100k req/day; co-located D1/R2/KV/Queues/Hyperdrive available but unused (Supabase external). Astro adapter v13+ targets **Workers only** (Pages SSR path removed).

**Vercel** — Excellent `@astrojs/vercel` path and CLI; Hobby non-commercial; Pro ~$20/seat for commercial MVP. WebSockets/Queues/MCP beta-marked at research time.

**Netlify** — `@astrojs/netlify` v7, credit-based free tier covers 10k–100k requests if compute stays modest; GA MCP; no WebSockets; 60s sync function timeout; recent Astro v6 adapter edge-case reports.

**Render** — Solid Node always-on escape hatch (~$7–25/mo); WebSockets GA; rollback Dashboard/API; five fixed regions.

**Railway** — Strong DX + GA MCP; always-on ~$10–12/mo; rollback dashboard-only; bind `HOST=0.0.0.0`.

**Fly.io** — Persistent Machines, good for WebSockets later; no permanent free tier; manual image rollback; experimental MCP.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Won on full criteria Pass, lowest MVP cost, and zero adapter migration — the repo already deploys as a Worker with `ASSETS` binding. Best match for agent-driven ops (`wrangler` + docs MCP). Main caveat: free-tier CPU; budget Paid when AI chat + SSR auth ship.

#### 2. Vercel

Runner-up for Astro SSR DX and deterministic CLI deploy/rollback. Loses on commercial base cost (~$20/mo) and beta MCP. Prefer if the team later wants Node-shaped serverless without Workers compat concerns.

#### 3. Netlify

Strong free/credit economics and GA MCP. Trails on first-class CLI rollback and Astro SSR maturity signals vs Cloudflare/Vercel. Prefer if Cloudflare Workers compatibility becomes a blocker and Vercel cost is rejected.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Free-tier 10ms CPU hard cap** — SSR + auth middleware + local validators can exceed 10ms even when LLM I/O does not count; Error 1102 until Workers Paid.
2. **`nodejs_compat` is incomplete** — polyfills, not full Node; AI SDKs or Node-only packages can pass `astro dev` checks and fail in production.
3. **Astro + `nodejs_compat` middleware streaming bug** — can return `[object Object]` without `disable_nodejs_process_v2` or a sufficiently recent compatibility story (project currently sets `nodejs_compat` only).
4. **Remote Supabase from the edge** — auth and chat add latency and connection-pattern pitfalls; Hyperdrive is available but unused.
5. **Runtime lock-in** — Workers APIs and limits diverge from Node; leaving later means `@astrojs/node` + re-validating SSR/auth/chat.

### Pre-Mortem — How This Could Fail

The team shipped on Workers because the starter already pointed there and free traffic looked perfect. Light dashboard hits were fine. AI chat then combined cookie refresh, Supabase round-trips, and streamed LLM calls. Free-tier CPU errors appeared first on cold SSR paths, not during LLM wait. They upgraded to Paid without measuring CPU, then hit a second wall when an AI SDK needed a Node API only partially covered by `nodejs_compat`. Secrets drifted between `.dev.vars` and Wrangler secrets; a bad `wrangler secret put` took production offline during a demo. Six months later the “zero-ops” choice had become isolate archaeology, and a mid-project move to Node on Render looked cheaper than continuing to paper over limits.

### Unknown Unknowns

- **`@astrojs/cloudflare` v13+ dropped Pages for SSR** — deploy target is Workers only; “Cloudflare Pages” tutorials and the tech-stack hint `deployment_target: cloudflare-pages` are outdated relative to this codebase.
- **`astro dev` already uses `workerd`** — a separate `wrangler dev` loop is often redundant unless you need bindings not available in the Astro Vite plugin path.
- **Per-environment deploys** need `CLOUDFLARE_ENV=... astro build` before `wrangler deploy` — build-time env, not deploy-time `--env` alone.
- **AI streaming is wall-clock friendly** on Workers; free-tier CPU and subrequest limits bite SSR/auth/compute harder than the LLM wait itself.
- Prefer `import { env } from 'cloudflare:workers'` for bindings — `Astro.locals.runtime` is gone in Astro 6.

## Operational Story

- **Preview deploys**: Git-connected Workers Builds or Wrangler versions/previews for branch builds; fork PRs need care with secrets. Protect non-public previews with Cloudflare Access if the app shows member training data. Current GitHub Actions CI (`ci.yml`) runs lint + build only — no auto-deploy yet.
- **Secrets**: Local: `.dev.vars` (from `.env.example`). Production: `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (or dashboard). Treat as server-only (`astro:env`); rotate by re-putting secrets and redeploying. GitHub repo secrets used for CI build only.
- **Rollback**: `npx wrangler rollback [VERSION_ID]` for instant traffic revert to a prior Worker version. Does **not** roll back Supabase migrations or Auth config — reverse those separately.
- **Approval**: Human required for production publish credentials, secret rotation, billing upgrade to Workers Paid, and domain/DNS changes. Agent may run build, lint, non-prod deploy, and read-only log tails when authenticated.
- **Logs**: `npx wrangler tail` for live invocation logs; dashboard Workers Metrics for CPU/errors (watch `exceededCpu`); optional Workers Logs / Logpush. CI logs via GitHub Actions.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Free-tier 10ms CPU exceeded by SSR + auth | Devil's advocate / Research | H | M | Upgrade to Workers Paid (~$5/mo) before/when AI chat + heavy SSR ship; monitor CPU in `wrangler tail` / Metrics |
| `nodejs_compat` gaps break AI SDK or Node packages | Devil's advocate / Pre-mortem | M | H | Prefer `fetch`-based LLM clients; verify packages on `workerd`; keep Render/Vercel as escape hatch |
| Middleware streaming `[object Object]` under `nodejs_compat` | Research finding | M | M | Track Astro #15434; add `disable_nodejs_process_v2` or adjust `compatibility_date` if hit |
| Secret drift / botched production secret | Pre-mortem | M | H | Document Wrangler-only prod secrets; avoid mixing CI env with runtime secrets; dual-person check on rotate |
| Docs/stack still say “Pages” while code is Workers | Unknown unknowns | H | L | Treat Workers as canonical; update `tech-stack.md` hint when next editing foundation docs |
| Edge ↔ Supabase latency under chat load | Devil's advocate | M | M | Use Supabase HTTP APIs; consider Hyperdrive only if adding direct Postgres; keep chat streaming |
| Vendor lock-in to Workers runtime | Devil's advocate | L | M | Keep business logic adapter-agnostic; `@astrojs/node` path remains viable on Render/Railway |

## Getting Started

Project already has the adapter and Wrangler config. First deploy steps for **this** stack (Astro ^6.3, `@astrojs/cloudflare` ^13.5, `wrangler` ^4.90):

1. Create a Cloudflare account and log in locally: `npx wrangler login`
2. Ensure local secrets exist: `cp .env.example .dev.vars` and fill `SUPABASE_URL` / `SUPABASE_KEY` (local Supabase or hosted project)
3. Develop with the Workers-faithful loop already scripted: `npm run dev` (Astro 6 + Cloudflare adapter → `workerd`). Use `npm run build && npx wrangler dev` only when you need a production-like Wrangler preview
4. First production push: `npm run build && npx wrangler deploy`, then set prod secrets: `npx wrangler secret put SUPABASE_URL` and `npx wrangler secret put SUPABASE_KEY`
5. When SSR auth + AI chat are real, enable **Workers Paid** and optionally set `"limits": { "cpu_ms": 30000 }` (or higher) in `wrangler.jsonc`. Rename the Worker `name` in `wrangler.jsonc` from the starter default (`10x-astro-starter`) to `hard-feelings` before public launch

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (beyond noting current lint/build-only GitHub Actions)
- Production-scale architecture (multi-region, HA, DR)
