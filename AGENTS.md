# Repository Guidelines

HardFeelings is an Astro 6 SSR app (React 19 islands, Tailwind 4, Supabase auth, Cloudflare Workers) for amateur-runner training plans. Product intent: `@context/foundation/prd.md`. Setup walkthrough: `@README.md`.

## Hard Rules

- Full SSR (`output: "server"` in `@astro.config.mjs`). API routes under `src/pages/api/` must export `const prerender = false`.
- Merge Tailwind classes with `cn()` from `@/lib/utils` — never concatenate class strings.
- Use React islands only when interactivity is required; no Next.js `"use client"` directives. Put shared hooks in `src/components/hooks/`.
- `SUPABASE_URL` / `SUPABASE_KEY` are server-only (`astro:env`); use `.dev.vars` for Cloudflare local, never expose them to the client. See `@.env.example`. Optional `SENTRY_DSN` is a Worker secret (`.dev.vars` / `wrangler secret put`), not `astro:env` — do not ship it to the client. Empty DSN is a no-op. `SENTRY_ENABLED=false` (also `0` / `off` / `no`) turns ingest off even when a DSN is set — local and later pre-prod; unset keeps production ingest on.
- New Supabase tables: migrations in `supabase/migrations/` named `YYYYMMDDHHmmss_short_description.sql`, with RLS enabled and granular per-operation policies.
- Protect pages by adding paths to `PROTECTED_ROUTES` in `@src/middleware.ts`.
- Commit messages: short milestone style (e.g. `After bootstraper`), not Conventional Commits.

## Auth

- `@src/lib/supabase.ts` — Supabase SSR client (`@supabase/ssr`), cookie sessions, `astro:env/server` secrets.
- `@src/middleware.ts` — resolves user onto `context.locals.user`; redirects unauthenticated traffic away from `PROTECTED_ROUTES`.
- Auth API: `@src/pages/api/auth/`
- Auth pages: `@src/pages/auth/`
- Protected example: `@src/pages/dashboard.astro`

## Deployment

- Platform: Cloudflare Workers (not Pages). Production: `https://hard-feelings.ikul.workers.dev`. Auto-deploy: push/merge to GitHub `master` → Workers Builds (not GHA deploy).
- First-ship runbook (done): `@context/deployment/deploy-plan.md`.
- Living deploy/infra backlog: `@context/deployment/deferred.md`. Each task is `DEP-NNN` with **Status**, **Source**, **Added**, **Notes**. When deploy follow-ups appear (from plans, foundation docs, reviews, or chat), **append** a new open task there with a filled **Source** — do not bury them only in chat. Prefer picking an open `DEP-*` over reinventing deferred work.

## Local code reviewer

- Workspace package `packages/code-reviewer/` — independent of the Astro app. Do not put the agent in `src/`.
- Run locally: `git diff | npm run review --workspace=code-reviewer`. Key: `OPENROUTER_API_KEY` in `.dev.vars` (not `astro:env`). The same name is a GitHub Actions secret for `.github/workflows/review.yml` — never add it to `astro:env` or the Worker.
- Five scores are the criteria in `context/changes/code-reviewer/requirements.md`, wired into `packages/code-reviewer/src/schema.ts` and `src/prompt.ts`.
- Promptfoo evals: `npm run eval --workspace=code-reviewer` (local only, costs OpenRouter credits, not a GHA job). Extra agent tools are still out of this package.

## Project Structure

- API handlers under `src/pages/api/` must validate input with zod.
- `src/components/` — Astro for static UI; React under `auth/`; shadcn/ui in `ui/` (new-york, `@components.json`).
- `src/lib/` — helpers and services (`src/lib/services/` for extracted business logic); shared entity/DTO types belong in `src/types.ts`.
- `packages/code-reviewer/` — local OpenRouter review CLI (npm workspace). Not part of the Worker bundle.
- `context/` — PRD, tech stack, and change plans (`@context/foundation/`); deploy backlog under `@context/deployment/`.
- Path aliases: `@tsconfig.json`.

## Build, Test, and Development Commands

Scripts: `@package.json`. Node 22.14.0 per `@.nvmrc`. Local Auth: `npx supabase start` (Docker). Unit tests: Vitest (`npm test`, `npm run test:watch`); config is `@vitest.config.ts` (standalone `vitest/config`, not Astro `getViteConfig`). Browser E2E: `npm run test:e2e` (Playwright, local only — not in CI). Seed: `tests/e2e/seed.spec.ts`. Optional `E2E_EMAIL` / `E2E_PASSWORD`; otherwise setup signs up a fresh local member.

Before writing tests, read `@context/foundation/test-plan.md` §6.

## Coding Style

Formatting and lint: `@.prettierrc.json`, `@eslint.config.js`. Install new shadcn pieces with `npx shadcn@latest add [name]`.

## Commit & Pull Request Guidelines

CI: `@.github/workflows/ci.yml` (build needs `SUPABASE_URL` and `SUPABASE_KEY` repository secrets). PR review: `@.github/workflows/review.yml` (needs `OPENROUTER_API_KEY` as a GitHub Secret, not `astro:env`).
