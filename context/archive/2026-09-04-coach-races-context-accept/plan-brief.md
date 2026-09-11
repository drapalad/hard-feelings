# Coach races context + Accept-gated writes — Plan Brief

> Full plan: `context/changes/coach-races-context-accept/plan.md`
> Research: `context/changes/coach-races-context-accept/research.md`

## What & Why

Coach first-pass never sees the `races` table (only Profile JSON), so a distant-race ask is refused as “no field.” This slice injects compact race JSON on every first-pass, extends propose JSON with `races: { add, remove, patch }`, and Accept-gates persist on `chat_profile_freeze_pending.races_patch` — the same card as profile/freeze. Calendar km/type still auto-apply.

## Starting Point

`listRaces` runs only after `dataRequest`. Propose schema has mutations/log/profile/freeze, not races. Pending table has `profile_patch` / freeze arrays. Accept prefers leftover `plan_propositions` then profile/freeze. `insertRace` / `updateRace` / `deleteRace` + `validateRaceList` already exist.

## Desired End State

A distant-race ask shows an Accept card (`Add race: Spring HM · 12 Apr 2027 · A`), not a profile-field refusal. First-pass cites upcoming/A races and never claims Profile holds races. Accept writes via existing race services; Dismiss does not. Send never writes `races`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Pending store | `races_patch jsonb` on `chat_profile_freeze_pending`; no `chat_race_pending` | Same Accept/Dismiss as profile/freeze; existing own-row RLS | Research |
| Option | (a) first-pass JSON + propose races + Accept persist; not S-09.5 | Locked Notes; S-09.5 is the rejected skip | Research |
| Compact set | Upcoming (`date >= today`) plus A-priority with a non-empty `goal`; fields `id, date, priority, name, goal` | Matches S-09.1; not sliced to chat week or `dataRequest` | Plan |
| Sanitize companion | Extend `propose-adaptation.ts` `ProposeResult` so races survive `completeSendTurn` | Notes omitted the file; sanitize drops unknown fields | Unattended |
| Accept apply order | Unknown ids fail before writes; `validateRaceList` on projected list; then profile/freeze; then remove → patch → add | `insertRace` re-validates the live table; adding a new A before demoting/removing the old A fails; missing ids must not leave a half-applied profile | Unattended |
| Review card heading | Keep `Accept profile & freeze changes`; add race lines on the same card | Notes say same pattern as profile/freeze; races-only still uses that heading | Unattended |
| Leftover calendar Accept | Do not skip `plan_propositions` | Owned by `chat-drop-pending-propositions`; Notes forbid widening | Plan |

## Scope

**In scope:** S-09.1–S-09.4; migration `20260904210000_chat_profile_freeze_pending_races_patch.sql`; prompt + propose schema; pending persist; Accept writes; review card.

**Out of scope:** S-09.5; auto-apply races on Send; Profile races; SetupForm editor; finish times; Accept for km/type; new RLS; hosted apply; dropping leftover propositions.

## Architecture / Approach

`sendMessage` loads `listRaces`, compacts, passes into `systemPrompt`. LLM may return `races`; Send upserts `races_patch` and auto-applies calendar mutations only. Accept projects the next race list, validates, then reuses `deleteRace` / `updateRace` / `insertRace`. UI lists pending race lines on the existing profile/freeze card.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Column + types | `races_patch` + races-only pending rows survive load | `toPendingProfileFreeze` still nulls empty profile/freeze |
| 2. Prompt + persist | First-pass JSON, propose schema, Send stores without writing `races` | Sanitize round-trip drops `races` |
| 3. Accept + card | Writes on Accept; review lines | `insertRace` two-A failure if order is wrong |

**Prerequisites:** None. HEAD already has delete-units, iso weeks, flag technical, coach notes.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Leftover `plan_propositions` still steal Accept until `chat-drop-pending-propositions` ships.
- Card heading stays profile/freeze-oriented for races-only pending (FU-145).
- Hosted column missing until DEP-028 — Send that stores `races_patch` will 500.

## Success Criteria (Summary)

- Distant-race ask → Accept card, not “no field”
- First-pass cites upcoming/A races and does not blame Profile
- Send does not write `races`; Accept does; Dismiss does not; km/type still auto-apply
