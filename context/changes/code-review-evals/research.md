---
date: 2026-09-09T10:41:27+00:00
researcher: Dawid Drapala
git_commit: 07c892b1d852fb5be196f223b257f4dbe71180d1
branch: master
repository: drapalad/hard-feelings
topic: "Introduce promptfoo evals for packages/code-reviewer (same prompt, 2–3 OpenRouter models)"
tags: [research, codebase, promptfoo, code-reviewer, openrouter, evals]
status: complete
last_updated: 2026-09-09
last_updated_by: Dawid Drapala
---

# Research: Promptfoo evals for the code reviewer

**Date**: 2026-09-09T10:41:27+00:00
**Researcher**: Dawid Drapala
**Git Commit**: 07c892b1d852fb5be196f223b257f4dbe71180d1
**Branch**: master
**Repository**: drapalad/hard-feelings

## Research Question

`/10x-research code-review-evals` — can we eval the **same** review prompt and agent that CI uses, with promptfoo, on 2–3 OpenRouter models? Is the stack aligned, or do we need another OSS harness? Fixture analog for the course’s React 16→19 case?

## Summary

Promptfoo is the right tool. The agent is already importable: `reviewDiff` / `createCodeReviewer` from `packages/code-reviewer` (`exports["."]` → `src/agent.ts`). Both the CLI (GHA) and that import go through `createCodeReviewer` → `instructions: SYSTEM_PROMPT` + Zod `Output.object`. `SYSTEM_PROMPT` itself is **not** a public export — and it must not be copied into YAML, or the eval would drift from CI.

The load-bearing design: a **custom JS/TS provider** (`file://…`) that calls `reviewDiff(diff, { model })`. Do **not** list `openrouter:z-ai/glm-5.1` as the eval *target* — that would send a generic chat prompt and skip structured output. Use `openrouter:` only for the **llm-rubric judge**.

One fixture is enough: existing [`packages/code-reviewer/fixtures/synthetic.diff`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/packages/code-reviewer/fixtures/synthetic.diff) already has three HardFeelings 1-ends (`body.userId`, `"use client"` on an API route, skipped Zod). Do not invent a React 16→19 story.

Models (course + Champion): `openai/gpt-4o-mini` (what CI actually defaults to), `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`. Same `OPENROUTER_API_KEY` as the reviewer. Local only — not a GHA job in this change.

## Detailed Findings

### What promptfoo is (in this repo’s terms)

Promptfoo is an **eval harness**, not a second reviewer. You declare: prompt(s) × provider(s) × test(s) with assertions. It runs the matrix, then scores each cell (`is-json`, `javascript`, `llm-rubric`, cost/latency). Docs: [custom JS provider](https://www.promptfoo.dev/docs/providers/custom-api/), [OpenRouter provider](https://www.promptfoo.dev/docs/providers/openrouter/), [assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/).

For us the “prompt” is the git diff. The “system prompt” stays inside the agent. The “providers” are three instances of the same custom wrapper with different `config.model`. The “assertions” check that a known-bad diff still gets `verdict: fail` and that the summary names the flaws.

Other OSS (promptfoo vs Langfuse vs DeepEval vs Braintrust): stack is Node + OpenRouter + a function we already export. Promptfoo is first-party in the course prompt and matches. No reason to switch.

### Agent importability

- Public: `reviewDiff`, `createCodeReviewer`, `ReviewerOptions` ([`agent.ts`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/packages/code-reviewer/src/agent.ts#L8-L46)); `reviewOutputSchema` via `code-reviewer/schema`.
- Not exported: `SYSTEM_PROMPT`, `buildUserPrompt`, `loadLocalEnv`.
- Model: `options.model ?? process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"` ([`agent.ts:20`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/packages/code-reviewer/src/agent.ts#L20)).
- CLI (`src/index.ts`) calls `reviewDiff(diff)` with no options — GHA therefore only gets a non-default model if `OPENROUTER_MODEL` is in the **action `env:`**. Today it is not (see Architecture Insights).
- README already says: import `reviewDiff` for later evals; promptfoo still out of package ([`README.md:17`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/packages/code-reviewer/README.md#L17)).

`reviewDiff` takes **only a diff string** (no PR title). Eval fixture = file contents of `synthetic.diff`.

### Custom provider vs native OpenRouter provider

Custom provider contract: `id()` + `async callApi(prompt)` returning `{ output }`. Multiple YAML entries can share one file with different `config.model` ([docs](https://www.promptfoo.dev/docs/providers/custom-api/)).

```ts
// shape, not the implementation
async callApi(prompt: string) {
  const review = await reviewDiff(prompt, { model: this.config.model });
  return { output: JSON.stringify(review) };
}
```

Stringify so `is-json` is a real check. `javascript` then `JSON.parse(output)`.

Judge: `defaultTest.options.provider: openrouter:openai/gpt-4o-mini` (or similar cheap id) with `OPENROUTER_API_KEY`. Prefix `openrouter:`, not `openai:chat`.

### Fixture (Astro analog, not React 16)

[`synthetic.diff`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/packages/code-reviewer/fixtures/synthetic.diff) vs [`requirements.md`](https://github.com/drapalad/hard-feelings/blob/07c892b1d852fb5be196f223b257f4dbe71180d1/context/changes/code-reviewer/requirements.md):

| Flaw | Lines | Criterion |
|------|-------|-----------|
| Identity from `body.userId`; auth gate deleted | 12–17 | tenantIsolation |
| `"use client"` on an API route | 7 | astroIslandConventions |
| Raw body persisted; no Zod | 16–21 | trustedApiSurface |

`hardBoundsOnAccept` is untouched (score 10 is correct). Named-risk test omission is implicit (no test hunk). Optional later: catch→200 or a weak 200-only test — not required for Champion’s “three known flaws.”

### Models

Course names `z-ai/glm-5.1` and `deepseek/deepseek-v4-flash` (both live on OpenRouter as of this research). Champion wants 2–3 vendors. Third: `openai/gpt-4o-mini` so the matrix includes **the CI default**. If a slug 404s at eval time, swap only that id — do not change the agent.

### Assertions (course + Champion)

- `is-json` — output parses as JSON.
- Hard / static: `javascript` — `verdict === "fail"` and the three touched scores are low (≤ 3): `tenantIsolation`, `astroIslandConventions`, `trustedApiSurface`. Do not fail the cell on `hardBoundsOnAccept` (untouched).
- `llm-rubric` — summary names the three flaws (forged `userId` / body identity, `"use client"` on API, missing Zod). Judge is a separate OpenRouter chat model.

`npx promptfoo eval` (or workspace script) locally. Table screenshot = bonus FORM, not Champion-required. Do **not** add this to `.github/workflows/`.

### Package / install

`promptfoo` as a **devDependency of `packages/code-reviewer`**, script e.g. `eval`. Root `npm ci` already installs workspaces. Config lives in the package: `promptfooconfig.yaml`. Ignore eval output (`.promptfoo/`, default results JSON) so we do not commit run artifacts.

Key: same `.dev.vars` `OPENROUTER_API_KEY`. Provider should not depend on `loadLocalEnv` if the eval script exports the key first; a tiny eval entry that calls `loadLocalEnv` once is acceptable so `npm run eval --workspace=code-reviewer` matches `npm run review`.

## Code References

- `packages/code-reviewer/src/agent.ts:13-46` — same agent CI uses; model override
- `packages/code-reviewer/src/prompt.ts:1-37` — SYSTEM_PROMPT + diff-only user prompt
- `packages/code-reviewer/src/schema.ts:7-35` — five scores + verdict + summary
- `packages/code-reviewer/package.json:13-16` — `exports` for import
- `packages/code-reviewer/fixtures/synthetic.diff` — three known flaws
- `.github/actions/ai-reviewer/action.yml:42-45` — Review step `env` is **only** `OPENROUTER_API_KEY` and `BASE_REF` (no `OPENROUTER_MODEL`)
- `packages/code-reviewer/README.md:15-17` — evals deferred until this change

## Architecture Insights

- **Same prompt** means “same `createCodeReviewer`,” not “paste `SYSTEM_PROMPT` into YAML.” YAML that talks to `openrouter:` directly is a *different* product.
- GHA model is currently always `openai/gpt-4o-mini` unless someone later adds `OPENROUTER_MODEL` to the composite `env`. That wiring is **not** this change.
- Two secret domains stay: evals use OpenRouter locally; `ci.yml` still has no OpenRouter; `review.yml` stays comment/labels, not an eval job.
- `tools: {}` stays. Extra agent tools are M5L3 #4, out of this change.

## Historical Context (from prior changes)

- `context/changes/code-reviewer/plan.md` — M5L2: export `reviewDiff` for later evals; promptfoo explicitly out of that change.
- `context/changes/ci-cd-code-review/plan.md` — promptfoo listed under What We’re NOT Doing.
- `context/changes/ci-cd-code-review/requirements.md` — “promptfoo / model matrix (M5L3 #3, separate change).”

## Related Research

- `context/changes/ci-cd-code-review/research.md` — how CI invokes the CLI; does not cover promptfoo.

## Open Questions

None that block the plan. Locked:

- Toolkit: promptfoo (stack aligned).
- Fixture: keep `synthetic.diff`; no React 16 copy.
- Three models: `openai/gpt-4o-mini`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`.
- Local eval only; no GHA eval job; no `OPENROUTER_MODEL` wiring in Actions.
