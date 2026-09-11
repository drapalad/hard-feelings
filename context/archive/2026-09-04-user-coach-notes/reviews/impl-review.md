<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Member coach notes on Profile

- **Plan**: context/changes/user-coach-notes/plan.md
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
- **Detail**: Repo-wide `npm run lint` still fails on pre-existing prettier and non-null-assertion errors in files this change did not touch. Touched-file eslint for user-coach-notes is clean. Fixing those HEAD files would widen scope.
- **Fix**: Leave HEAD lint debt alone; keep linting this change’s files.
- **Decision**: DISMISSED — pre-existing on `5764e8e`; not introduced here; ADAPT documented in the plan (Progress 3.3) and this run.

### F2 — Extra typecheck fixture outside the Phase 1 file list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/lib/services/openai-chat.test.ts`
- **Detail**: Widening `ProfileView` required `coachNotes: null` on the chat fixture so `npx astro check` stays green in Phase 1, before UI/inject tests. Notes stay off `Profile` / chat freeze.
- **Fix**: None — required for the Phase 1 typecheck gate.
- **Decision**: DISMISSED — minor ADAPT to keep `astro check` green without putting notes on `Profile`.

## Automated criteria (re-checked)

- Phase 1–2 tests: PASS (this run: 51 tests across migration-safety, profile-races, profile API, openai-chat, SetupForm)
- Phase 3 scoped tests: PASS
- Touched-file eslint: PASS
- Full `npm test` / `npx astro check` / `npm run build`: PASS at `d122d43`
- `npm run lint` repo-wide: FAIL (pre-existing; see F1)
- Manual 3.6–3.8: still `[ ]` (human-only)

## Drift vs plan

MATCH: migration `20260904120000_profile_coach_notes.sql` (`ALTER TABLE profiles ADD COLUMN coach_notes text`; no POLICY, no UPDATE); `ProfileView.coachNotes` only (last-race fields unchanged); zod omit-to-preserve (omitted key stripped; `""` → `null` with key present; clamp 2000 not 400); `upsertProfile` writes `coach_notes` only when `'coachNotes' in profile`; PUT forwards `parsed.data`; GET null → textarea `""`; own Coach notes section + Save; weekly-km Save omits `coachNotes`; SSR `dashboard.astro` → `DashboardTabs` → `SetupForm`; `systemPrompt` dedicated `Member coach notes:` line when trimmed non-empty; inject covers extra follow-up; Profile JSON still includes the field.

NOT DOING held: no option (b); no admin-global / `project_settings` notes; no race/mix/last-race field changes; no new RLS; no hosted apply (DEP-025); `chat.ts` and `src/pages/api/profile.ts` product paths unchanged (freeze stays prefs-only; PUT already forwards parse output).
