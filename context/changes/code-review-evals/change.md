---
change_id: code-review-evals
title: Promptfoo evals for the code reviewer
status: implemented
created: 2026-09-09
updated: 2026-09-09
archived_at: null
---

## Notes

First promptfoo config in packages/code-reviewer. Same review prompt, 2–3 OpenRouter models. One fixture: a HardFeelings-shaped diff with known flaws (Astro/API analog of the course’s React 16→19 case, not a copy). Assertions: is-json, hard fail verdict, llm-rubric.
