---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "coach-races-context-accept: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
last_updated_note: "Accept still prefers leftover plan_propositions; Dismiss does not"
---

# Research: coach-races-context-accept

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- First-pass does not call `listRaces`. `sendMessage` passes profile + `currentLoad` only (`src/lib/services/chat.ts:289-314`). `listRaces` runs in `fetchCoachExtra` after `dataRequest` (`:584-595`). Extra prompt injects `Range races JSON` (`src/lib/services/openai-chat.ts:344-346`). Profile JSON has no races (`src/types.ts:36-43`).
- Propose schema has mutations, log, dataRequest, profile, freeze, unfreeze — no `races` (`src/lib/services/openai-chat.ts:57-77`, `:79-147`).
- `listRaces` / `insertRace` / `updateRace` / `deleteRace` exist; `validateRaceList` is one A + unique date (`src/lib/services/races.ts:95-172`, `src/lib/services/profile-races.ts:71-91`).
- Pending store `chat_profile_freeze_pending` has `profile_patch`, `freeze_dates`, `unfreeze_dates` — no `races_patch` (`supabase/migrations/20260903123000_chat_profile_freeze_pending.sql:4-15`). `PendingProfileFreeze` type matches (`src/types.ts:156-162`).
- Review card is “Accept profile & freeze changes” (`src/components/plan/PlanChat.tsx:214-216`); no race-mutation UI and no calendar `plan_propositions` Accept card. `POST /api/chat/accept` → `acceptProposition` **loads `plan_propositions` first** and only then `acceptPendingProfileFreeze` (`src/pages/api/chat/accept.ts:27`, `src/lib/services/chat.ts:387-398`). A leftover calendar proposition therefore wins over profile/freeze pending. `POST /api/chat/dismiss` dismisses only `chat_profile_freeze_pending` (`src/pages/api/chat/dismiss.ts:26`) — it does not touch `plan_propositions`. `PlanWorkspace` keeps `proposition` state with a discarded setter and does not pass it into PlanChat (`src/components/plan/PlanWorkspace.tsx:253`).

## Code References

- `src/lib/services/chat.ts:289-314` - first-pass payload
- `src/lib/services/chat.ts:584-595` - fetchCoachExtra listRaces
- `src/lib/services/openai-chat.ts:57-77` - parsedProposeSchema
- `src/lib/services/openai-chat.ts:322-346` - profile/freeze prompt + extra races JSON
- `src/lib/services/races.ts:95-172` - list/insert/update/delete
- `src/lib/services/profile-races.ts:71-91` - validateRaceList
- `src/types.ts:156-162` - PendingProfileFreeze
- `supabase/migrations/20260903123000_chat_profile_freeze_pending.sql:4-38` - pending table + own RLS
- `src/components/plan/PlanChat.tsx:214-236` - Accept card fields
- `src/pages/api/chat/accept.ts:10-27` - acceptProposition
- `src/pages/api/chat/dismiss.ts:9-26` - dismissPendingProfileFreeze
- `src/lib/services/chat.ts:387-398` - acceptProposition prefers plan_propositions then profile/freeze
- `src/components/plan/PlanWorkspace.tsx:253-254` - proposition setter discarded; pendingProfileFreeze state
- `context/changes/chat-drop-pending-propositions/change.md` - planned change also owns accept/dismiss / plan_propositions

## Architecture Insights

Races are a first-class table with writes and invariants already used by SetupForm (POST/PATCH `/api/races`, not profile). Coach only sees them after a `dataRequest`. Accept is a dual-purpose route: leftover `plan_propositions` first, else profile/freeze pending. Extending the same pending row with `races_patch` rides the **fallback** path — a stale calendar proposition would still steal Accept until `chat-drop-pending-propositions` (status planned) lands or this change also skips empty leftover props. Dismiss cannot clear a leftover calendar row.

## Open Questions

- Test harness / migrate path for `races_patch jsonb` on `chat_profile_freeze_pending` (filename list; ADD COLUMN; memory-supabase pending rows).
- Sequencing vs `chat-drop-pending-propositions` (same `accept.ts` / `dismiss.ts` / pending store). That id is not in this pack’s twelve changes.
- How the review card lists add/remove/patch next to weekly-km lines (`PlanChat.tsx:217-235`).
- `PlanWorkspace.tsx` applyChatBody pendingProfileFreeze (`:288-290`) — whether a races pending field rides the same JSON key.
- Hosted RLS not re-verified.
