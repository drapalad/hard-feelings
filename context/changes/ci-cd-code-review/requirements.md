# CI/CD code review (HardFeelings)

M5L3 CI. Binding criteria stay in `context/changes/code-reviewer/requirements.md`. This file is the workflow contract.

## Overall concept

- GitHub Actions workflow on every pull request to `master`, plus `workflow_dispatch`.
- Composite action for the review itself so the main workflow stays thin.
- The action runs **our** `packages/code-reviewer` agent (OpenRouter + Zod scores). Do not drop in `.cursor/skills/10x-impl-review-ci/references/workflow-template.yml` (Claude Code Action / Anthropic). That template is a later OPT harness, not Champion A.

## Input parameters

- pull request title
- pull request description (optional — cost tradeoff; **skip in MVP**)
- git diff vs `origin/${{ github.base_ref }}` (`actions/checkout` with `fetch-depth: 0`; a shallow clone yields an empty diff)
- `OPENROUTER_API_KEY` from GitHub Secrets (never commit; never `astro:env`)

## Code Review Criteria

Exactly the five scores already wired into `packages/code-reviewer/src/schema.ts`. Do not add a sixth.

1) **Tenant isolation**
2) **Hard bounds on Accept**
3) **Astro / island conventions**
4) **Trusted API surface**
5) **Named-risk tests**

Parked (do not score, do not fail the job on them): business alignment, architectural fit.

## Expected side-effects

- PR comment with the agent's `summary` (MVP: `gh pr comment`, not an agent tool)
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green), matching `verdict`

## Expected behavior

- on-demand retry when label `ai-cr:review` is added — **later, not this change**
- merge gate on `fail` — **not in MVP** (comment + labels are enough for Champion screenshots)
- existing `.github/workflows/ci.yml` (lint/test/build) stays green and unchanged in behavior

## Out of this change

- promptfoo / model matrix (M5L3 #3, separate change)
- extra agent tools (`tools: {}` stays)
- merge-blocking check
- retry-on-label
