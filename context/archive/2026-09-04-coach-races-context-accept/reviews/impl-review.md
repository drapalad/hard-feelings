<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Coach sees all races and Accept-gates add or remove

- **Plan**: context/changes/coach-races-context-accept/plan.md
- **Scope**: Phase 1 of 3 through Phase 3 of 3
- **Date**: 2026-09-04
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Git scope

`c195ce3..HEAD`: `a9107ee` (p1), `3d3a7e8` (p2), `cae1e74` (p3), `bbac46a` (epilogue). Product: migration `20260904210000_chat_profile_freeze_pending_races_patch.sql`, `src/types.ts`, `chat.ts` + test, `openai-chat.ts` + test, `propose-adaptation.ts` + test, `PlanChat.tsx` + test, `PlanWorkspace.tsx` (p1 parse) + test, `memory-supabase.ts` (`.single()` for `insertRace`). Routes `accept.ts` / `dismiss.ts` and `races.ts` unchanged (thin `prerender = false`; reuse writes). Context: change.md, plan.md, plan-brief.md, plan-review.md, FU-145, DEP-028.

## Plan drift

| File | Plan | Actual | Verdict |
| ---- | ---- | ------ | ------- |
| Migration | `ALTER TABLE … ADD COLUMN races_patch jsonb`; no `CREATE TABLE` / POLICY | Matches | MATCH |
| `src/types.ts` | `PendingRacesPatch`; optional `races` on pending | Matches | MATCH |
| `chat.ts` load | missing `races_patch` key → null; races-only rows keep | Matches | MATCH |
| `openai-chat.ts` | compact upcoming + A-with-goal; table-not-profile prompt; schema `races` required object | Matches | MATCH |
| `propose-adaptation.ts` | copy `races` through sanitize / `toRawProposeResult` | Matches | MATCH |
| `chat.ts` send | first-pass `compactCoachRaces`; persist pending; no `insertRace` on Send; km still `applyMutations` | Matches | MATCH |
| `chat.ts` accept | unknown ids `NOT_FOUND` before writes; `validateRaceList`; then profile/freeze; remove → patch → add | Matches | MATCH |
| `accept.ts` / `dismiss.ts` | thin; `prerender = false`; no new route | Unchanged, already satisfied | MATCH |
| `races.ts` | call sites only | No fork | MATCH |
| `PlanChat.tsx` | keep heading; `Add race:` / `Remove race:` / `Patch race:`; Accept/Dismiss | Matches (`formatPendingRaceAddLine` → `Add race: Spring HM · 12 Apr 2027 · A`) | MATCH |
| `PlanWorkspace.tsx` | `asPendingProfileFreeze` races; accept/dismiss URLs | p1 parse + existing routes | MATCH |
| Out of scope | no `chat_race_pending`; no S-09.5; no Profile races; no auto-apply on Send; no leftover-proposition skip | Not in product diff | MATCH |

## Safety & patterns

- Pending writes stay on own-row `chat_profile_freeze_pending`; no new RLS.
- Accept projects then `validateRaceList` before profile/freeze/race writes; unknown remove/patch ids return `NOT_FOUND` with status still `pending`.
- Send still auto-applies calendar mutations; race writes only in `applyPendingRaceWrites` after Accept.
- `acceptProposition` still prefers leftover `plan_propositions` (out of scope).
- ADAPT: memory client gained `.single()` so tests can call existing `insertRace` (`.single()`); production Supabase already has it.

## Success criteria

- Phase 1 scoped tests + `npx astro check`: PASS at `a9107ee`
- Phase 2 scoped tests + `npx astro check`: PASS at `3d3a7e8`
- Phase 3 scoped tests + `npm test` + touched-file eslint + `npx astro check`: PASS at `cae1e74` (`npm test` 405 passed, 2 skipped)
- Repo-wide `npm run lint` remains red at HEAD on untouched training-load / pace-estimate files (ADAPT; not this diff)
- Manual 3.5–3.7: still `[ ]` (human-only)

## Findings

### F1 — Memory Supabase `.single()` is extra vs the plan file list

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/test/memory-supabase.ts
- **Detail**: Phase 3 reuses `insertRace`, which ends with `.single()`. The in-memory client only exposed `maybeSingle()`, so Accept add tests could not call the real writer without a harness alias. Production `races.ts` was not forked.
- **Fix**: Keep the `.single()` alias on the test double (shipped).
- **Decision**: DISMISSED — required to exercise existing `insertRace` without changing write logic; not a product-scope extra.

## Decisions

F1 DISMISSED — test-harness alias for existing `.single()`; do not fork `races.ts`.
