---
date: 2026-09-09T09:38:59+00:00
researcher: Dawid Drapala
git_commit: e01f12a4aa7d2970dedb10103a80354ef0b7f6c6
branch: master
repository: drapalad/hard-feelings
topic: "CI/CD code review based on context/changes/ci-cd-code-review/requirements.md"
tags: [research, codebase, github-actions, code-reviewer, openrouter]
status: complete
last_updated: 2026-09-09
last_updated_by: Dawid Drapala
---

# Research: CI/CD code review workflow

**Date**: 2026-09-09T09:38:59+00:00
**Researcher**: Dawid Drapala
**Git Commit**: e01f12a4aa7d2970dedb10103a80354ef0b7f6c6
**Branch**: master
**Repository**: drapalad/hard-feelings

## Research Question

`/10x-research ci-cd-code-review based on requirements from '@context/changes/ci-cd-code-review/requirements.md'`

How should HardFeelings wire the existing `packages/code-reviewer` agent into GitHub Actions as a composite action + PR workflow, without copying the Claude Code Action template and without merge-blocking on a `fail` verdict?

## Summary

The agent is already an npm workspace (`code-reviewer`). Root `npm ci` installs it; **nothing in CI runs it**. The only workflow is [`.github/workflows/ci.yml`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/.github/workflows/ci.yml) (lint / test / build, `SUPABASE_*` on build only). There is no `.github/actions/` yet.

The CLI contract is stdin diff → stdout JSON (`criteria`, `verdict`, `summary`). `verdict: "fail"` still exits 0 — only empty stdin, missing `OPENROUTER_API_KEY`, or a thrown error fail the process. That matches Champion: comment + labels, **no merge gate**.

PR title/description are **not** in the agent API. Requirements already skip description in MVP; do not extend the prompt in this change.

Steal from the Claude template only: `fetch-depth: 0`, `permissions: pull-requests: write`, checkout of PR head, `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Do not copy `anthropics/claude-code-action`, Anthropic keys, `impl-review` label gate, commit-back, `[skip ci]` loops, `statuses: write`, pnpm, or skill staging.

Public repo: fork PRs do not get `OPENROUTER_API_KEY` and cannot write comments with the default token. Gate the job to same-repo heads.

## Detailed Findings

### Existing CI

- Single job `ci` on `ubuntu-latest`, Node 22, `npm ci` → `astro sync` → lint → test → build. Secrets only on build: `SUPABASE_URL`, `SUPABASE_KEY` ([`ci.yml:1-25`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/.github/workflows/ci.yml#L1-L25)).
- No `permissions:` block, no `workflow_dispatch`, no `jq`, no PR comments.
- Archive notes about “keep one `ci` job” were about **not putting Playwright/Sentry into that job**, not a ban on a second AI-review workflow. This change’s requirements explicitly want a **separate** workflow.

### code-reviewer package

- Invoke: `git diff | npm run review --workspace=code-reviewer` ([`AGENTS.md:32`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/AGENTS.md#L32)).
- Workspace name `code-reviewer`; engines `node >= 22.14.0`; `tsx` is a **devDependency** of the package — root `npm ci` is enough.
- CLI: [`packages/code-reviewer/src/index.ts:3-33`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/packages/code-reviewer/src/index.ts#L3-L33). JSON on stdout; errors on stderr + `exitCode = 1`.
- Schema fields: `tenantIsolation`, `hardBoundsOnAccept`, `astroIslandConventions`, `trustedApiSurface`, `namedRiskTests`, `verdict`, `summary` ([`schema.ts:7-35`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/packages/code-reviewer/src/schema.ts#L7-L35)).
- `reviewDiff` is importable (`package.json` `exports`) but CI should keep the **CLI pipe** — same path as local proof.
- `loadLocalEnv()` is CLI-only and does **not** override existing `process.env` ([`load-env.ts:36-42`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/packages/code-reviewer/src/load-env.ts#L36-L42)). Actions should inject `OPENROUTER_API_KEY`; do not upload `.dev.vars`.
- `maxOutputTokens: 2048` ([`agent.ts:27`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/packages/code-reviewer/src/agent.ts#L27)).
- Root `tsconfig.json` excludes `packages` — Worker bundle will not pick this up. `OPENROUTER_*` is **not** in `astro.config.mjs` `env.schema`.

### Secrets

- `.env.example` marks `OPENROUTER_API_KEY` as CLI-only, not `astro:env`, not for the Worker.
- CI today documents only `SUPABASE_*` repository secrets (`AGENTS.md` / README). The review workflow needs a **new** repo secret `OPENROUTER_API_KEY`.
- Review workflow must **not** need `SUPABASE_*` (no Astro build).

### Claude template vs Champion A

Template: [`.cursor/skills/10x-impl-review-ci/references/workflow-template.yml`](https://github.com/drapalad/hard-feelings/blob/e01f12a4aa7d2970dedb10103a80354ef0b7f6c6/.cursor/skills/10x-impl-review-ci/references/workflow-template.yml).

Keep as ideas: `fetch-depth: 0` (lines 59–63), `pull-requests: write` (52–54), optional concurrency (48–50), checkout PR head (64–65), `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (128–129).

Must not copy: `anthropics/claude-code-action`, `ANTHROPIC_API_KEY`, `impl-review` label gate, contents-write + commit-back, `[skip ci]` recursion, `statuses: write`, pnpm, staging `~/.claude/skills`.

Champion lock: [`workspace/10xdevs-cert/champion/checklist.md`](file:///home/ikul/projects/workspace/10xdevs-cert/champion/checklist.md) §5; local copy of the contract is `context/changes/ci-cd-code-review/requirements.md`.

### PR comment / labels

- `ubuntu-latest` includes `jq`; this repo’s workflows do not use it yet.
- Parse: `jq -r '.summary'` / `jq -r '.verdict'` from captured stdout.
- `gh pr comment`, `gh label create --force`, `gh pr edit --add-label` / remove the opposite `ai-cr:*` label.
- Job **fails** only on empty diff, missing key, or agent crash. Job **succeeds** on `verdict: fail` after posting `ai-cr:failed`.

### Forks

Repo is public (`drapalad/hard-feelings`). Fork PR runs do not receive repository secrets; `GITHUB_TOKEN` is read-only toward the base. MVP: `if: github.event.pull_request.head.repo.full_name == github.repository` (skip forks). Do not use `pull_request_target`.

## Code References

- `.github/workflows/ci.yml:1-25` — only existing workflow; lint/test/build
- `package.json:5-7` — `"workspaces": ["packages/*"]`
- `packages/code-reviewer/package.json:9-16` — `review` script + exports
- `packages/code-reviewer/src/index.ts:16-33` — stdin CLI, stdout JSON, stderr errors
- `packages/code-reviewer/src/agent.ts:13-44` — OpenRouter, `safeParse`, `maxOutputTokens`
- `packages/code-reviewer/src/schema.ts:7-35` — five HF scores + verdict + summary
- `packages/code-reviewer/src/prompt.ts:35-37` — user prompt is diff-only
- `tsconfig.json:1-4` — `exclude: ["dist", "packages"]`
- `astro.config.mjs` env schema — no `OPENROUTER_*`
- `.env.example:6-10` — OPENROUTER is CLI-only
- `.cursor/skills/10x-impl-review-ci/references/workflow-template.yml` — do not copy as the runner

## Architecture Insights

- Two workflows, two secrets domains: `ci.yml` = app quality + `SUPABASE_*`; `review.yml` = LLM review + `OPENROUTER_API_KEY`. Mixing them would either leak OpenRouter into the Worker story or force a useless Astro build on every review.
- Composite action owns: install, diff, review, parse, comment, labels. Workflow owns: triggers, permissions, secret plumbing, fork skip.
- Three-dot `git diff origin/${base}...HEAD` is the PR-shaped diff (merge-base…head). Shallow clone without `fetch-depth: 0` yields an empty diff and a failed job (CLI empty-stdin path).
- `tools: {}` stays. Comment is YAML `gh`, not an agent tool (that would be M5L3 #4).

## Historical Context (from prior changes)

- `context/changes/code-reviewer/plan.md` — M5L2 locked: independent package, no GHA, key not `astro:env`.
- `context/changes/code-reviewer/requirements.md` — five criteria; side-effects comment + labels; retry later.
- `context/archive/**` quality-gates reviews — “one `ci` job” means do not add Playwright/Sentry to lint/test/build, not “never add another workflow”.

## Related Research

- None under `context/changes/*/research.md` for GHA review. This is the first.

## Open Questions

None that block the plan. Locked by requirements + Champion §5:

- Skip PR description in MVP (and skip title — agent cannot accept it without a package change).
- No merge gate, no `ai-cr:review` retry, no promptfoo, no extra tools.
- Same-repo PRs only for the demo path.
