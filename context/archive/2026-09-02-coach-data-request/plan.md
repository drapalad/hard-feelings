# Coach allowlisted extra context Implementation Plan

## Overview

Give the coach a richer first completion (structure, races, last 14 days of logs, existing weeklyKm) on the same 14-day create window as generate-via-chat, let the model request at most one allowlisted extra fetch, and show a muted Loaded chip for keys that actually loaded. Auto-apply stays; Accept stays gone.

## Current State Analysis

`completeOpenAiPropose` (`src/lib/services/openai-chat.ts`) builds `systemPrompt` from `request.units` as `{ date, type, distanceKm, frozen }` — no `structure`. `LlmProposeRequest` has week units, `weeklyKm`, history, and the create horizon; it has no races or logs. The strict propose JSON schema requires `reply`, `mutations`, and `log` only. The model cannot ask for more JSON.

`sendMessage` (`src/lib/services/chat.ts`) already unions the open week with `listRange(createFrom, createTo)` (`utcToday` through `utcToday+13`) and passes that plus `weeklyKm` into `proposeAdaptation` / `complete`. It calls `getProfile` for km validation only. It does not call `listRaces` or `listLogsRange`. A stub `complete` (tests and unkeyed production) never sees extra context. `ProposeCompleteFn` returns `ProposeResult` (`reply` / `mutations` / `log`); `proposeAdaptation` re-sanitizes and would drop any extra field.

`POST /api/chat/messages` (`src/pages/api/chat/messages.ts`) spreads `result.data` into `jsonOk`. `PlanWorkspace.send` `applyChatBody`s messages/logs and may merge `units`; it does not keep per-turn metadata. `PlanChat` renders each message as a `<p>` with no chip. `ChatMessage` has no loaded-keys column. Test-plan §6: colocated Vitest + `readFileSync` source-scans; Playwright is not a suite.

Helpers already exist: `listLogsRange` (`workout-log.ts`), `listRange` (`plan.ts`), `listRaces` (`races.ts`), `getProfile` (`profile.ts`), `addUtcDays` / `utcToday`.

### Key Discoveries:

- Units from `listWeek` / `listRange` already carry `structure` when the row has one (`plan.ts` `UNIT_COLUMNS`). The gap is serialization in `systemPrompt`, not persist.
- `proposeAdaptation` swallows `complete` throws into `COACH_UNAVAILABLE_REPLY` and returns only `ProposeResult`. Two-pass needs `sendMessage` to call `complete` directly so `dataRequestKeys` survive, then `sanitizeProposeResult`.
- `PlanChat` / `PlanWorkspace` are React islands. They must not import `openai-chat.ts` (OpenAI fetch). Chip labels live in `PlanChat`; the API returns allowlisted key ids.
- Existing `openai-chat.test.ts` fixtures omit `dataRequest`. Once the strict schema requires it, those payloads must send `dataRequest: null` or they fail `parsedProposeSchema`.
- `messages.ts` already spreads `result.data`. Putting `loadedKeys` on `SendMessageResult.data` is enough for the JSON body if the island reads it.

## Desired End State

On a keyed Send, the first completion’s system prompt includes unit `structure` (null when absent), `listRaces` JSON, last-14-day logs (`listLogsRange(utcToday−13, utcToday)`), `weeklyKm`, and the same create window already passed (`createFrom`/`createTo`). The model may set `dataRequest.keys` to a subset of `logs_42d`, `prior_plan_14d`, `races`, `profile`, or `null`. The server drops unknown keys and duplicates; if none remain, it does not call the model again. Otherwise it fetches those payloads, runs exactly one second completion with that JSON in the system prompt (same history), and ignores a further `dataRequest`. After a successful extra load, `POST /api/chat/messages` includes `loadedKeys` for that turn; a muted chip under the last assistant bubble reads `Loaded: ` plus comma-joined labels (e.g. `Loaded: last 42 days of logs`). Reload has no chip (nothing persisted on `chat_messages`). Auto-apply, hard skip, and missing Accept/Reject stay as `chat-auto-apply`. Unkeyed / stub Send does not extra-fetch and shows no chip.

## What We're NOT Doing

- POST from the UI for extra data; a `chat_messages` (or other) migration; changing `generatePlan` / the purple canned prompt; adding Profile fields.
- Reverting auto-apply or reintroducing Accept/Reject / Proposed changes.
- Arbitrary fetches or SQL from model-supplied strings; new allowlist keys; looping completions.
- A hardcoded transcript fixture.
- Playwright / jsdom / Testing Library; `"use client"`; concatenating Tailwind with `+`.
- Closing FU-094, FU-095, FU-104, FU-114–FU-121, or DEP-020. Stamping roadmap done. Writing `lessons.md`.

## Implementation Approach

Extend `LlmProposeRequest` and the propose JSON schema in `openai-chat.ts`, export an allowlist filter, and serialize first-pass plus optional extra JSON in `systemPrompt`. In `sendMessage`, when `complete` is provided, load first-pass context, call `complete` once, filter `dataRequestKeys`, fetch extras, and at most once call `complete` again with `extra` set. Return `loadedKeys` on the send payload. Wire a session-only chip in `PlanChat` from `PlanWorkspace` after Send. Stub / unkeyed path stays `proposeAdaptation` without the extra queries.

LOCKED: `change.md` Notes (files, schema, allowlist, windows, chip, no migration / no UI POST / no Accept).

## Critical Implementation Details

**Call `complete` from `sendMessage`, not through `proposeAdaptation`, when a completer is passed.** `proposeAdaptation` would drop `dataRequestKeys`. Keep today’s first-throw behavior: log and use `COACH_UNAVAILABLE_REPLY` with empty mutations. Run `sanitizeProposeResult` on the raw complete output (horizon included) before apply/log persist. Unkeyed Send still uses `proposeAdaptation` / the stub and does **not** call `listRaces` / `listLogsRange` for the prompt.

**Never loop.** Second `complete` may still emit `dataRequest` (strict schema requires the field). Do not fetch or complete a third time.

**Second-complete failure.** If extra fetches leave zero allowlisted keys, skip the second call. If a per-key fetch throws, omit that key. If the second `complete` throws, keep the sanitized first result and return no `loadedKeys` (the visible reply did not use the extra JSON). Recorded as FU-122.

**Chip is session-only.** `loadedKeys` on the Send JSON only. `GET /api/chat` does not return it. Clear on the next Send start; set from that response. Format in `PlanChat` (`Loaded: ` + labels). Do not import `openai-chat.ts` from the island.

---

## Phase 1: Schema, allowlist, and prompt context

### Overview

The propose schema accepts `dataRequest`; the prompt can serialize first-pass and extra JSON; unknown keys never survive the allowlist.

### Changes Required:

#### 1. Allowlist + request shape

**File**: `src/lib/services/openai-chat.ts`

**Intent**: One exported filter is the only place model-supplied key strings become fetches.

**Contract**: Allowlist exactly `logs_42d`, `prior_plan_14d`, `races`, `profile`. `filterAllowlistedKeys(keys: string[]):` drop unknown, drop duplicates (first wins), preserve first-seen order. `LlmProposeRequest` gains optional `races`, `logs` (14-day first pass), and `extra` (`logs42d`, `priorPlan`, `races`, `profile`). `completeOpenAiPropose` returns `ProposeResult & { dataRequestKeys: string[] }` (filtered; empty when `dataRequest` is null or nothing remains).

#### 2. Strict JSON schema + zod

**File**: `src/lib/services/openai-chat.ts`

**Intent**: The model can ask for extra JSON or explicitly skip.

**Contract**: `dataRequest` is required on the object. Value is `null` or `{ keys: string[] }` (`additionalProperties: false`, `keys` required). Zod matches. Existing completion fixtures must include `dataRequest: null` (or a keys object) or they fail parse.

#### 3. `systemPrompt`

**File**: `src/lib/services/openai-chat.ts`

**Intent**: First pass is not week-only; a second pass can attach extra JSON without a new schema.

**Contract**: Week JSON includes `structure` (`unit.structure ?? null`). Prompt includes `weeklyKm`, races JSON when `races` is set, 14-day logs JSON when `logs` is set, create-window text already present, and the four allowlisted key names (set `dataRequest` to null when unused). When `extra` is set, append that JSON and tell the model this is the follow-up (still emit `dataRequest`, typically null).

### Success Criteria:

#### Automated Verification:

- `filterAllowlistedKeys` drops unknown keys and duplicates; empty input / null-equivalent yields `[]`
- `npx vitest run src/lib/services/openai-chat.test.ts`: fixtures include `dataRequest`; a null request yields `dataRequestKeys: []`; known keys pass through; system prompt contains `structure`, races, logs, and the allowlist names when those fields are set
- `npm run lint`

---

## Phase 2: Two-pass `sendMessage` and `loadedKeys`

### Overview

Keyed Send loads first-pass context, optionally fetches extras once, and returns `loadedKeys` without persisting them.

### Changes Required:

#### 1. `ProposeCompleteFn` request/result

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: The messages-route completer and test stubs share the same request shape as `LlmProposeRequest`.

**Contract**: Completer request may include `races`, `logs`, `extra`. Return may include `dataRequestKeys?: string[]`. Export `toRawProposeResult` so `sendMessage` can `sanitizeProposeResult(toRawProposeResult(raw), units, horizon)` after each `complete` (stubs skip `completeOpenAiPropose`’s sanitize). Stub path unchanged. Do not run the two-pass loop inside `proposeAdaptation`.

#### 2. First-pass context + second completion

**File**: `src/lib/services/chat.ts`

**Intent**: The open 14-day window and extra allowlisted JSON reach the model; Send persist/auto-apply is unchanged.

**Contract**: When `deps.complete` is set: `listRaces`; `listLogsRange(utcToday−13, utcToday)`; pass unioned week+horizon units (already), `weeklyKm`, `createFrom`/`createTo` (already). After first `complete` + `sanitizeProposeResult`, `filterAllowlistedKeys` on `dataRequestKeys`. Fetch: `logs_42d` → `listLogsRange(utcToday−41, utcToday)`; `prior_plan_14d` → `listRange(addUtcDays(createFrom, -14), addUtcDays(createFrom, -1))`; `races` → `listRaces`; `profile` → `getProfile` (existing row; no new fields). At most one second `complete` with `extra` filled. Every ok `sendMessage` includes `loadedKeys: string[]` (empty when nothing extra loaded or `complete` is unset). Non-empty only for keys that fetched and whose second completion succeeded. When `complete` is unset: no extra `listRaces` / `listLogsRange` for the prompt. Auto-apply / hard skip / log-only / explain-only stay as today.

#### 3. Send JSON

**File**: `src/lib/services/chat.ts`, `src/pages/api/chat/messages.ts`

**Intent**: The island can show a chip for this turn without a new column.

**Contract**: `SendMessageResult` ok data always includes `loadedKeys: string[]`. `jsonOk` continues to spread `result.data`. No new route. No UI POST.

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/lib/services/chat.test.ts`: first `complete` request includes `createFrom`/`createTo` (existing), `races`, 14-day `logs`, and unit `structure` when seeded; allowlisted `dataRequestKeys` trigger exactly one second `complete` whose `extra` matches the fetches; unknown-only keys do not call `complete` again; successful extra load returns those `loadedKeys`; second `complete` throw keeps the first reply and does not return those keys
- Source-scan `src/pages/api/chat/messages.ts`: still spreads `result.data`; does not add a second fetch from the client
- Auto-apply tests still pass (empty-hard persists, hard does not, no pending, no revision, no Accept 409 on messages)
- `npm run lint`

---

## Phase 3: Loaded chip

### Overview

A muted chip under the last assistant message shows what this Send loaded. Reload does not keep it.

### Changes Required:

#### 1. Chip copy + render

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: The member can see extra context was pulled; the transcript stays the stored messages.

**Contract**: Optional `loadedKeys?: string[]`. Export `formatLoadedChip(keys: string[]): string | null` — `Loaded: ` + comma-joined labels for known keys, first-seen order, skip unknown/duplicates, `null` when none. Labels: `logs_42d` → `last 42 days of logs`; `prior_plan_14d` → `prior 14 days of the plan`; `races` → `races`; `profile` → `profile`. Render that string in a muted `<p>` (`text-xs` + existing muted blue, e.g. `text-blue-100/50`) **under** the last assistant bubble (sibling, not inside the bubble). No chip when null/empty. Do not import `openai-chat.ts`. Use `cn()` if combining classes. No Accept/Reject.

#### 2. Session wiring

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Chip follows the Send that loaded data, not GET chat.

**Contract**: Session state from the Send JSON `loadedKeys` (string array). Clear at the start of `send()`. Pass into `PlanChat`. Do not POST for extra data. Do not call `/api/chat/accept` or `/api/chat/reject`. Week-switch / month load that replaces messages should clear the chip (no keys on GET).

### Success Criteria:

#### Automated Verification:

- `npx vitest run src/components/plan/PlanChat.test.ts`: `formatLoadedChip(["logs_42d"])` is `Loaded: last 42 days of logs`; multiple keys join with `, `; unknown-only is `null`; source contains muted chip classes, `formatLoadedChip`, and does not contain Accept/Reject / Proposed changes
- `npx vitest run src/components/plan/PlanWorkspace.test.ts`: workspace passes `loadedKeys` into `PlanChat`; `send` reads `loadedKeys` from the messages response; still no accept/reject fetches; still no extra data POST
- `npm test`
- `npm run lint`

#### Manual Verification:

- On `/dashboard` Calendar with a live coach key, Send a turn that needs extra history; a muted `Loaded: …` chip appears under the last assistant message; reload leaves the transcript and drops the chip; no Accept/Reject

---

## Testing Strategy

### Unit Tests:

- `filterAllowlistedKeys` (unknown, duplicates, empty)
- `completeOpenAiPropose` schema + prompt contents + `dataRequestKeys`
- `sendMessage` first-pass fields, second-call cap, `loadedKeys` vs second-throw
- `formatLoadedChip` copy

### Integration Tests:

- Memory-supabase seeds for races / logs / prior units / profile so first- and second-pass fetches are real `list*` calls (do not mock persist services — test-plan §6.2)

### Manual Testing Steps:

1. Open `/dashboard` Calendar with `OPENAI_API_KEY` set, send a coach message that should pull extra logs, confirm the muted Loaded chip under the last assistant reply.
2. Reload: messages remain, chip is gone.
3. Confirm Send still auto-applies when hard is empty and still shows the red list when hard blocks; no Accept/Reject.

## Performance Considerations

First keyed Send adds `listRaces` + a 14-day `listLogsRange`. A data request adds at most those four reads and one extra OpenAI completion (existing 20s timeout). Unkeyed Send adds no extra queries.

## Migration Notes

None. No SQL. `loadedKeys` is response-only.

## References

- Locked notes: `context/changes/coach-data-request/change.md`
- Prior slice: `context/changes/chat-auto-apply/`
- Helpers: `src/lib/services/workout-log.ts` (`listLogsRange`), `src/lib/services/plan.ts` (`listRange`), `src/lib/services/races.ts` (`listRaces`), `src/lib/services/profile.ts` (`getProfile`)
- Test-plan §6: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, allowlist, and prompt context

#### Automated

- [x] 1.1 `filterAllowlistedKeys` drops unknown keys and duplicates; empty input / null-equivalent yields `[]` — 20fb6f6
- [x] 1.2 `npx vitest run src/lib/services/openai-chat.test.ts`: fixtures include `dataRequest`; a null request yields `dataRequestKeys: []`; known keys pass through; system prompt contains `structure`, races, logs, and the allowlist names when those fields are set — 20fb6f6
- [x] 1.3 `npm run lint` — 20fb6f6

### Phase 2: Two-pass `sendMessage` and `loadedKeys`

#### Automated

- [x] 2.1 `npx vitest run src/lib/services/chat.test.ts`: first `complete` request includes `createFrom`/`createTo` (existing), `races`, 14-day `logs`, and unit `structure` when seeded; allowlisted `dataRequestKeys` trigger exactly one second `complete` whose `extra` matches the fetches; unknown-only keys do not call `complete` again; successful extra load returns those `loadedKeys`; second `complete` throw keeps the first reply and does not return those keys — 6dc9e2f
- [x] 2.2 Source-scan `src/pages/api/chat/messages.ts`: still spreads `result.data`; does not add a second fetch from the client — 6dc9e2f
- [x] 2.3 Auto-apply tests still pass (empty-hard persists, hard does not, no pending, no revision, no Accept 409 on messages) — 6dc9e2f
- [x] 2.4 `npm run lint` — 6dc9e2f

### Phase 3: Loaded chip

#### Automated

- [x] 3.1 `npx vitest run src/components/plan/PlanChat.test.ts`: `formatLoadedChip(["logs_42d"])` is `Loaded: last 42 days of logs`; multiple keys join with `, `; unknown-only is `null`; source contains muted chip classes, `formatLoadedChip`, and does not contain Accept/Reject / Proposed changes — d81814a
- [x] 3.2 `npx vitest run src/components/plan/PlanWorkspace.test.ts`: workspace passes `loadedKeys` into `PlanChat`; `send` reads `loadedKeys` from the messages response; still no accept/reject fetches; still no extra data POST — d81814a
- [x] 3.3 `npm test` — d81814a
- [x] 3.4 `npm run lint` — d81814a

#### Manual

- [x] 3.5 On `/dashboard` Calendar with a live coach key, Send a turn that needs extra history; a muted `Loaded: …` chip appears under the last assistant message; reload leaves the transcript and drops the chip; no Accept/Reject
