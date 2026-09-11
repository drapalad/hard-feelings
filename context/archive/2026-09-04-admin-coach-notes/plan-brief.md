# Admin coach notes — Plan Brief

> Full plan: `context/changes/admin-coach-notes/plan.md`
> Research: `context/changes/admin-coach-notes/research.md`

## What & Why

Admins need a project-wide coaching cue that lands in every member LLM completion, not only on first-pass and not on `profiles`. This slice adds `project_settings.coach_notes`, an Admin textarea, and `Admin coach notes:` in `systemPrompt` on first-pass and extra follow-up. Option (a) only.

## Starting Point

`project_settings` stores only `openai_model`. PATCH/GET admin settings are model-only; `/admin` 404s for non-admins. `systemPrompt` already injects `Member coach notes:` from `profiles.coach_notes`. Both complete calls in `completeSendTurn` share `firstRequest`.

## Desired End State

Admin types **Coach notes (all members)**, saves, reloads, and sees the text. Every member OpenAI completion (including extra follow-up) gets `Admin coach notes:` when non-empty. Members cannot see or edit the field. Member notes injection and isAdmin 404 stay.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| Storage | `project_settings.coach_notes text` (option a) | Locked; env `COACH_ADMIN_NOTES` is out | Plan |
| Empty column | SQL NULL | Matches `profiles.coach_notes` / last-race unset; GET `null` → UI `""` | Unattended |
| Save UX | One Save (existing **Save model**) sends `openaiModel` + `coachNotes` | Same PATCH resource; picker input/datalist unchanged | Unattended |
| Over-length | Clamp `slice(0, 2000)`, do not 400 | Notes say server-clamp; same as member notes | Plan |
| PATCH omit | `coachNotes` optional; omitted key does not write the column | Existing model-only tests and Save-model-without-touching-notes | Plan |
| GET payload | Keep model fields; add `coachNotes` | Notes S-02.2; `isSettingsPayload` still requires `resolvedModel` | Plan |
| Inject plumbing | `LlmProposeRequest.adminCoachNotes`; load in `completeSendTurn` | `completeOpenAiPropose` has no Supabase client; extra call spreads `firstRequest` | Plan |
| Member inject | Keep `Member coach notes:` | HEAD must not regress `user-coach-notes` | Plan |
| RLS | No new policies | Locked; existing admin write / authenticated select cover the column | Plan |
| Hosted apply | DEP-026 | Worker rollback does not undo SQL; test-plan §6.5 | Plan |

## Scope

**In scope:** migration `20260904120100_project_coach_notes.sql`; llm-settings get/set; GET/PATCH `coachNotes`; Admin textarea + SSR seed; inject on every member completion.

**Out of scope:** env option (b); `profiles.coach_notes`; model picker changes; dropping isAdmin 404; new RLS; hosted `db push`; Playwright; HEAD lint in training-load / pace-estimate.

## Architecture / Approach

Singleton column → admin PATCH/GET → island textarea. Member send: `completeSendTurn` SELECTs notes once, sets `adminCoachNotes` on `firstRequest`, `systemPrompt` appends the line. Extra follow-up inherits via `{ ...firstRequest, extra }`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --------- | ---------------------- | ------------------------- |
| 1. Migration + API | Column + GET/PATCH contracts | Model-only PATCH wiping notes |
| 2. Admin UI | Textarea seeded and saved | Dropping isAdmin 404 |
| 3. Inject | First-pass and extra both get the line | Dropping Member inject / first-pass-only |

**Prerequisites:** `user-coach-notes` already on this HEAD (`Member coach notes:`).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Hosted column missing until DEP-026 — production notes Save 500s; model-only PATCH that omits `coachNotes` stays safe.
- Authenticated members can SELECT `project_settings` (existing policy, including the new column). Notes forbid new RLS; the textarea remains admin-only in UI.
- Repo-wide `npm run lint` is red at HEAD; gates use touched-file eslint.

## Success Criteria (Summary)

- Admin textarea persists global text across reload
- Every member completion with non-empty notes includes `Admin coach notes:`
- `Member coach notes:` and isAdmin 404 still work
