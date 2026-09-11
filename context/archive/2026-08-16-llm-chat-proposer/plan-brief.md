# LLM Chat Proposer — Plan Brief

> Full plan: `context/changes/llm-chat-proposer/plan.md`

## What & Why

Member chat still accept / reject / continue under hard bounds, but explanations and adaptation diffs are model-written instead of the S-03 phrase stub (S-07, US-01, FR-006–008). The model proposes mutations; `validatePlan` / Accept still decide what lands.

## Starting Point

S-03 `proposeAdaptation` is a sync stub (`explain` / `log` / `life` / `set-km` / `change-type`). `sendMessage` already merges, validates, and stores a pending week. No LLM client, no `OPENAI_*` env, DEP-002 still open.

## Desired End State

With `OPENAI_API_KEY`, a dashboard send returns a model reply plus the existing diff/Accept UI. Without the key, the stub still runs (CI / local). Hard Accept 409 is unchanged. No SDK, no streaming, no LLM planner.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Provider | OpenAI Chat Completions via `fetch`, model `gpt-4o-mini` (override `OPENAI_MODEL`) | Infra forbids Node SDKs on Workers; OpenAI structured JSON is the coaching-quality path | Unattended |
| Missing key | Keep the S-03 stub | CI cannot call a model; local dogfood without a paid key must still chat | Unattended |
| Output contract | Same `ProposeResult` (`reply` + `mutations` + optional `log`); never a full-week rewrite | `applyMutations` patches existing dates; PRD non-goal is no LLM planner | Plan |
| History | Last 12 `{ role, content }` turns in the request | FR-006 “continue chat” is stateless in the stub and would reset without history | Unattended |
| LLM errors | Pinned unavailable assistant reply; no mutations; no 500 | User row is already inserted; failing the HTTP call would orphan the turn | Unattended |
| Intents when keyed | Model owns explain / life / change / log; stub only if `complete` is omitted | Roadmap is “replace the stub”; S-05 log XOR pending still enforced in sanitize | Unattended |
| Streaming | None — keep JSON request/response | `PlanChat` / `PlanWorkspace` already `fetch` + JSON; S-03 parked streaming | Plan |
| Secrets / Paid | `astro:env` optional server secrets; DEP-014 Wrangler put; DEP-002 stays open | AGENTS.md server-only secrets; Paid is human billing, not this commit | Plan |

## Scope

**In scope:** `fetch` client + json_schema; async proposer + stub fallback; `sendMessage` injection from the messages route; sanitize log XOR mutations; env/README; DEP-014; DEP-002 Notes.

**Out of scope:** Workers AI / Anthropic / AI SDK; streaming; closing DEP-002; BoundCode; S-06; putting the key in GHA; LLM `generatePlan`.

## Architecture / Approach

`messages.ts` reads `OPENAI_API_KEY` → injects `completeOpenAiPropose` into `sendMessage` → `await proposeAdaptation`. Sanitize → existing `applyMutations` / `gateAccept` / pending or `upsertLog`. Accept unchanged. Tests mock `fetch` / `complete`; never hit the network.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fetch client + schema | Mock-tested OpenAI wrapper + sanitizer | Importing `astro:env` into Vitest |
| 2. Async proposer + inject | Live path + stub fallback + `astro:env` fields; Accept still the persist gate | Importing `OPENAI_*` before the env schema exists |
| 3. Secrets / docs / DEPs | Env fields, DEP-014, DEP-002 Notes, helper copy | Closing DEP-002 by accident |

**Prerequisites:** S-03 on disk (`chat-gated-plan-adaptation`); local `.dev.vars` for Manual only.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Production stays on the stub until DEP-014. Worker rollback does not unset the secret.
- Stub fallback when the key is missing is a product choice (see FU-008).
- `gpt-4o-mini` + last-12 history is cost-bounded, not a quality SLA.

## Success Criteria (Summary)

- Model-written explain with no Accept; day-change diff still gated.
- Hard propositions cannot be accepted.
- Chat log still skips pending.
- CI green with no OpenAI secret.
