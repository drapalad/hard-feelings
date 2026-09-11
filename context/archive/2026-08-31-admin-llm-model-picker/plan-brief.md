# Admin project-wide LLM model picker — Plan Brief

> Full plan: `context/changes/admin-llm-model-picker/plan.md`

## What & Why

Admin needs to change the OpenAI model used for coaching chat without a Worker secret rotate. FU-011: one project-wide picker on `/admin`, env / `gpt-4o-mini` fallback, no LLM planner.

## Starting Point

`messages.ts` sends `OPENAI_MODEL` or `gpt-4o-mini`. `/admin` is reports-only (S-06). Production already has `OPENAI_API_KEY` + `OPENAI_MODEL=gpt-5.6-luna` (DEP-014). No settings table; chat runs as the member JWT (no service role).

## Desired End State

Admin saves a model on `/admin` (reports remain). Every member chat Completions call uses that id. Clear restore env then `gpt-4o-mini`. Members cannot write it. Accept / `validatePlan.hard` unchanged. FU-011 done; hosted SQL is DEP-016.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Project-wide Admin picker; not per member/thread | Locked: whole project; S-06 stays reports | Plan |
| Surface | Settings section on `/admin` plus reports | Locked: extend `/admin`; no public picker | Plan |
| Fallback | Stored override → `OPENAI_MODEL` → `gpt-4o-mini` | Locked fallback; empty stored/env is unset (S-07 F1) | Plan |
| Persist | Singleton `project_settings` (`id='default'`) | Admin save must survive deploys; env-only is what FU-011 replaces | Unattended |
| Model id | Free-text OpenAI id (1–64, `[A-Za-z0-9._:-]`) + datalist suggestions | Production already uses `gpt-5.6-luna`; a gpt-4o allowlist would block it | Unattended |
| RLS read | Authenticated SELECT; Admin-only INSERT/UPDATE; no DELETE | Chat has only the member JWT; no service role in this repo | Unattended |
| Clear | PATCH `openaiModel: null` stores SQL null | Empty field = “use env/default”, not a fake model name | Unattended |
| Fail-open read | Missing table / query error → env/default | DEP-016 will lag the Worker deploy; chat must not 500 | Unattended |
| No live probe | Invalid ids fail at Completions time, not on save | Matches existing OpenAI error path; no extra billed call | Unattended |
| Authz | 401 unsigned; 404 non-admin (not 403) | Same hidden-admin contract as `/api/admin/reports` | Plan |
| Tests | Vitest + memory-supabase; no Playwright | Locked; cookbook §6.2 / §6.4; do not weaken Accept persist-skip | Plan |
| Close FU-011 | Done when picker ships (2026-08-31) | Locked | Plan |

## Scope

**In scope:** migration + RLS; resolve/get/set service; `/api/admin/settings`; chat `loadOpenAiModel`; `/admin` island; DEP-016; close FU-011.

**Out of scope:** Workers AI; LLM planner; per-member models; hosted `db push`; public picker; Playwright; other FU/DEP.

## Architecture / Approach

Admin JWT upserts `project_settings`. Member JWT SELECTs it on send. `loadOpenAiModel` is the single fallback helper. `completeOpenAiPropose` already accepts `model`. Accept stays the landing gate.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema + service | Table, harness, resolve/get/set tests, DEP-016 | Member write via RLS; seed test assuming `user_id` |
| 2. API + chat | GET/PATCH settings; messages uses resolver | `/api/admin` on PROTECTED_ROUTES; skipping Accept |
| 3. Admin UI | Picker on `/admin`; close FU-011 | Non-admin seeing the control |

**Prerequisites:** S-06 `/admin` + S-07 fetch path on disk; local Supabase for the new migration.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- Until DEP-016, production chat stays on env/`gpt-4o-mini`; Admin save 500s on hosted.
- Free-text ids can be typos — Completions then errors; recorded as FU-022.
- Authenticated SELECT exposes the model id to any logged-in JWT that queries PostgREST directly (not training data).

## Success Criteria (Summary)

- Admin can persist a project model; members cannot.
- Chat Completions uses stored → env → `gpt-4o-mini`.
- Hard-bound Accept still cannot land. FU-011 closed.
