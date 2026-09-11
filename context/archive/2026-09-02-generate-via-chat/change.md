---
change_id: generate-via-chat
title: Generate next 14 days via coach chat, not the algorithm
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/components/plan/plan-month.ts` (button labels), `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/lib/services/openai-chat.ts` (`systemPrompt`, sanitize), `src/lib/services/chat.ts` (`sendMessage`), `src/lib/services/propose-adaptation.ts` (`sanitizeProposeResult`), `src/lib/services/plan-adaptation.ts` (`applyMutations`). Source-scan tests in `PlanCalendar.test.ts`, `PlanChat.test.ts`, `PlanWorkspace.test.ts`. **Keep** `src/lib/services/generate-plan.ts` and `POST /api/plan` in the repo; this UI must not call them.

Human override on the original hide-the-button idea: the purple button **stays**. It must not run `generatePlan`. It triggers coach chat to lay out or regenerate the next 14 days.

### Today

`generatePlanButtonLabel` is **Generate plan** / **Regenerate week** keyed off the active ISO week. The button POSTs `/api/plan` `{ weekStart }`. `generatePlan` fills that Monday–Sunday by splitting `weeklyKm` and cycling types; no `structure`. Chat textarea and Send are `disabled` when `unitsEmpty`. `sendMessage` returns `PLAN_EMPTY` if the week has no units. `systemPrompt` says only mutate dates that already exist. `sanitizeProposeResult` drops mutations whose date is not already in `units`. `applyMutations` skips unknown dates. Helper copy is “Ask about a day, request a change, or log a run.”

### Do

1. **Button copy.** Busy → **Working...**; else if any unit date is in the UTC-today … today+13 window → **Regenerate next 14 days**; else **Generate next 14 days**. Do not key the label off the active ISO week alone.

2. **Click.** Do **not** `POST /api/plan`. Start a coach turn equivalent to sending: lay out (or regenerate) the next 14 days from UTC today, keeping frozen dates. Prefill+submit or a dedicated `sendMessage` from `onGenerate` is fine; the member must not have to type that prompt. Show busy on both calendar and chat like a normal Send.

3. **Ungate chat.** Do not disable textarea/Send on `unitsEmpty`. Remove “Generate a plan for this week before chatting.” Drop `PLAN_EMPTY`. Helper under Coach chat: `Ask the coach to lay out the next 10–14 days.` (Keep a short second line about asking what a day is for / logging if you need it; do not restore the old bounds lecture.)

4. **Create units in range.** Allow the model to **create** units on dates in UTC today … today+13 (inclusive), not only mutate existing dates. Update the system prompt. Keep mutations whose date is in that range even if no unit exists yet. `applyMutations` must insert a new unit when `type` and `distanceKm` are set (still skip frozen). Do not emit a full replacement of dates outside that window.

5. Leave `generatePlan.ts` and generate POST in the repo unused from this UI. Do not extend `GenerateInput` with a 14-day algorithmic fill in this change.

6. Keep Accept/Reject in this change if they still exist when this ships (`chat-auto-apply` removes them later). Do not auto-apply here.

### Do not

- Delete `generatePlan.ts` or `POST /api/plan`.
- Fill the calendar with hardcoded 14-day fixtures.
- Change Profile, races overlay, cell density, or snapshot POST.
- Teach the algorithm to honor long-run / rest / mix prefs (those persist-only changes are separate).

### Visible

Purple button still there, labeled for the next 14 days. Click talks to the coach; empty calendar + usable composer; two week-rows can fill from chat rather than round-robin `generatePlan`.

### Sequencing

After `calendar-month-polish` (toolbar + Save snapshot stay; this only retargets the purple button). Do not run in parallel with `chat-auto-apply` or `coach-data-request` (`PlanChat` / `chat.ts` / `openai-chat.ts`). Before `training-load-chart` (`PlanCalendar.tsx`).
