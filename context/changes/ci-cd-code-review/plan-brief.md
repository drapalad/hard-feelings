# CI/CD code review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Champion A needs a reviewer on the pull request, not only on a laptop. Wire `packages/code-reviewer` into GitHub Actions so every same-repo PR to `master` gets a scored comment and an `ai-cr:*` label.

## Starting Point

Local CLI already prints Zod JSON from a git diff. `ci.yml` is lint/test/build only. No composite action, no OpenRouter secret on GitHub, no PR comment.

## Desired End State

A second workflow (`review.yml`) calls `.github/actions/ai-reviewer`. Diff vs base, OpenRouter review, `gh pr comment` with `summary`, label `ai-cr:passed` or `ai-cr:failed`. `verdict: fail` does not fail the check. `ci.yml` unchanged. Forks skipped.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runner | Own agent + composite action | Champion A; not Claude Code Action | Champion / Requirements |
| Workflow | Separate `review.yml`, leave `ci.yml` | Different secrets; keep lint/test/build green | Research |
| Diff | `fetch-depth: 0` + `origin/base...HEAD` | Shallow clone → empty stdin | Champion / Research |
| PR body | Skip in MVP | Token cost; agent is diff-only today | Requirements |
| Comment | `gh pr comment`, not an agent tool | MVP side-effect; tools stay `{}` | Requirements |
| Merge gate | None | Champion needs comment, not a red required check | Champion |
| Forks | Skip (`head.repo == github.repository`) | Public repo: no secrets / write token on forks | Research |
| Job fail | Only infra (key, empty diff, CLI crash) | CLI already exits 0 on `verdict: fail` | Research |

## Scope

**In scope:** composite action, `review.yml`, comment, labels, fork skip, docs, GitHub Secret (human).

**Out of scope:** promptfoo, extra tools, retry-on-label, merge block, Claude Action, Worker/`astro:env` OpenRouter, changing `ci.yml`.

## Architecture / Approach

`review.yml` (triggers + permissions + secret) → composite (`npm ci` → diff → `npm run review --workspace=code-reviewer` → `jq` → `gh`). Node 22 / npm, same as `ci.yml`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Action + workflow | Checkout, install, diff, JSON outputs | Empty diff from shallow clone |
| 2. Comment, labels, docs | Visible PR proof; secret documented | Secret never set; job “passes” with no comment on forks |

**Prerequisites:** GitHub repo admin can add `OPENROUTER_API_KEY` (phase 2 Manual). Implement is a **later session**.
**Estimated effort:** one implementation session + one small PR for proof.

## Open Risks & Assumptions

- Node 22 on `ubuntu-latest` satisfies package `engines: >=22.14.0`.
- First PR before the secret exists will fail the Review job (loud missing-key) — acceptable.
- Screenshots for Champion §8 happen after this change ships, on that proof PR.

## Success Criteria (Summary)

- Same-repo PR to `master` gets a five-criteria comment and one `ai-cr:*` label
- `ci.yml` still lint/test/build only
- A fail verdict still shows a **successful** Review job
