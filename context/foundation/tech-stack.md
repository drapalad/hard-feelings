---
starter_id: 10x-astro-starter
package_manager: npm
project_name: hard-feelings
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

HardFeelings is a small after-hours web MVP (12 weeks) with member auth and agent/AI chat on top of algorithmic plan generation. The recommended default for web-app + JavaScript/TypeScript is Astro + React + Supabase + Cloudflare: auth and Postgres ship in the box, TypeScript stays explicit at boundaries, and Cloudflare Workers is the deploy target (Astro 6 SSR via `@astrojs/cloudflare`; Workers Builds on merge to `master`). Standard path accepted; AI chat is a fetch layer on top of gated `proposeAdaptation` (no registry starter ships an LLM layer first-class). CI is GitHub Actions (lint / test / build); production deploys via Workers Builds, not the GHA job.
