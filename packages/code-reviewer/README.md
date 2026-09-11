# code-reviewer

Local agent: stdin git diff → structured JSON via OpenRouter and the Vercel AI SDK `ToolLoopAgent`.

Five scores (1–10) come from `context/changes/code-reviewer/requirements.md`: tenant isolation, hard bounds on Accept, Astro/island conventions, trusted API surface, named-risk tests. Rubrics live on the Zod schema (`.describe()`) and in the system prompt.

```bash
# from repo root (loads ../../.dev.vars via the CLI)
git diff | npm run review --workspace=code-reviewer

# canned proof
npm run review:fixture --workspace=code-reviewer
```

Requires `OPENROUTER_API_KEY` in `.dev.vars` locally, or the GitHub Actions secret of the same name for `.github/workflows/review.yml`. Optional `OPENROUTER_MODEL` (default `openai/gpt-4o-mini`). Output is capped at 2048 tokens so a low OpenRouter balance still runs.

Promptfoo evals reuse `reviewDiff` (same system prompt as CI) against three fixtures (`synthetic.diff`, `markdown-only.diff`, `accept-skip.diff`) on three OpenRouter models. Local only — not part of `review.yml`. Spends OpenRouter credits. The package pins `promptfoo@0.119.14` because this repo’s Node is 22.14 (`.nvmrc`); newer promptfoo refuses to start below 22.22.

```bash
npm run eval --workspace=code-reviewer
```

Extra agent tools are still out of this package.
