# Promptfoo evals for the code reviewer — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

We need a regression matrix for the review *prompt*, not a gut feel from one PR. Promptfoo runs the same `reviewDiff` agent on three OpenRouter models against one known-bad diff and scores JSON + fail verdict + a judge that the summary names the planted flaws.

## Starting Point

`reviewDiff` is already importable. CI uses the CLI path with the same agent. `fixtures/synthetic.diff` already has three HardFeelings 1-ends. Promptfoo is not in the package yet. GHA does not pass `OPENROUTER_MODEL`.

## Desired End State

`npm run eval --workspace=code-reviewer` locally: three models × one fixture, assertions as in Champion §6. Docs updated. No new Actions job.

## Key Decisions Made

- **Custom provider wrapping `reviewDiff`**, not native `openrouter:` as the target (that would skip `SYSTEM_PROMPT` + Zod).
- Fixture stays `synthetic.diff` — Astro/API analog, not a React 16 copy.
- Models: `openai/gpt-4o-mini` (CI default) + course `z-ai/glm-5.1` + `deepseek/deepseek-v4-flash`.
- Judge for `llm-rubric` is a cheap `openrouter:` chat model, not the reviewer.
- `OPENROUTER_MODEL` in GHA is out of scope.

## Scope

**In:** provider, `promptfooconfig.yaml`, package script + promptfoo devDependency, gitignore, README/AGENTS, one local eval run.

**Out:** Actions model env, eval-in-CI, extra tools, prompt edits unless a run proves a real prompt bug.

## Architecture / Approach

`callApi` → `reviewDiff(prompt, { model })` → `JSON.stringify` → promptfoo assertions. YAML `{{diff}}` is only the user-side input.

## Phases at a Glance

| Phase | What | Gate |
|-------|------|------|
| 1 | Provider + YAML + script + docs | Files exist; CI/review workflows untouched; lint/test still pass |
| 2 | Local `npm run eval` | Matrix completes; hard asserts pass on at least gpt-4o-mini |

## Open Risks & Assumptions

- A course model slug might 404; swap same-vendor id, document in README.
- `llm-rubric` can flake; do not weaken the fixture to make the judge happy.
- Eval spends OpenRouter credits (three reviews + judges).

## Success Criteria (Summary)

Config exists, uses `reviewDiff`, three models, local eval shows fail-on-known-bad-diff. CI workflows unchanged.
