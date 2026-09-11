---
bootstrapped_at: 2026-07-29T07:10:15Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: hard-feelings
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: hard-feelings
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
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
```

## Why this stack

HardFeelings is a small after-hours web MVP (12 weeks) with member auth and agent/AI chat on top of algorithmic plan generation. The recommended default for web-app + JavaScript/TypeScript is Astro + React + Supabase + Cloudflare: auth and Postgres ship in the box, TypeScript stays explicit at boundaries, and Cloudflare Pages is the cheapest path to first deploy. Standard path accepted; AI chat will be layered on manually (no registry starter ships an LLM layer first-class). CI is GitHub Actions with auto-deploy on merge to main.

## Pre-scaffold verification

| Signal             | Value                                                              | Severity | Notes                                                                 |
| ------------------ | ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| npm package        | not run                                                            | —        | cmd_template starts with `git clone`; npm package step skipped        |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-05-17T10:33:39Z | fresh    | `gh` unavailable; fetched via GitHub API (`curl`) from card.docs_url |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted

Move log:

- `.env.example`
- `.github`
- `.gitignore`
- `.husky`
- `.nvmrc`
- `.prettierrc.json`
- `.vscode`
- `CLAUDE.md`
- `README.md`
- `astro.config.mjs`
- `components.json`
- `eslint.config.js`
- `node_modules`
- `package-lock.json`
- `package.json`
- `public`
- `src`
- `supabase`
- `tsconfig.json`
- `wrangler.jsonc`

Upstream `.git/` deleted before move-up. cwd `context/`, `.cursor/`, `docs/`, and existing `.git/` preserved.

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 1 CRITICAL, 12 HIGH, 7 MODERATE, 2 LOW
**Direct vs transitive**: 0/1/2/0 direct of total 1/12/7/2 (CRITICAL/HIGH/MODERATE/LOW). Direct HIGH: `astro`. Direct MODERATE: `supabase`, `wrangler`.

#### CRITICAL findings

- **tar** `<=7.5.20` (transitive) — GHSA-vmf3-w455-68vh, GHSA-w8wr-v893-vjvp — fix available

#### HIGH findings

- **astro** `<=7.0.9` (direct) — GHSA-8hv8-536x-4wqp, GHSA-2pvr-wf23-7pc7 — fix available
- **brace-expansion** `<=5.0.7` (transitive) — GHSA-3jxr-9vmj-r5cp — fix available
- **devalue** `5.6.3 - 5.8.0` (transitive) — GHSA-77vg-94rm-hx3p — fix available
- **fast-uri** `3.0.0 - 3.1.3` (transitive) — GHSA-v2hh-gcrm-f6hx, GHSA-4c8g-83qw-93j6 — fix available
- **js-yaml** `4.0.0 - 4.2.0` (transitive) — GHSA-h67p-54hq-rp68, GHSA-52cp-r559-cp3m — fix available
- **miniflare** (transitive via sharp, undici) — fix available
- **postcss** `<=8.5.17` (transitive) — GHSA-r28c-9q8g-f849 — fix available
- **sharp** `<0.35.0` (transitive) — GHSA-f88m-g3jw-g9cj — fix available
- **svgo** `4.0.0 - 4.0.1` (transitive) — GHSA-2p49-hgcm-8545 — fix available
- **undici** `7.0.0 - 7.27.2` (transitive) — GHSA-vmh5-mc38-953g, GHSA-p88m-4jfj-68fv — fix available
- **vite** `7.0.0 - 7.3.3` (transitive) — GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff — fix available
- **ws** `8.0.0 - 8.20.1` (transitive) — GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p — fix available

#### MODERATE findings

- **@astrojs/language-server** `2.14.0 - 2.16.10` (transitive via volar-service-yaml) — fix available
- **@cloudflare/vite-plugin** (transitive via miniflare, wrangler) — fix available
- **supabase** `1.1.6 - 2.98.2` (direct via tar) — fix available
- **volar-service-yaml** `<=0.0.70` (transitive via yaml-language-server) — fix available
- **wrangler** (direct via esbuild, miniflare) — fix available
- **yaml** `2.0.0 - 2.8.2` (transitive) — GHSA-48c2-rrv3-qjmp — fix available
- **yaml-language-server** (transitive via yaml) — fix available

#### LOW / INFO findings

- **@babel/core** `<=7.29.0` (transitive) — GHSA-4x5r-pxfx-6jf8 — fix available
- **esbuild** `0.27.3 - 0.28.0` (transitive) — GHSA-g7r4-m6w7-qqqr — fix available

## Hints recorded but not acted on

| Hint                       | Value                |
| -------------------------- | -------------------- |
| bootstrapper_confidence    | first-class          |
| quality_override           | false                |
| path_taken                 | standard             |
| self_check_answers         | null                 |
| team_size                  | solo                 |
| deployment_target          | cloudflare-pages     |
| ci_provider                | github-actions       |
| ci_default_flow            | auto-deploy-on-merge |
| has_auth                   | true                 |
| has_payments               | false                |
| has_realtime               | false                |
| has_ai                     | true                 |
| has_background_jobs        | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
