# Coach allowlisted extra context — Plan Brief

> Full plan: `context/changes/coach-data-request/plan.md`

## What & Why

The coach prompt is a week-only brain: no `structure`, races, or logs, and no way to pull a longer window. This slice adds a richer first completion plus one allowlisted extra fetch, and a Loaded chip so the extra load is visible.

## Starting Point

`systemPrompt` serializes date/type/km/frozen. `sendMessage` already unions the 14-day create window and passes `weeklyKm`. Chat UI has no loaded-context signal. Send auto-applies; Accept/Reject are gone.

## Desired End State

Keyed Send includes structure, races, 14-day logs, and weeklyKm on the first completion. The model may request `logs_42d` / `prior_plan_14d` / `races` / `profile` once. A muted `Loaded: …` chip sits under the last assistant message for that turn only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| First-pass context | `structure` on unioned week+horizon units; `listRaces`; `listLogsRange(utcToday−13..today)`; existing `weeklyKm` + create window | Locked Notes | Plan |
| Schema | Required `dataRequest: { keys: string[] } \| null`; allowlist those four keys; drop unknown/dupes | Locked Notes | Plan |
| Second completion | At most one; extras from `listLogsRange(−41..today)`, `listRange` 14d before `createFrom`, `listRaces`, `getProfile`; ignore further `dataRequest` | Locked Notes | Plan |
| `prior_plan_14d` window | `createFrom−14` through `createFrom−1` | Open window is utcToday..+13; “14 days before” is the inclusive block immediately before it | Plan |
| First-pass races | Full `listRaces()` (already upcoming-first); no extra date filter | Locked names the function | Plan |
| Completer wiring | `sendMessage` calls `complete` directly when set; `proposeAdaptation` would drop `dataRequestKeys` | Existing sanitize wrapper only returns `ProposeResult` | Unattended |
| Unkeyed / stub Send | No extra `listRaces`/`listLogsRange` for the prompt; no chip | Stub never reads that JSON; avoid wasted queries | Unattended |
| Wiring files beyond locked core | Also `propose-adaptation.ts` (completer type), `messages.ts` (spread), `PlanWorkspace.tsx` (session chip) | Chip and `loadedKeys` cannot reach the island otherwise | Unattended |
| Second `complete` throws | Keep sanitized first reply; no `loadedKeys` | Extra JSON did not shape the visible turn; first reply is still valid | Unattended |
| Chip labels | `last 42 days of logs` / `prior 14 days of the plan` / `races` / `profile`; `Loaded: ` + `, ` join | Matches locked example; client-side map so the island does not import `openai-chat.ts` | Unattended |
| Chip persistence | Always return `loadedKeys: string[]` on ok Send (empty default); clear on next Send / week reload | Locked: no `chat_messages` column; empty array lets the island clear without a missing-field branch | Plan |
| Testing | Vitest unit + source-scan; memory-supabase for fetches; no Playwright | Locked + test-plan §6 | Plan |

## Scope

**In scope:** Prompt context, allowlisted second completion, `loadedKeys`, Loaded chip, listed tests.

**Out of scope:** UI POST for extras; migrations; generate/Profile field changes; Accept; auto-apply revert; hardcoded transcript; new allowlist keys; FU-094–121 / DEP-020.

## Architecture / Approach

Keyed `sendMessage` builds a richer `LlmProposeRequest`, calls `complete` once, filters keys, fetches extras, calls `complete` at most once more, then the existing auto-apply path. `PlanWorkspace` keeps `loadedKeys` in session and `PlanChat` formats the chip.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + prompt | `dataRequest` + allowlist + serialization | Existing OpenAI fixtures omit `dataRequest` |
| 2. Two-pass send | First-pass fetch + one extra completion + `loadedKeys` | Looping; `proposeAdaptation` dropping keys |
| 3. Chip | Session Loaded chip under last assistant | Island importing server OpenAI code |

**Prerequisites:** `chat-auto-apply` and generate-via-chat 14-day window already on this branch (`a169223`).
**Estimated effort:** ~3 phases, one unattended run.

## Open Risks & Assumptions

- Second-completion failure keeps the first reply (FU-122).
- Unkeyed local Send still will not invent extra context or a chip.
- `listRaces` includes past races; first pass does not extra-filter.

## Success Criteria (Summary)

- First keyed completion is not week-only (structure, races, 14d logs).
- Allowlisted extra fetch happens at most once; unknown keys never fetch.
- Loaded chip shows for that Send and disappears on reload; Accept stays gone.
