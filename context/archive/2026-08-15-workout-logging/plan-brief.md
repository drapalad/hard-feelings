# Workout Logging — Plan Brief

> Full plan: `context/changes/workout-logging/plan.md`

## What & Why

Member can log a completed planned workout from the calendar or chat (FR-009, S-05). Logging records what they did; it does not rewrite the prescribed week. External sync stays parked (FR-010).

## Starting Point

S-02 calendar + `training_units`, S-03 chat stub, and S-04 inline edit/undo are on disk. No completion model. Chat “I completed Tuesday” is unrecognized help. `replaceWeek` would wipe any flag stored on the unit row. Next SQL DEP is DEP-013.

## Desired End State

Signed-in member with a generated week clicks Log on a filled day (or chats completion) and sees a Logged badge after reload. Unlog removes it. Chat does not open Accept. Planned type/km stay put. Rows are RLS-scoped.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Log existing planned days only | Matches S-04 / `UNIQUE (user_id, date)`; empty days stay generate/chat | Unattended |
| Store | Separate `workout_logs` table | `replaceWeek` would erase a column on `training_units` | Plan |
| Payload | Snapshot type + km; optional km override | “Completed” copies the plan; chat “logged 8 km” needs a field | Unattended |
| Chat path | Immediate upsert; no proposition | FR-009 is history, not a gated plan mutation | Plan |
| Phrases | `completed` / `logged` / `log` / `done` + date; not bare `did` | Avoid colliding with “I did a long on Wednesday” type-changes | Unattended |
| Re-log | Upsert one row per date; Unlog deletes | Same one-day identity as units | Plan |
| Plan ops | Logs survive generate / Accept / Undo | Completion history is not a revision of the prescription | Unattended |
| UI | One-click Log copies plan; km override is chat-only | Calendar stays a Done control; no new form chrome | Unattended |
| HTTP | JSON + zod; 401; not `PROTECTED_ROUTES` | Middleware redirects would break `fetch` | Plan |
| Hosted SQL | Append DEP-013; leave 001–012 | Worker rollback does not undo SQL | Plan |
| Tests | Vitest on resolver + stub; no Playwright | Matches S-02–S-04; GHA has no Supabase | Plan |

## Scope

**In scope:** `workout_logs` + RLS + DEP-013; `resolveWorkoutLog`; POST/DELETE `/api/plan/logs`; GET `logs`; chat log intent + immediate persist; dashboard Log/Unlog.

**Out of scope:** Off-plan diary; mutating units on log; Accept-gated completion; feeding logs into `generatePlan`; FR-010; notes/RPE; S-06/S-07; Playwright; hosted `db push`; closing DEP-001–012.

## Architecture / Approach

Island → cookie JSON → `resolveWorkoutLog` against the current week → upsert `workout_logs`. Chat stub returns `log` with empty `mutations`; `sendMessage` writes the log and skips pending. Unlog is `DELETE /api/plan/logs?date=`. Generate/Accept still only touch `training_units`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | `workout_logs` + DEP-013 | Hosted DB never gets the SQL |
| 2. Pure helper + stub | Vitest-pinned copy/override and phrases | Log intent steals explain/life |
| 3. Persist and HTTP | POST/DELETE + GET `logs` + chat branch | Logging via Accept; `plan.ts`↔`chat.ts` cycle |
| 4. Calendar + chat UX | Log/Unlog + chat copy | Empty-day create; Accept on a log |

**Prerequisites:** S-02 `training_units` + calendar (on disk). S-03 chat on disk for the via-chat path.
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Production log writes fail until DEP-013; Worker rollback does not drop `workout_logs`.
- After generate, a log’s type/km may disagree with the new prescription — the badge is “what I did”, not “what is planned now”.
- Stub phrases are the first chat UX; S-07 must keep the same immediate-log write path.

## Success Criteria (Summary)

- Member logs a filled day; reload shows Logged; the plan cell is unchanged.
- Chat completion badges the day without Accept.
- Generate/Undo/Accept leave logs in place.
