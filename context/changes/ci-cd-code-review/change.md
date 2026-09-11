---
change_id: ci-cd-code-review
title: CI/CD code review on pull requests
status: implementing
created: 2026-09-09
updated: 2026-09-09
archived_at: null
---

## Notes

workflow na PR do master, review w composite action. Own `packages/code-reviewer` agent (not the Claude Code Action template). Existing `.github/workflows/ci.yml` stays green as a separate job.
