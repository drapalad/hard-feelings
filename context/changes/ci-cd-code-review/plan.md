---
status: planned
created: 2026-09-09
updated: 2026-09-09
---

# CI/CD code review Implementation Plan

## Overview

Add a second GitHub Actions workflow that runs `packages/code-reviewer` on every same-repo pull request to `master`, posts the agent's `summary` as a PR comment, and sets `ai-cr:passed` or `ai-cr:failed`. Existing `ci.yml` (lint/test/build) stays as-is.

## Current State Analysis

Only workflow is `.github/workflows/ci.yml` (Node 22, `npm ci`, lint/test/build, `SUPABASE_*` on build). Root `npm ci` already installs the `code-reviewer` workspace; CI never invokes it. The CLI prints Zod JSON on stdout and exits 0 even when `verdict` is `fail`. PR title is not in the agent API. No composite actions exist. `OPENROUTER_API_KEY` is a local `.dev.vars` key only.

## Desired End State

A thin `.github/workflows/review.yml` calls `.github/actions/ai-reviewer`. On a same-repo PR to `master` the job checks out with full history, diffs against `origin/${{ github.base_ref }}`, pipes the diff into `npm run review --workspace=code-reviewer` with `OPENROUTER_API_KEY` from Secrets, comments `summary`, and applies exactly one of `ai-cr:passed` / `ai-cr:failed`. A `fail` verdict does not fail the check. Fork PRs are skipped. `ci.yml` still does not mention OpenRouter.

### Key Discoveries:

- CLI contract is stdin → stdout JSON; `verdict: fail` is still exit 0 (`packages/code-reviewer/src/index.ts:16-33`).
- Shallow checkout yields empty diff → CLI exit 1 (`fetch-depth: 0` is load-bearing).
- Claude Code Action template is the wrong runner; reuse only checkout depth, PR write permission, and `GH_TOKEN`.
- Review job must not run `astro build` (would pull `SUPABASE_*` and mix secret domains).

## What We're NOT Doing

- Claude Code Action / `ANTHROPIC_API_KEY` / `10x-impl-review-ci` as the runner
- Passing PR title or body into the agent (description skipped; title needs a package change)
- Merge-blocking on `verdict: fail`
- Retry on label `ai-cr:review`
- Extra agent tools (`tools: {}` stays)
- promptfoo
- `pull_request_target`
- Changing `ci.yml` behavior
- Putting `OPENROUTER_*` on `astro:env` or the Worker

## Implementation Approach

Two files plus docs. The composite action owns install, diff, review, parse, comment, and labels. The workflow owns triggers, permissions, fork skip, and secret plumbing. Follow `ci.yml` toolchain (npm, Node 22), not the template's pnpm/Claude block.

## Critical Implementation Details

- Compute the diff with three-dot `git diff "origin/${base_ref}...HEAD"` after `fetch-depth: 0`. Two-dot from a shallow clone is how you get an empty stdin and a red job that never reviewed anything.
- Capture reviewer **stdout** only (JSON). Do not `set -e` on `verdict=fail`. Fail the step only if the `review` process exits non-zero.
- Export `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on steps that run `gh`. Pass `OPENROUTER_API_KEY` as action input from `secrets.OPENROUTER_API_KEY` — never echo it.

## Phase 1: Composite action and thin workflow

### Overview

Scaffold `.github/actions/ai-reviewer/action.yml` and `.github/workflows/review.yml` so a same-repo PR run installs deps, produces a diff, runs the reviewer, and exposes `verdict` / `summary` as action outputs.

### Changes Required:

#### 1. Composite action

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: One reusable action that turns a PR (or dispatch) into a review JSON using the existing CLI.

**Contract**: `runs: using: composite`. Inputs: `pr-number`, `base-ref`, `openrouter-api-key`. Outputs: `verdict`, `summary`. Steps: setup-node 22 + cache npm, `npm ci` at repo root, `git fetch` base if needed, `git diff origin/${base-ref}...HEAD` piped to `npm run review --workspace=code-reviewer` with `OPENROUTER_API_KEY` from the input, write JSON to a file, `jq` into outputs. No Astro build. No Anthropic.

#### 2. Review workflow

**File**: `.github/workflows/review.yml`

**Intent**: Thin trigger file. Do not duplicate install/review logic here.

**Contract**: `on.pull_request` to `master` (opened/synchronize/reopened) and `workflow_dispatch` with a `pr-number` input. Job `if:` same-repo head (`github.event.pull_request.head.repo.full_name == github.repository`) on `pull_request`; for dispatch, document same-repo only. `permissions: contents: read`, `pull-requests: write`. `actions/checkout@v4` with `fetch-depth: 0` (and `ref` = PR head on `pull_request`). Then `uses: ./.github/actions/ai-reviewer` with secrets. Optional concurrency group per PR number, cancel in progress. Do not add this workflow as a required status.

#### 3. Leave existing CI alone

**File**: `.github/workflows/ci.yml`

**Intent**: Lint/test/build stays the quality gate; it must not grow an OpenRouter step.

**Contract**: No edits unless a drive-by is required to keep YAML valid (prefer zero edits).

### Success Criteria:

#### Automated Verification:

- `.github/actions/ai-reviewer/action.yml` exists and is a composite action
- `.github/workflows/review.yml` exists, triggers on PR to `master` + `workflow_dispatch`, and does not reference `anthropics/claude-code-action` or `ANTHROPIC_API_KEY`
- `.github/workflows/ci.yml` still only lint/test/build with `SUPABASE_*` on build
- `grep -R OPENROUTER .github/workflows/ci.yml` is empty
- Root `npm test`, `npm run lint`, and `npx astro check` still pass

---

## Phase 2: Comment, labels, fork skip, docs

### Overview

Post `summary` with `gh pr comment`, set mutually exclusive `ai-cr:*` labels from `verdict`, skip forks, and point AGENTS/README at the new secret and workflow.

### Changes Required:

#### 1. Comment and labels inside the composite (or a workflow step immediately after)

**File**: `.github/actions/ai-reviewer/action.yml`

**Intent**: Champion proof is a comment + labels, not a red required check.

**Contract**: `GH_TOKEN` from `github.token`. `gh pr comment "$pr-number" --body-file` using the markdown `summary`. Create labels if missing (`gh label create --force`: `ai-cr:passed` green, `ai-cr:failed` red). Remove the opposite label, add the matching one. Do **not** `exit 1` when `verdict` is `fail`. Infra failures (missing key, empty diff, review CLI non-zero) still fail the step.

#### 2. Fork skip

**File**: `.github/workflows/review.yml`

**Intent**: Public repo + secrets: fork runs cannot review and must not look like a silent pass with no comment.

**Contract**: Skip the job when `github.event_name == 'pull_request'` and `head.repo.full_name != github.repository`. Do not use `pull_request_target`.

#### 3. Docs

**File**: `AGENTS.md`, `packages/code-reviewer/README.md`, optionally root `README.md` CI paragraph, `.env.example` comment if it still says “no CI job”

**Intent**: Operators know the review job is separate, needs `OPENROUTER_API_KEY` as a GitHub Secret, and must not go on the Worker.

**Contract**: AGENTS “Local code reviewer” section: mention `review.yml` + repo secret; keep “not astro:env”. Package README drops “No CI job in this lesson”. Do not list the secret value.

### Success Criteria:

#### Automated Verification:

- Review action/workflow contains `gh pr comment` and `ai-cr:passed` / `ai-cr:failed`
- Workflow or action does not `exit 1` solely because `verdict` equals `fail` (the review CLI already exits 0 on a fail verdict; the wrapper must not add a verdict-based failure)
- Fork skip (or equivalent `if:`) is present on the `pull_request` job
- AGENTS.md states the GitHub Secret name `OPENROUTER_API_KEY` and that it is not `astro:env`

#### Manual Verification:

- Human adds repository secret `OPENROUTER_API_KEY` on GitHub (same value as local `.dev.vars`)
- Human opens a small same-repo PR to `master` and confirms: Actions shows a Review job (not only `ci`), the job log ran the reviewer, a comment with the five-criteria `summary` appears, and one `ai-cr:*` label is set

## Testing Strategy

### Unit Tests:

None required for YAML. Do not add Vitest in the action.

### Integration Tests:

Local still: `npm run review:fixture --workspace=code-reviewer` (already green). CI path is the first real PR.

### Manual Testing Steps:

1. Set GitHub Secret `OPENROUTER_API_KEY`.
2. Branch from `master`, tiny same-repo PR (can reuse `packages/code-reviewer/fixtures/synthetic.diff` as a commit if you want a loud `fail` comment).
3. Confirm Review workflow, logs, comment, label. Do not require the check to be green-for-merge when verdict is fail — the **job** should still succeed.

## Performance Considerations

Review job: `npm ci` + one cheap OpenRouter call (`gpt-4o-mini`, 2048 output tokens). No Astro build. Cancel-in-progress on the same PR is enough.

## Migration Notes

Operators must add the GitHub Secret before the first PR will review. Until then the job fails loudly (missing key) — that is preferable to a silent skip.

## References

- Related research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Criteria source: `context/changes/code-reviewer/requirements.md`
- Agent CLI: `packages/code-reviewer/src/index.ts`
- Champion lock: `workspace/10xdevs-cert/champion/checklist.md` §5
- Course prompt: `.cursor/prompts/m5l3-cicd.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Composite action and thin workflow

#### Automated

- [x] 1.1 `.github/actions/ai-reviewer/action.yml` exists and is a composite action — 3e388c9
- [x] 1.2 `.github/workflows/review.yml` exists, triggers on PR to `master` + `workflow_dispatch`, and does not reference `anthropics/claude-code-action` or `ANTHROPIC_API_KEY` — 3e388c9
- [x] 1.3 `.github/workflows/ci.yml` still only lint/test/build with `SUPABASE_*` on build — 3e388c9
- [x] 1.4 `grep -R OPENROUTER .github/workflows/ci.yml` is empty — 3e388c9
- [x] 1.5 Root `npm test`, `npm run lint`, and `npx astro check` still pass — 3e388c9

### Phase 2: Comment, labels, fork skip, docs

#### Automated

- [x] 2.1 Review action/workflow contains `gh pr comment` and `ai-cr:passed` / `ai-cr:failed` — a316abb
- [x] 2.2 Wrapper does not fail the job solely because `verdict` equals `fail` — a316abb
- [x] 2.3 Fork skip (or equivalent `if:`) is present on the `pull_request` job — a316abb
- [x] 2.4 AGENTS.md states the GitHub Secret name `OPENROUTER_API_KEY` and that it is not `astro:env` — a316abb

#### Manual

- [ ] 2.5 Human adds repository secret `OPENROUTER_API_KEY` on GitHub
- [ ] 2.6 Human opens a small same-repo PR to `master` and confirms Review job, logs, comment, and one `ai-cr:*` label
