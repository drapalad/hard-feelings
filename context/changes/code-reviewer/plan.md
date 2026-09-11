---
status: planned
created: 2026-09-08
updated: 2026-09-08
---

# Plan: Local code-reviewer agent

M5L2 only. Architecture is locked by `workspace/10xdevs-cert/champion/checklist.md` and `.cursor/prompts/m5l2-agent.md`.

## Goal

Independent npm workspace package that reads a git diff on stdin and prints structured JSON from a model. Root `npm ci` / `ci.yml` still lint, test, and build the Astro app.

## Locked decisions

- Package: `packages/code-reviewer/` (not `src/` of the app).
- SDK: latest Vercel AI SDK (`ai` 7) + `@openrouter/ai-sdk-provider` 3. Course Goal asks for newest libraries; OpenRouter 3 requires `ai@^7` and Node 22 (we have 22.14).
- Agent: `ToolLoopAgent` + `Output.object` + `stopWhen: isStepCount(2)` (v7 name; same cap as course `stepCountIs(2)`).
- `tools: {}` — no tools this lesson.
- Contract: Zod schema with five 1–10 scores, `verdict` pass/fail, `summary` markdown. Rubrics stay skeletal until M5L3 #1.
- Key: `OPENROUTER_API_KEY` from `.dev.vars` / `.env` / process env. Never commit. Not an `astro:env` field (Worker must not receive it).
- Out of scope: GHA, promptfoo, PR comments, extra tools.

## Layout

- `src/schema.ts` — Zod contract + exported type
- `src/prompt.ts` — `SYSTEM_PROMPT` + user-prompt builder
- `src/agent.ts` — `createCodeReviewer` / `reviewDiff` (importable for later evals)
- `src/load-env.ts` — CLI-only `.dev.vars` loader
- `src/index.ts` — stdin CLI
- `fixtures/synthetic.diff` — local proof the model returns JSON

## Verification

1. Root `npm test`, `npm run lint`, `npx astro check` still pass (exclude the package from the Astro tsconfig).
2. `git diff |` / fixture pipe → valid JSON matching the schema.
3. Sample output saved under this change folder (FORM).
