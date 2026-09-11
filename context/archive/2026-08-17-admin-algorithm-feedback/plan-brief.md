# Admin Algorithm Feedback — Plan Brief

> Full plan: `context/changes/admin-algorithm-feedback/plan.md`

## What & Why

Admin can review hidden agent algorithm-improvement reports without notifying the member (S-06, FR-011). Chat already stores hard-bound pending diffs the member cannot Accept; this slice turns those events into an Admin-only review queue so the 12-week algorithm can mature.

## Starting Point

S-03/S-07 chat is on disk: `sendMessage` inserts pending propositions even when `validatePlan.hard` is non-empty. There is no Admin role, no report table, and `PROTECTED_ROUTES` is `/dashboard` only. FU-011 (LLM model picker) is a separate settings ask.

## Desired End State

An operator grants Admin with a SQL insert. That user opens `/admin`, reads canned hard-bound reports, and marks them reviewed. Members never see the panel (404, no Topbar link). Chat and Accept/Reject stay as they are.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Review queue only — list + mark reviewed; no generatePlan edits | FR-011 is review; applying rules from a panel would be a new product slice | Plan |
| Capture trigger | Only chat turns with mutations **and** `validation.hard.length > 0` | That is the algorithm-friction signal already persisted as non-acceptable pending | Unattended |
| Unmapped intents | Out of this slice (explain/log/help/LLM-down not captured) | Minimum Admin loop; flooding on every help fallback would bury real bound failures | Unattended |
| Report shape | `algorithm_proposal` row: title, bound codes, violation messages, canned hint; no units snapshot | Roadmap asked for a minimum shape; codes + hint are enough to improve the stub generator | Unattended |
| PII / transcript | Store `source_user_id` + week; **no** chat message body | Members are not notified; NFR privacy; Admin still has a stable id if they need SQL | Unattended |
| Admin grant | `user_roles` table, SQL INSERT; SELECT-own; no member writes | RLS cannot see an env allowlist; self-serve promote would make every Member an Admin | Unattended |
| Hidden panel | `/admin` on `PROTECTED_ROUTES`; signed-in non-admin **404** (not 403); Topbar link iff `isAdmin` | PRD “hidden”; 403 would confirm the panel exists | Plan |
| JSON authz | 401 if unsigned; 404 `NOT_FOUND` if not Admin; APIs off `PROTECTED_ROUTES` | Same fetch-vs-redirect rule as `/api/chat` | Plan |
| Capture reliability | Fail-open try/catch around insert; do not change chat payloads | A missing hosted table must not break the member north-star loop | Unattended |
| Settings | Do not build FU-011 model picker here | Backlog already routes that to `admin-llm-model-picker` | Plan |
| List window | Newest 100 reports; no pagination UI | PRD target scale is small; pagination is a later slice | Unattended |

## Scope

**In scope:** `user_roles` + `agent_reports` + RLS; hard-bound capture from `sendMessage`; `/api/admin/reports`; hidden `/admin` island; Topbar Admin link; DEP-015; README grant.

**Out of scope:** Applying algorithm changes; FU-011 picker; unmapped-intent gaps; chat transcripts; member notification; service role; hosted `db push`; closing prior DEPs.

## Architecture / Approach

Member JWT INSERTs a report during hard-bound `sendMessage` (cannot SELECT it). Admin JWT SELECT/UPDATE via `user_roles` EXISTS policies. Middleware sets `locals.isAdmin`. Island PATCHes reviewed. No extra LLM call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | Tables + DEP-015 + grant docs | Member SELECT leak or self-grant INSERT |
| 2. Builder + helpers | Vitest-pinned capture/DTO/`notFound` | Putting the chat transcript on the DTO |
| 3. Capture + HTTP | Fail-open insert, middleware, JSON APIs | `/api/admin` on `PROTECTED_ROUTES`; capture throwing into chat |
| 4. Hidden UI | `/admin` + Topbar | Rendering the panel for non-admins |

**Prerequisites:** S-03 on disk; local Supabase for the new migration; a second user to verify 404.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Production `/admin` stays empty until DEP-015 **and** a hosted `user_roles` grant.
- Historic hard propositions are not backfilled.
- Canned hints are operator notes, not applied generator patches.

## Success Criteria (Summary)

- Admin sees a report after a hard-bound chat proposal and can mark it reviewed.
- Members cannot see reports or the Admin link; `/admin` is 404 for them.
- Chat Accept still cannot land hard bounds.
