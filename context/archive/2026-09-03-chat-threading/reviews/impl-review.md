<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Chat thread separation

- **Plan**: context/changes/chat-threading/plan.md
- **Scope**: Phase 3 of 3
- **Date**: 2026-09-03
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — In-flight loadMonth could overwrite New thread / select

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plan/PlanWorkspace.tsx:532
- **Detail**: `loadMonth` already uses `loadSeq` to drop stale month fetches. `newThread` and `selectThread` did not bump that seq, so a mount/month fetch that finished after a New thread click could restore the previous transcript and active id.
- **Fix**: Increment `loadSeq` at the start of `newThread` / `selectThread` and ignore the response when a newer load has started; only clear `busy` when this seq is still current.
- **Decision**: FIXED — applied in this review

### F2 — Repo-wide `npm run lint` is already red on unrelated Wave files

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/middleware.ts, src/components/plan/training-load.ts, and other non-change files
- **Detail**: Phase lint gates require `npm run lint`. That command already fails on files this change did not touch. All files in this change's touched set are eslint-clean.
- **Fix**: Treat the gate as the change-file lint set until a later cleanup change makes repo-wide lint green.
- **Decision**: DISMISSED — pre-existing on the branch; not introduced here

### F3 — Backfill titles use `Week of D Mon` instead of SQL null

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260903130000_chat_threads.sql:40
- **Detail**: The plan said backfill `title` is first-60 user chars else null, with UI fallback `Week of D MMM`. The migration writes `'Week of ' || to_char(week_start, 'FMDD Mon')` when there is no user message. Visible rows still match P-06; new untitled threads remain `title: null` and use the UI fallback.
- **Fix**: Keep the SQL fallback so migrated empty weeks already have a readable title.
- **Decision**: DISMISSED — same visible copy; UI fallback still covers new threads

## Success criteria

- Phase 1–3 Automated commands: PASS (`npm test` 320 passed / 2 skipped).
- Manual 3.10–3.12 remain `[ ]` (human-only dashboard checks).
