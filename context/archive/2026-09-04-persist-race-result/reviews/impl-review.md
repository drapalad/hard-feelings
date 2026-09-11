<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Persist last race result for Estimated paces

- **Plan**: context/changes/persist-race-result/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-04
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Repo-wide `npm run lint` is red on HEAD files

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: Progress 3.3 / `TrainingLoadChart.tsx`, `training-load.ts`, `training-load.test.ts`, `pace-estimate.test.ts`
- **Detail**: Phase 3 criterion `npm run lint` (`eslint .`) still fails on pre-existing prettier and non-null-assertion errors in files this change did not touch. Touched-file eslint for persist-race-result is clean. Fixing those HEAD files would widen scope.
- **Fix**: Leave HEAD lint debt alone; keep linting this change’s files.
- **Decision**: DISMISSED — pre-existing on `bd8b4a0`; not introduced here; ADAPT documented in the run.

### F2 — Extra typecheck fixtures outside the Phase 1 file list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/lib/services/openai-chat.test.ts`, `src/lib/services/propose-adaptation.ts`
- **Detail**: Widening `ProfileView` required a full fixture in the chat test and a `ProfilePatch` cast on sanitize so `npx astro check` stays green. Last-race keys are not on `Profile` / chat freeze.
- **Fix**: None — required for the Phase 1 typecheck gate.
- **Decision**: DISMISSED — minor ADAPT to keep `astro check` green without putting last-race on `Profile`.

## Automated criteria (re-checked)

- Phase 1–2 tests and `npx astro check`: PASS (this run)
- Phase 3 scoped tests, full `npm test` (335 passed), `npx astro check`, `npm run build`: PASS
- `npm run lint` repo-wide: FAIL (pre-existing; see F1)
- Manual 3.6–3.9: still `[ ]` (human-only)

## Drift vs plan

MATCH: migration (no RLS, no UPDATE, no `last_race_name`), `ProfileView` fields, `lastRaceWriteSchema`, `updateLastRace`, PATCH `/api/profile`, GET/PUT last-race JSON, PUT prefs omit last-race columns, chip `12 Apr 2026 · 10K · 41:30`, Save PATCH, SSR seed via `useState` (no `useEffect`), source lock `fetch("/api/profile"` + `method: "PATCH"`.

NOT DOING held: no `finish_time_sec` on `races`, no option (b), no Strava, no Riegel change, no hosted apply (DEP-024).
