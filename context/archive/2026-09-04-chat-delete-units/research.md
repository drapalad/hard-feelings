---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "chat-delete-units: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
last_updated_note: "incomingForWeek in-horizon vs out-of-horizon leftover DELETE"
---

# Research: chat-delete-units

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `UnitMutation` is `{ date, type?, distanceKm?, structure? }` — no `delete` (`src/types.ts:115-120`). Propose zod/JSON requires `date, type, distanceKm, structure` with type/km/structure nullable (`src/lib/services/openai-chat.ts:57-66`, `:85-96`).
- `sanitizeProposeResult` omits null type/km (only copies when non-null) (`src/lib/services/propose-adaptation.ts:105-115`). `applyMutations` then uses `??` so missing fields keep the existing unit; it never `Map.delete`s a date (`src/lib/services/plan-adaptation.ts:7-51`).
- `replaceWeek` DELETEs ISO-week dates missing from the incoming list (`src/lib/services/plan.ts:296-305`) via `training_units` + `training_units_delete_own` (`supabase/migrations/20260813130000_training_units.sql:34-36`).
- `incomingForWeek` (`src/lib/services/chat.ts:694-718`): if the persist week does **not** overlap the create horizon, it returns proposed filtered to that week only (`:703-704`). If it **does** overlap, it seeds existing units **outside** the horizon (`:708-711`) then overlays proposed dates in the week (`:713-716`). Omitting an **in-horizon** date is not re-copied from existing, so `replaceWeek` leftover DELETE can remove it — but only after `applyMutations` actually drops that date from proposed. Omitting an **out-of-horizon** date does not persist a removal.
- Day panel has Edit / Save / Cancel / Log / Freeze; no Delete control (`src/components/plan/PlanCalendar.tsx:280-450`). Prompt: “Never emit a full replacement week.” (`src/lib/services/openai-chat.ts:318`).

## Code References

- `src/types.ts:115-120` - UnitMutation
- `src/lib/services/openai-chat.ts:57-77` - parsedProposeSchema
- `src/lib/services/openai-chat.ts:318` - Never emit a full replacement week
- `src/lib/services/propose-adaptation.ts:81-116` - sanitize drops null type/km
- `src/lib/services/plan-adaptation.ts:7-51` - applyMutations upsert/create only
- `src/lib/services/plan-adaptation.ts:17-18` - skip frozen
- `src/lib/services/plan.ts:279-308` - replaceWeek leftover DELETE
- `src/lib/services/chat.ts:646-661` - persistProposedUnits → incomingForWeek → replaceWeek
- `src/lib/services/chat.ts:694-718` - incomingForWeek keep-outside-horizon
- `src/components/plan/PlanCalendar.tsx:280-450` - DayPanel controls
- `src/lib/services/plan-adaptation.test.ts` - applyMutations / gateByIsoWeek tests exist
- `src/lib/services/propose-adaptation.test.ts:149` - sanitizeProposeResult tests

## Architecture Insights

Chat persist is week-shaped: `replaceWeek` leftover DELETE already works for dates absent from incoming. The blocker is (1) `applyMutations` never drops a date, so proposed still contains it, and (2) `incomingForWeek` re-fills dates **outside** the 14-day horizon from `listWeek`. Frozen skip is already in `applyMutations`. Send auto-applies mutations and `rejectPending`s leftover `plan_propositions` (`src/lib/services/chat.ts:344`); there is no unit DELETE HTTP method.

## Open Questions

- Test harness for persist DELETE + `incomingForWeek` (chat persist tests in `src/lib/services/chat.test.ts` / `accept-proposition.test.ts` — not fully enumerated here).
- Day-panel Delete write path: `PUT /api/plan/units` is edit (`src/pages/api/plan/units.ts:35-71`); there is no unit DELETE route. Whether Delete should call chat persist, a new method, or `replaceWeek` directly is unchecked.
- `PlanCalendar.test.ts` source-scan of panel controls (`:135-144`) will need a Delete assertion if the button is added.
- No new table; RLS for DELETE own not re-verified hosted.
