# LLM Chat Proposer Implementation Plan

## Overview

Replace the S-03 deterministic `proposeAdaptation` stub with a fetch-based OpenAI proposer so a signed-in member gets a model-written reply and a gated calendar diff. Accept / reject / continue and hard-bound non-acceptability stay exactly as they are. This is roadmap S-07 (US-01, FR-006, FR-007, FR-008).

## Current State Analysis

S-03 is on disk and `impl_reviewed`: `POST /api/chat/messages` → `sendMessage` → sync `proposeAdaptation({ message, weekStart, units })` → `{ reply, mutations, log? }` → `applyMutations` + `gateAccept` / `validatePlan` → pending `plan_propositions` or `upsertLog`. Accept re-validates the stored full-week snapshot and 409s on hard. `PlanChat` is request/response JSON (no stream). `PROTECTED_ROUTES` is still `["/dashboard"]` only.

S-05 extended the stub with first-match log phrases (`completed|logged|log|done`) so a log never opens a proposition.

There is no LLM client, no `OPENAI_*` `astro:env` fields, no AI SDK, no Workers AI binding. Vitest is Node (`vitest.config.ts`) and never imports `astro:env` from service tests — `propose-adaptation.ts` and `chat.ts` must stay env-free. Infrastructure already says prefer `fetch`-based LLM clients (`nodejs_compat` is incomplete) and that LLM wait time does not count as CPU; DEP-002 (Workers Paid) is still open because the stub was not a live fetch.

`applyMutations` ignores unknown dates and never flips `frozen`. The model cannot invent days or bypass Accept.

## Desired End State

With `OPENAI_API_KEY` set, a member message yields a model-written `reply`. Explain / life / day-change still produce a diff + Accept when there are mutations; hard propositions still cannot be accepted (UI + 409). Chat log still upserts immediately with no pending. Without the key, the existing stub still runs so CI and local-without-secret keep working. No OpenAI SDK. The model never writes `training_units` and never skips `validatePlan`.

### Key Discoveries:

- Swap surface is `ProposeResult` (`src/lib/services/propose-adaptation.ts`). Downstream `sendMessage` / Accept / `applyMutations` stay.
- `applyMutations` skips unknown dates (`src/lib/services/plan-adaptation.ts`); frozen always comes from the existing unit.
- `sendMessage` inserts the user row **before** proposing (`src/lib/services/chat.ts`). LLM failure after that insert must still write an assistant reply (no orphan user turn, no 500).
- Phrase tests in `propose-adaptation.test.ts` call `proposeAdaptation` with no deps — they become the **stub-fallback** suite when `complete` is omitted.
- `chat.test.ts` imports `acceptDecision` from `chat.ts`. Adding a top-level `astro:env` import to `chat.ts` would break Vitest. Read secrets only in `src/pages/api/chat/messages.ts`.
- JSON APIs must not join `PROTECTED_ROUTES`.
- UTC `YYYY-MM-DD` via `weekDates` / `utcMondayOf`. Never `new Date("YYYY-MM-DD")`.
- DEP-002 stays open (human billing). This slice **is** the fetch LLM that DEP-002 was waiting for — update its Notes, do not close it. Next free deploy id is **DEP-014**.

## What We're NOT Doing

- Anthropic SDK, Workers AI bindings, OpenAI / Vercel AI SDK npm deps, streaming / SSE, or changing `PlanChat` to token streaming.
- Replacing `generatePlan` / `validatePlan` with an LLM planner (PRD non-goal). Letting Accept skip the server re-check.
- Closing DEP-002, enabling Workers Paid, or putting `OPENAI_API_KEY` in GitHub Actions (CI uses the stub + mocked `fetch`).
- BoundCode changes, S-04 edit/undo UX, S-06 Admin, new chat tables, putting `/api/*` on `PROTECTED_ROUTES`, service-role Supabase, or client-exposed secrets.
- Playwright / jsdom / CI Supabase / hosted `db push`.
- Changing log persistence (S-05). Logs still skip pending.

## Implementation Approach

Keep the stub as a pure function. Add a `fetch` Chat Completions client that returns the same `ProposeResult`. `proposeAdaptation` becomes async: if a `complete` dep is passed, call it, sanitize, and on throw/timeout/unparseable return a pinned unavailable reply with no mutations and no log; otherwise run the stub. The messages API route is the only place that reads `OPENAI_API_KEY` and injects `complete`. Accept, reject, diff UI, and RLS are unchanged.

## Critical Implementation Details

**The model proposes; algorithms bound.** After sanitize, `sendMessage` still `applyMutations` → `gateAccept` / `validatePlan`. Accept still re-validates the stored snapshot. Never persist `training_units` from the model output directly.

**No `astro:env` in services.** `completeOpenAiPropose(request, options)` takes credentials in `options` (`{ apiKey, model, fetchImpl? }`). `src/pages/api/chat/messages.ts` reads `OPENAI_API_KEY` / `OPENAI_MODEL` and passes `complete` into `sendMessage`. Tests inject a fake `complete` or a fake `fetchImpl`.

**Log XOR mutations.** If the model returns both, drop `mutations` and keep `log` (S-05: a log must not open a proposition). If `log.date` is not a unit in the current week, drop `log` and, when mutations are also empty, set `reply` to `I don't see a workout on that day.` so the thread does not claim a log that was discarded.

**User row already inserted.** `complete` throwing must not fail `sendMessage` with `DB_ERROR`. Insert the pinned unavailable assistant reply and skip pending.

**Timeout.** `AbortSignal.timeout(20_000)` on the OpenAI `fetch`. Abort counts as unavailable.

---

## Phase 1: Fetch client and ProposeResult schema

### Overview

A testable OpenAI Chat Completions wrapper that turns a week + message + short history into a sanitized `ProposeResult`, with no `astro:env` and no `sendMessage` wiring yet.

### Changes Required:

#### 1. OpenAI fetch client

**File**: `src/lib/services/openai-chat.ts` (new)

**Intent**: Call OpenAI with `fetch` (Workers-safe, no SDK) and parse a structured JSON body into `ProposeResult`.

**Contract**: Export `completeOpenAiPropose(request, options)` where `request` is `{ message, weekStart, units, weeklyKm, history: { role, content }[] }` and `options` is `{ apiKey: string; model: string; fetchImpl?: typeof fetch }`. POST `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <apiKey>`, `response_format` `json_schema` / `strict: true` named `propose_adaptation`, and `AbortSignal.timeout(20_000)`. System prompt includes the week JSON (date, type, km, frozen), `weeklyKm`, allowed `WorkoutType`s, and: mutations only for existing dates; do not change frozen units; explain ⇒ empty mutations and no log; life/day-change ⇒ mutations; completed workout ⇒ `log` and empty mutations; never emit a full replacement week. `history` is the last **12** `{ role, content }` turns (including the current user message). Default `fetchImpl` is global `fetch`. Non-2xx, abort, missing `choices[0].message.content`, `refusal`, or JSON that fails the zod schema **throw** (do not return a stub). No `astro:env` import.

Snippet (request `response_format` only — this is the non-obvious OpenAI contract):

```ts
response_format: {
  type: "json_schema",
  json_schema: {
    name: "propose_adaptation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["reply", "mutations", "log"],
      properties: {
        reply: { type: "string" },
        mutations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "type", "distanceKm", "structure"],
            properties: {
              date: { type: "string" },
              type: { anyOf: [{ type: "string", enum: ["base", "recovery", "tempo", "threshold", "anaerobic", "long"] }, { type: "null" }] },
              distanceKm: { anyOf: [{ type: "number" }, { type: "null" }] },
              structure: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
          },
        },
        log: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["date", "distanceKm"],
              properties: {
                date: { type: "string" },
                distanceKm: { anyOf: [{ type: "number" }, { type: "null" }] },
              },
            },
          ],
        },
      },
    },
  },
}
```

#### 2. Sanitize helper

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: Shared sanitizer so the live client and tests agree on null-stripping and log-vs-mutation exclusivity before `sendMessage`.

**Contract**: Export `sanitizeProposeResult(raw, units): ProposeResult`. Never throw. Drop mutations whose `date` is not in `units`, whose `type` is not a `WorkoutType`, or whose `distanceKm` is not a finite `>= 0` number (omit that field when null). Strip null `structure`. If `log` is present, `mutations` must be `[]`. If `log.date` is not in `units`, drop `log`; if mutations are then empty, set `reply` to `I don't see a workout on that day.` Missing/empty `reply` after parse is the client's throw, not the sanitizer's.

### Success Criteria:

#### Automated Verification:

- `src/lib/services/openai-chat.ts` uses `fetch` to `https://api.openai.com/v1/chat/completions` and does not import `openai`, `@ai-sdk/*`, or `astro:env`
- Mocked 2xx with valid schema JSON returns sanitized `reply` / `mutations` / optional `log`
- Mocked 401, abort/timeout, refusal, and unparseable content each throw
- `sanitizeProposeResult` drops unknown dates, drops mutations when `log` is set, drops `log` when the date has no unit, and then uses reply `I don't see a workout on that day.` when mutations are empty
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 2: Async proposer, stub fallback, sendMessage injection

### Overview

`proposeAdaptation` calls `complete` when provided and the stub otherwise. `sendMessage` awaits it, passes week history + `weeklyKm`, and never 500s on LLM failure. The messages route injects the live client only when the key is set.

### Changes Required:

#### 1. Async `proposeAdaptation`

**File**: `src/lib/services/propose-adaptation.ts`

**Intent**: Same public result shape; live path is opt-in so phrase tests stay the stub.

**Contract**: `proposeAdaptation(input, deps?: { complete?: (req) => Promise<ProposeResult> }): Promise<ProposeResult>`. `input` gains optional `weeklyKm` and `history` (stub ignores both). If `deps.complete` is a function: await it, `sanitizeProposeResult`, and on throw return `{ reply: "I couldn't reach the coach just now. Try again in a moment.", mutations: [] }` (no `log`). If `complete` is omitted: existing stub (sync body, still returned from the async function). Keep the current first-match stub order (explain → log → life → set-km → change-type → help). Export the stub as `stubProposeAdaptation` if that keeps tests readable; do not delete pinned phrases.

#### 2. `sendMessage` passes history and complete

**File**: `src/lib/services/chat.ts`

**Intent**: Wire the proposer without importing `astro:env`. Continue chat has the last turns. LLM errors become an assistant reply.

**Contract**: `sendMessage(client, userId, weekStart, content, deps?: { complete?: ... })`. After inserting the user message, `loadMessages` and pass the last 12 `{ role, content }` plus `weeklyKm` into `await proposeAdaptation(...)`. Existing log / mutation / explain branches unchanged. `complete` throw is already handled inside `proposeAdaptation` (unavailable reply). Do not add `LLM_*` to `SendMessageResult` error codes.

#### 3. Env schema + messages route injects the client

**Files**: `astro.config.mjs`, `src/pages/api/chat/messages.ts`

**Intent**: Declare the secrets before the route imports them so Phase 2 `npm run build` typechecks. Production/local-with-secret uses OpenAI; CI and local-without-secret keep the stub.

**Contract**: In `astro.config.mjs` add `OPENAI_API_KEY` and `OPENAI_MODEL` as `envField.string({ context: "server", access: "secret", optional: true })` — same shape as `SUPABASE_*`. Do not add `client` / `public` access. In `messages.ts` import both from `astro:env/server`. If `OPENAI_API_KEY` is a non-empty string, pass `complete: (req) => completeOpenAiPropose(req, { apiKey: OPENAI_API_KEY, model: OPENAI_MODEL || "gpt-4o-mini" })`. Otherwise omit `complete`. Do not add `/api/chat` to `PROTECTED_ROUTES`. Accept/reject routes unchanged.

#### 4. Tests

**Files**: `src/lib/services/propose-adaptation.test.ts`, `src/lib/services/openai-chat.test.ts` (new)

**Intent**: Stub phrases stay green without a key; the LLM path is proven with mocks.

**Contract**: Existing phrase tests `await proposeAdaptation(...)` with no `complete` and keep the same expectations. New tests: mocked `complete` returning a Thursday recovery mutation is sanitized and returned; `complete` rejecting yields the pinned unavailable reply and empty mutations; mocked OpenAI body with both `log` and mutations sanitizes to log-only.

### Success Criteria:

#### Automated Verification:

- Existing stub phrase tests still pass when `complete` is omitted (`what is Tuesday for`, `I completed Tuesday`, `logged Wednesday 8 km`, `poor sleep`, consecutive-long / 200 km mutations)
- `proposeAdaptation` with a rejecting `complete` returns the pinned unavailable reply, `mutations: []`, and no `log`
- `proposeAdaptation` with a mocked `complete` that returns both `log` and mutations yields `log` and `mutations: []`
- `src/pages/api/chat/messages.ts` reads `OPENAI_API_KEY` from `astro:env/server` and does not pass `complete` when the key is empty
- `src/lib/services/chat.ts` does not import `astro:env`
- `acceptProposition` / `gateAccept` source still the only persist gate (no new write of `training_units` from the proposer)
- `astro.config.mjs` declares `OPENAI_API_KEY` and `OPENAI_MODEL` as optional server secrets
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 3: Secrets, docs, and deploy notes

### Overview

Document local/prod setup, record the Wrangler secret as DEP-014, and mark DEP-002 as “fetch LLM shipped, Paid still human.” (`astro:env` fields already landed in Phase 2 so build could import them.)

### Changes Required:

#### 1. Env examples and README

**Files**: `.env.example`, `README.md`

**Intent**: A human can put the key in `.dev.vars` locally and `wrangler secret put` in production without guessing names.

**Contract**: `.env.example` lists `OPENAI_API_KEY=` and `OPENAI_MODEL=` (comment that MODEL defaults to `gpt-4o-mini` when unset). README env table + Wrangler paragraph mention the same two names. Do not commit real keys. Do not add them to `.github/workflows/ci.yml`.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted secret and Workers Paid are human ops, not this commit.

**Contract**: Append **DEP-014**: `npx wrangler secret put OPENAI_API_KEY` (optional `OPENAI_MODEL`) on Worker `hard-feelings`; Source = this plan; production chat stays on the stub until the secret exists. Update **DEP-002** Notes: S-07 shipped a `fetch` LLM; enable Workers Paid when this hits production CPU; do **not** set Status done. Leave DEP-001 and DEP-003–DEP-013 statuses unchanged.

#### 3. Chat helper copy

**File**: `src/components/plan/PlanChat.tsx`

**Intent**: The member knows replies can be model-written; Accept still gates the calendar.

**Contract**: One sentence in the existing helper paragraph — do not add streaming UI, provider logos, or a second error surface. Keep `cn()`; no new shadcn pieces.

### Success Criteria:

#### Automated Verification:

- `README.md` documents `OPENAI_API_KEY` / `OPENAI_MODEL` and `wrangler secret put` for the key
- `.env.example` lists both names; `.github/workflows/ci.yml` does not set `OPENAI_API_KEY`
- `context/deployment/deferred.md` has open DEP-014 for the Wrangler secret; DEP-002 is still open with Notes that mention the S-07 fetch client
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- With `OPENAI_API_KEY` in `.dev.vars`, sign in, generate a week, ask “what is Tuesday for” and get a model-written explanation with no Accept panel
- Ask to change a day; review the diff; Accept lands only when hard is empty; a hard proposition keeps Accept disabled and POST accept 409s
- “I completed Tuesday” still logs without Accept
- With the key unset, the stub phrases still work on `/dashboard`

---

## Testing Strategy

### Unit Tests:

- Mocked `fetch` for 2xx / 401 / abort / refusal / bad JSON (`openai-chat.test.ts`).
- `sanitizeProposeResult` unknown date, log XOR mutations, bad km.
- Stub phrase suite unchanged when `complete` is omitted.
- Rejecting `complete` → pinned unavailable reply.

### Integration Tests:

- None in CI (no live OpenAI, no Supabase in GHA). Do not call `api.openai.com` from Vitest.

### Manual Testing Steps:

1. `cp .env.example .dev.vars`, set Supabase + `OPENAI_API_KEY`, `npm run dev`.
2. Sign in, generate a week, explain / life / day-change / log as in Phase 3 Manual.
3. Repeat with the key removed and confirm stub copy.

## Performance Considerations

One Chat Completions request per send, last 12 turns, 20s abort. LLM wait is not Workers CPU; SSR + auth still can be — DEP-002 remains the Paid upgrade. Do not stream in this slice.

## Migration Notes

No SQL. Hosted chat tables remain DEP-010. Production model replies need DEP-014 (`OPENAI_API_KEY`) and, under load, DEP-002 (Workers Paid). Rolling back the Worker does not unset Wrangler secrets.

## References

- Roadmap S-07: `context/foundation/roadmap.md`
- PRD US-01, FR-006, FR-007, FR-008, NFR hard bounds, non-goal no LLM planner: `context/foundation/prd.md`
- S-03 stub + accept: `src/lib/services/propose-adaptation.ts`, `src/lib/services/chat.ts`, `src/pages/api/chat/messages.ts`, `src/pages/api/chat/accept.ts`
- S-05 log XOR pending: `src/lib/services/workout-log.ts`
- Infra fetch-not-SDK / DEP-002: `context/foundation/infrastructure.md`, `context/deployment/deferred.md`
- AGENTS: `astro:env` server-only, zod APIs, `prerender = false`, `PROTECTED_ROUTES`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fetch client and ProposeResult schema

#### Automated

- [x] 1.1 `src/lib/services/openai-chat.ts` uses `fetch` to `https://api.openai.com/v1/chat/completions` and does not import `openai`, `@ai-sdk/*`, or `astro:env` — 4e80593
- [x] 1.2 Mocked 2xx with valid schema JSON returns sanitized `reply` / `mutations` / optional `log` — 4e80593
- [x] 1.3 Mocked 401, abort/timeout, refusal, and unparseable content each throw — 4e80593
- [x] 1.4 `sanitizeProposeResult` drops unknown dates, drops mutations when `log` is set, drops `log` when the date has no unit, and then uses reply `I don't see a workout on that day.` when mutations are empty — 4e80593
- [x] 1.5 `npm test` exits 0 — 4e80593
- [x] 1.6 `npm run lint` exits 0 — 4e80593

### Phase 2: Async proposer, stub fallback, sendMessage injection

#### Automated

- [x] 2.1 Existing stub phrase tests still pass when `complete` is omitted (`what is Tuesday for`, `I completed Tuesday`, `logged Wednesday 8 km`, `poor sleep`, consecutive-long / 200 km mutations) — a8b2cd4
- [x] 2.2 `proposeAdaptation` with a rejecting `complete` returns the pinned unavailable reply, `mutations: []`, and no `log` — a8b2cd4
- [x] 2.3 `proposeAdaptation` with a mocked `complete` that returns both `log` and mutations yields `log` and `mutations: []` — a8b2cd4
- [x] 2.4 `src/pages/api/chat/messages.ts` reads `OPENAI_API_KEY` from `astro:env/server` and does not pass `complete` when the key is empty — a8b2cd4
- [x] 2.5 `src/lib/services/chat.ts` does not import `astro:env` — a8b2cd4
- [x] 2.6 `acceptProposition` / `gateAccept` source still the only persist gate (no new write of `training_units` from the proposer) — a8b2cd4
- [x] 2.7 `astro.config.mjs` declares `OPENAI_API_KEY` and `OPENAI_MODEL` as optional server secrets — a8b2cd4
- [x] 2.8 `npm test` exits 0 — a8b2cd4
- [x] 2.9 `npm run lint` exits 0 — a8b2cd4
- [x] 2.10 `npm run build` exits 0 — a8b2cd4

### Phase 3: Secrets, docs, and deploy notes

#### Automated

- [x] 3.1 `README.md` documents `OPENAI_API_KEY` / `OPENAI_MODEL` and `wrangler secret put` for the key — 95961fa
- [x] 3.2 `.env.example` lists both names; `.github/workflows/ci.yml` does not set `OPENAI_API_KEY` — 95961fa
- [x] 3.3 `context/deployment/deferred.md` has open DEP-014 for the Wrangler secret; DEP-002 is still open with Notes that mention the S-07 fetch client — 95961fa
- [x] 3.4 `npm run lint` exits 0 — 95961fa
- [x] 3.5 `npm run build` exits 0 — 95961fa

#### Manual

- [x] 3.6 With `OPENAI_API_KEY` in `.dev.vars`, sign in, generate a week, ask “what is Tuesday for” and get a model-written explanation with no Accept panel
- [x] 3.7 Ask to change a day; review the diff; Accept lands only when hard is empty; a hard proposition keeps Accept disabled and POST accept 409s
- [x] 3.8 “I completed Tuesday” still logs without Accept
- [x] 3.9 With the key unset, the stub phrases still work on `/dashboard`
