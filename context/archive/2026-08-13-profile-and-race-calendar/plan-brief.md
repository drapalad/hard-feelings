# Profile Weekly Km and Race Calendar — Plan Brief

> Full plan: `context/changes/profile-and-race-calendar/plan.md`

## What & Why

Ship the first member-owned training inputs: weekly km that will drive generation, and a race calendar with A–D priorities, optional name, and optional goal. Without this, S-02 has nothing to put into `GenerateInput`. Auth is already done; this slice is persistence + a setup page.

## Starting Point

The app is auth/bootstrap: `/dashboard` is an email stub, sign-in lands on `/`, and Supabase has no product tables. F-01 already locked `RaceInput` (`date`, `priority`, `goal?`) and `NO_A_RACE` / weekly-km errors on `generatePlan`.

## Desired End State

A signed-in member saves weekly km and add/edit/remove races on `/dashboard`. At most one A; unique date per member; missing km or races is fine until generate exists. Rows are RLS-scoped. Mapping to `RaceInput` drops display `name` so S-02 can call `generatePlan` unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Layout | One protected page, two sections (replace dashboard) | First session is one sitting; fewer routes | Plan |
| A races | At most one A (UI + partial unique index) | PRD “one A-goal plus side events”; S-02 gets a single target | Plan |
| Goal | Optional free text | Matches `RaceInput.goal?`; S-02 does not parse it | Plan |
| Incomplete setup | Save independently; empty states | Generate gating is S-02 (`NO_A_RACE` / missing km) | Plan |
| Weekly km | Positive, 1 decimal, cap 300 | Matches generator `> 0` with a typo ceiling | Plan |
| Race identity | Optional name; unique date per member | Readable list without a required field | Plan |
| Past dates | Allowed; upcoming sorted first | Season calendars include races already run | Plan |
| Tests | Vitest on validation/mapping; manual UI | No CI Supabase; F-01 harness already exists | Plan |
| HTTP | JSON + zod; APIs 401 (not `PROTECTED_ROUTES`) | AGENTS convention; middleware redirects would break `fetch` | Plan |

## Scope

**In scope:** `profiles` + `races` migration/RLS; zod + `toRaceInput`; JSON CRUD; dashboard island; sign-in → `/dashboard`; README + DEP-008.

**Out of scope:** FR-012 prefs; generate/plan calendar/chat; auth rewrite; Playwright; multiple A races; client Supabase.

## Architecture / Approach

Browser island → cookie JSON APIs → services → PostgREST with the existing anon SSR client. RLS `auth.uid() = user_id` isolates members. Unique `(user_id, date)` plus `UNIQUE (user_id) WHERE priority = 'A'`. `Race` holds `id`/`name`; `toRaceInput` copies only F-01 fields.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema and RLS | Tables, policies, README, DEP-008 | Hosted DB never gets the SQL while the Worker does |
| 2. Validation and mapping | Zod + `toRaceInput` + Vitest | Leaking `name` into `RaceInput` |
| 3. Services and APIs | Authenticated JSON CRUD | Putting `/api/*` on `PROTECTED_ROUTES` (HTML redirect) |
| 4. Setup UI | Dashboard island + post-login landing | Empty states / one-A errors unclear in the UI |

**Prerequisites:** Local Supabase (`npx supabase start`). F-01 types on disk (already). Parallel with F-01; does not import `generatePlan`.
**Estimated effort:** ~2–3 sessions across 4 phases.

## Open Risks & Assumptions

- Production saves fail until DEP-008 is done; Worker rollback does not undo migrations.
- `generatePlan` still allows many A; this slice is stricter and S-02 should treat A as unique.
- Clearing km means deleting the `profiles` row (or equivalent); the plan allows unset km.

## Success Criteria (Summary)

- Member can persist weekly km and a race list with at most one A.
- Another member cannot see those rows.
- S-02 can map stored races to `RaceInput` without schema invention.
