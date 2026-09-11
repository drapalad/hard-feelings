---
status: planned
created: 2026-09-09
updated: 2026-09-09
---

# Promptfoo evals for the code reviewer Implementation Plan

## Overview

Add a first promptfoo config inside `packages/code-reviewer` that runs the **same** `reviewDiff` agent CI uses against one known-bad HardFeelings diff, on three OpenRouter models. Assertions: valid JSON, hard `verdict: fail` plus low scores on the three planted flaws, and an `llm-rubric` that the summary actually names those flaws.

## Current State Analysis

The reviewer is an importable workspace package. CLI and GHA both call `reviewDiff` → `createCodeReviewer` with `SYSTEM_PROMPT` and Zod structured output. README still says promptfoo is out of the package. There is no `promptfooconfig.yaml`. The canned proof is `fixtures/synthetic.diff` (already three 1-end flaws). GHA Review step env does not pass `OPENROUTER_MODEL`.

## Desired End State

From the package: `npm run eval --workspace=code-reviewer` (or equivalent) loads `.dev.vars`, runs promptfoo on `synthetic.diff` × three models, and prints a pass/fail matrix plus cost. Config and a thin custom provider live in the package. Docs tell a human how to run it. No new GitHub workflow. `review.yml` / `ci.yml` unchanged.

### Key Discoveries:

- Same prompt = import `reviewDiff`, do not paste `SYSTEM_PROMPT` into YAML (`packages/code-reviewer/src/agent.ts:13-38`).
- Native `openrouter:<id>` as the *target* would skip structured output and drift from CI.
- `synthetic.diff` already is the Astro/API analog of the course’s React 16→19 case.
- `OPENROUTER_MODEL` in Actions is a separate change; this eval matrix is how we *compare* models locally.

## What We're NOT Doing

- Wiring `OPENROUTER_MODEL` into `.github/actions/ai-reviewer/action.yml`
- A GitHub Actions eval job
- Copying a React 16→19 fixture
- Extra agent tools (`tools: {}` stays)
- Merge-blocking CI on eval results
- Promptfoo Cloud / linked targets
- Changing the five review criteria or `SYSTEM_PROMPT` (unless an eval run proves a prompt bug — then a follow-up, not this plan’s happy path)

## Implementation Approach

One custom TypeScript/ESM provider wraps `reviewDiff`. `promptfooconfig.yaml` lists three provider instances (same file, different `config.model`). One test case: vars load `fixtures/synthetic.diff`. Assertions: `is-json`, javascript hard fail, `llm-rubric` with a cheap `openrouter:` judge. `promptfoo` is a **devDependency** of this package only.

## Critical Implementation Details

- Return `JSON.stringify(review)` from `callApi` so `is-json` is meaningful. Javascript assertions parse that string. If `callApi` returned a raw object, `is-json` would be a no-op or flake.
- Load `OPENROUTER_API_KEY` the same way the CLI does (`loadLocalEnv` from the package, without overriding existing env). Do not read `.dev.vars` in YAML.
- The judge must **not** be the custom reviewer. `llm-rubric` uses `openrouter:openai/gpt-4o-mini` (or the same cheap id) so grading is a chat completion, not a second structured review.

## Phase 1: Provider, config, script, docs

### Overview

Install promptfoo in the workspace package, add a custom provider + `promptfooconfig.yaml`, npm script, gitignore for eval output, and README how-to.

### Changes Required:

#### 1. Custom promptfoo provider

**File**: `packages/code-reviewer/evals/reviewer-provider.ts` (or `.mjs` if TS loading fights promptfoo — prefer TS first)

**Intent**: Each eval cell is `reviewDiff(prompt, { model })` — identical agent + system prompt as `npm run review`.

**Contract**: Default export class with `id()` and `callApi`. Read `options.config.model` (required). Call `reviewDiff(prompt, { model })`. On success: `{ output: JSON.stringify(review) }`. On throw: `{ error: message }` (do not swallow into a fake pass). Optionally call `loadLocalEnv()` once at module load so the key is present when run from the package directory.

#### 2. promptfoo config

**File**: `packages/code-reviewer/promptfooconfig.yaml`

**Intent**: One fixture × three OpenRouter model ids, Champion/course assertions.

**Contract**:

- `prompts`: `"{{diff}}"` (the rendered prompt *is* the diff; the agent wraps it with `buildUserPrompt`).
- `providers`: three entries, all `id: file://./evals/reviewer-provider.ts`, labels matching the model, `config.model` =
  1. `openai/gpt-4o-mini`
  2. `z-ai/glm-5.1`
  3. `deepseek/deepseek-v4-flash`
- `tests`: one case; `vars.diff` from `file://./fixtures/synthetic.diff`.
- `assert`:
  - `type: is-json`
  - `type: javascript` — parse JSON; `verdict === "fail"`; `criteria.tenantIsolation <= 3`; `criteria.astroIslandConventions <= 3`; `criteria.trustedApiSurface <= 3`. Do not assert on `hardBoundsOnAccept`.
  - `type: llm-rubric` — summary must identify: (1) identity / `userId` taken from the request body, (2) `"use client"` on an API route, (3) missing Zod / untrusted body persisted. Set `provider: openrouter:openai/gpt-4o-mini` on this assertion (or `defaultTest`).
- Do not put secrets in the YAML.

#### 3. Package scripts and ignore

**File**: `packages/code-reviewer/package.json`, root or package `.gitignore`

**Intent**: Reproducible local run without committing eval dumps.

**Contract**: `"eval": "promptfoo eval -c promptfooconfig.yaml"` (cwd = package when using `--workspace`). Add `promptfoo` as a **devDependency** of `code-reviewer`. Ignore `.promptfoo/` and promptfoo output JSON under the package. Do not add promptfoo to the Astro app’s dependencies.

#### 4. Docs

**File**: `packages/code-reviewer/README.md`, `AGENTS.md` (the “out of this package until later” line)

**Intent**: Evals are in the package now; still not in GHA.

**Contract**: How to run (`OPENROUTER_API_KEY` via `.dev.vars`, `npm run eval --workspace=code-reviewer`). State that this is local, costs OpenRouter credits, and is not part of `review.yml`. Remove “promptfoo still out of this package.”

### Success Criteria:

#### Automated Verification:

- `packages/code-reviewer/promptfooconfig.yaml` exists and lists three `file://` providers with the three model ids above
- Custom provider file exists and imports `reviewDiff` from this package (not a pasted system prompt)
- `.github/workflows/review.yml` and `.github/workflows/ci.yml` are unchanged
- Root `npm test` and `npm run lint` still pass (no app behavior change)

#### Manual Verification:

- YAML + provider look right in review (no key in git; models are OpenRouter slugs)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Run the matrix locally

### Overview

Spend OpenRouter credits once: `npm run eval --workspace=code-reviewer`. Confirm the table: JSON + hard fail should pass on models that catch the fixture; rubric may flake — note it, do not “fix” a failing rubric by weakening the planted flaws.

### Changes Required:

#### 1. Execute eval

**File**: none required (run artifact untracked). Optional: `context/changes/code-review-evals/` note of which models passed if a slug 404s — then swap that id in YAML only.

**Intent**: Proof the matrix actually runs.

**Contract**: Command from repo root with Node 22. Needs network + `OPENROUTER_API_KEY`. If a model id is unavailable, replace with the nearest same-vendor OpenRouter slug and record it in the README. Do not commit `.promptfoo/` results.

#### 2. Optional FORM screenshot

**File**: outside this repo (`workspace/10xdevs-cert/…`) if the human wants the bonus — not required to close the change.

**Intent**: Champion badge does not require the table screenshot.

**Contract**: Do not block merge/docs on a screenshot.

### Success Criteria:

#### Automated Verification:

- (none beyond Phase 1 files remaining)

#### Manual Verification:

- `npm run eval --workspace=code-reviewer` completes for all three providers (or documented slug swap)
- Hard assertions (`is-json`, `verdict: fail`, three low scores) pass on at least the CI-default model
- Cost/latency visible in the promptfoo table

---

## Testing Strategy

### Unit Tests:

- No new Vitest suite required. The reviewer already has `review:fixture`. Promptfoo *is* the eval.

### Integration Tests:

- The promptfoo run in Phase 2.

### Manual Testing Steps:

1. `npm run review:fixture --workspace=code-reviewer` still returns JSON with `verdict: fail` (sanity before paying for three models).
2. `npm run eval --workspace=code-reviewer` — inspect HTML/CLI table.
3. Confirm `ci.yml` / `review.yml` git diff is empty.

## Performance Considerations

Three live LLM calls plus one judge call per cell. Keep `maxOutputTokens: 2048` as the agent already does. Do not raise it for evals. Cache: promptfoo’s cache is fine locally; do not commit the cache.

## Migration Notes

None. Local-only; no production or Worker impact.

## References

- Related research: `context/changes/code-review-evals/research.md`
- Course prompt: `.cursor/prompts/m5l3-promptfoo.md`
- Promptfoo custom provider: https://www.promptfoo.dev/docs/providers/custom-api/
- Promptfoo OpenRouter: https://www.promptfoo.dev/docs/providers/openrouter/
- Assertions: https://www.promptfoo.dev/docs/configuration/expected-outputs/
- Agent: `packages/code-reviewer/src/agent.ts:13-46`
- Fixture: `packages/code-reviewer/fixtures/synthetic.diff`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider, config, script, docs

#### Automated

- [x] 1.1 `packages/code-reviewer/promptfooconfig.yaml` exists and lists three `file://` providers with the three model ids
- [x] 1.2 Custom provider file exists and imports `reviewDiff` from this package (not a pasted system prompt)
- [x] 1.3 `.github/workflows/review.yml` and `.github/workflows/ci.yml` are unchanged
- [x] 1.4 Root `npm test` and `npm run lint` still pass

#### Manual

- [x] 1.5 YAML + provider look right in review (no key in git; models are OpenRouter slugs)

### Phase 2: Run the matrix locally

#### Manual

- [x] 2.1 `npm run eval --workspace=code-reviewer` completes for all three providers (or documented slug swap)
- [x] 2.2 Hard assertions (`is-json`, `verdict: fail`, three low scores) pass on at least the CI-default model
- [x] 2.3 Cost/latency visible in the promptfoo table
