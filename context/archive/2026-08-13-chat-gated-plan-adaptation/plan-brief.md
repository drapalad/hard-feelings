# Chat-Gated Plan Adaptation — Plan Brief

> Full plan: `context/changes/chat-gated-plan-adaptation/plan.md`

## What & Why

Member can ask chat what a unit is for, report life context, or request a day change; see a diff with soft validator warnings; accept, reject, or continue — while hard-bound proposals cannot land (US-01, FR-006–008). This is the north-star loop after a generated week.

## Starting Point

S-02 calendar + `replaceWeek` and F-01 `validatePlan` are on disk. No chat tables, no `/api/chat`, no LLM client. DEP-002 (Workers Paid) and DEP-009 (`training_units` hosted) remain open.

## Desired End State

Signed-in member with a generated week chats on `/dashboard`, reviews a type/km diff plus hard/soft output, and Accept writes the week only when `validatePlan.hard` is empty (server re-check). Reject discards. Explanation-only has no accept. Rows are RLS-scoped.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Bound gate | Reuse F-01 `validatePlan`; accept iff `hard.length === 0` | S-02/S-03 must not invent divergent rules | F-01 / Locked |
| LLM | Deterministic `proposeAdaptation` stub; no API keys | Provider unknown is non-blocking; CI cannot call a model | Locked / Roadmap |
| Persist | `chat_messages` + `plan_propositions` (one pending per week) | Accept after reload; later S-06 can read history | Locked |
| Apply | Merge on send; accept uses stored full-week snapshot + `replaceWeek` | Upsert must cover the window; generate stays the planner | Locked / S-02 |
| HTTP | JSON + zod; 401; not `PROTECTED_ROUTES` | Middleware redirects would break `fetch` | Locked / AGENTS |
| UI | `PlanWorkspace` owns week; calendar \| chat | Shared `weekStart` so nav cannot desync the thread | Locked |
| DEP-002 | Leave open | Stub is not live LLM; Paid still waits on a fetch client | Locked / Infra |
| Hosted SQL | Append DEP-010; leave 001–009 | Worker rollback does not undo SQL | Locked |

## Scope

**In scope:** chat/proposition migrations + RLS; merge/diff/gate + stub intents; GET/POST chat APIs + accept/reject; dashboard chat island; DEP-010.

**Out of scope:** Hosted LLM; S-04 edit/undo; S-05 logging; S-06 Admin; BoundCode changes; Playwright; hosted `db push`; closing DEP-002.

## Architecture / Approach

Island → cookie JSON `/api/chat*` → load week + profile → stub propose → `applyMutations` → `validatePlan` → store pending JSON. Accept re-validates then `replaceWeek`. Hard 409 never writes `training_units`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | messages + propositions + DEP-010 | Hosted DB never gets the SQL |
| 2. Diff + stub + gate | Vitest-pinned intents and hard/soft accept | Second validator copy-paste |
| 3. Services and APIs | Send/list/accept/reject JSON | `/api/chat` on `PROTECTED_ROUTES`; accept skipping re-validate |
| 4. Chat UI | Dashboard loop | Inventing edit UX (S-04) or enabling Accept on hard |

**Prerequisites:** S-02 on disk; local Supabase for the new migration.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Production chat persist fails until DEP-010; Worker rollback does not drop chat tables.
- Stub phrases are the product’s first chat UX; swapping a fetch LLM later must keep the same accept path.
- Stored `proposed_units` are a snapshot; regenerate-then-accept can overwrite a newer generate (member choice).

## Success Criteria (Summary)

- Explain a unit without changing the calendar.
- Life-context / day-change shows a diff; Accept lands only without hard bounds.
- Hard propositions cannot be accepted (UI + 409).
