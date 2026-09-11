# Drop leftover plan_propositions calendar Accept — Plan Brief

> Full plan: `context/changes/chat-drop-pending-propositions/plan.md`

## What & Why

Calendar chat edits already auto-apply on Send. The old `plan_propositions` pending row can still win `POST /api/chat/accept` over the new profile/freeze pending table, so Accept can apply a stale week instead of rest days / freeze dates. Remove that leftover layer without removing the `Accept profile & freeze changes` card.

## Starting Point

`acceptProposition` in `src/lib/services/chat.ts` loads `plan_propositions` first. Only if that is null does it call `acceptPendingProfileFreeze`. GET `/api/chat` still returns `proposition`. `rejectPending` still runs on Send, unit edit, undo, and restore. The UI no longer shows calendar Accept/Reject. Profile/freeze uses `chat_profile_freeze_pending` + the same Accept route + `POST /api/chat/dismiss`.

## Desired End State

Accept applies only profile/freeze pending. GET chat does not return a calendar `proposition`. Stale `plan_propositions` rows cannot be applied. Ordinary km/type chat edits still auto-apply. Dismiss still clears profile/freeze only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Keep Accept HTTP path | Reuse `POST /api/chat/accept` for profile/freeze only | Narrowest change; UI already posts there | Plan |
| Drop calendar reject | Remove `POST /api/chat/reject` and `rejectProposition` | No UI; leftover API is the bug class | Plan |
| GET payload | Stop returning `proposition` | PlanChat does not render calendar pending; drop workspace state in the same change | Plan |
| Table drop | Drop `plan_propositions` in the same change + **DEP-030** for hosted | Leaving the table keeps the landmine; Worker rollback does not undo SQL | Unattended |
| Empty Accept error | `NO_PENDING_PROFILE_FREEZE` | UI never reads `NO_PENDING_PROPOSITION` | Unattended |
| Harness after DROP | Retire `plan_propositions` from `OWNER_READABLE_TABLES` / `DISTINCTIVE_SEEDS` in the same phase as the SQL | Otherwise `migrateOverFixture` fails payloadDiff / missingSelectOwn | Unattended |
| FR-006 | Closed for calendar chat; profile/freeze Accept is the remaining gated path | Human 2026-09-03 promotion of FU-125 | Plan |

## Scope

**In scope:** service/API/UI wiring that still reads or writes calendar pending propositions; tests; SQL drop + DEP-030.

**Out of scope:** changing profile/freeze Accept UX; auto-apply for km/type; coach prompt; threads; hosted `db push` in this change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Accept is profile/freeze only | `acceptProposition` never applies `plan_propositions` | Breaking the profile/freeze card |
| 2. Remove calendar pending I/O | No GET `proposition`, no rejectPending, no reject route | Missed call site still writing pending rows |
| 3. Drop table + tests | Migration + memory-supabase + DEP | Hosted apply forgotten |

## Success Criteria (Summary)

- Clicking Accept with only a profile/freeze pending row applies that patch even if an old `plan_propositions` pending row exists (until the table is gone: ignore those rows).
- Plan-only chat turns still persist without Accept.
- No `/api/chat/reject`. GET `/api/chat` has no `proposition` field.
