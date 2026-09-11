---
change_id: generate-honors-plan-prefs
title: Algorithmic week honors long/rest/mix prefs and A–D
status: archived
created: 2026-09-10
updated: 2026-09-10
archived_at: 2026-09-10T09:15:38Z
---

## Notes

Retroactive `/10x-new`. Persist of long/rest/mix already shipped in `profile-plan-prefs` (2026-09-02) with generate explicitly out of scope. This remainder is FR-012: `generatePlan` consumes those fields and race priorities A–D. Code landed in the cert-review session before this folder existed; `plan.md` is as-built, not a pre-code spec.

Files: `src/types.ts` (`GenerateInput`), `src/lib/dates.ts` (`weekdayOf`, `utcDayDiff`), `src/lib/services/generate-plan.ts`, `src/lib/services/plan.ts` (`buildGenerateInput` / `generateAndPersist`), tests in `generate-plan.test.ts` + `dates.test.ts`. No migration. Chat / Accept / Profile UI unchanged.
