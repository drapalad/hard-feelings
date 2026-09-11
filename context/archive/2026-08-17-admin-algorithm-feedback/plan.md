# Admin Algorithm Feedback Implementation Plan

## Overview

Give an Admin a hidden panel to review algorithm-improvement reports captured when chat proposes a calendar change that fails hard bounds — without notifying the member (roadmap S-06, FR-011). Review is read + mark-reviewed only; the generator is not edited from this UI.

## Current State Analysis

S-03 chat persist and S-07 fetch LLM are on disk. `sendMessage` still inserts a **pending** proposition when `mutations.length > 0`, including when `validation.hard.length > 0`. Accept is blocked in UI and with `HARD_BOUNDS` 409. Members never see an Admin surface.

There is no role table, no `locals.isAdmin`, no gap/report types, and `profiles` is weekly km only. Cookie SSR `createClient` is anon+JWT; there is no service-role client. RLS on existing tables is `auth.uid() = user_id`. `PROTECTED_ROUTES` is `["/dashboard"]` and redirects HTML; JSON APIs self-return `401` via `unauthorized()`. Topbar shows Dashboard + Sign out for any signed-in user.

`generatePlan` is a thin fill (equal km split, cycling types, never `long`). Hard codes live in `validatePlan`: `WEEKLY_VOLUME_EXCEEDED`, `CONSECUTIVE_LONGS`, `FROZEN_ANCHOR_DROPPED`. Those codes are the algorithm-friction signal this slice mines.

FU-011 (Admin LLM model picker) is a **settings** follow-up; this slice must not absorb it. DEP-014 is the latest deploy item; next free id is **DEP-015**.

## Desired End State

A user listed in `user_roles` as `admin` can open `/admin`, see the newest algorithm-improvement reports (hard-bound chat captures), read a deterministic summary plus a canned improvement hint, and mark a report reviewed. A signed-in Member who is not Admin gets **404** on `/admin` and `/api/admin/*` (no “forbidden” leak). Members have no report UI and cannot SELECT reports. Unauthenticated `/admin` redirects to sign-in like `/dashboard`. Chat send still succeeds if report insert fails. Another Member’s training calendar/chat remains invisible except the Admin-only report DTO (no chat transcript).

### Key Discoveries:

- `PROTECTED_ROUTES` uses `pathname.startsWith` (`src/middleware.ts`). Put `/admin` on that list for HTML. Do **not** put `/api/admin` on it — redirects would break `fetch`.
- Members inserting `agent_reports` via JWT is required (no service role). Hide the rows with **no SELECT policy for the author**.
- `user_roles` must have **SELECT own only** and **no INSERT/UPDATE/DELETE policies** so a Member cannot self-promote.
- `sendMessage` already has the capture hook: after `gateAccept`, when `proposed.mutations.length > 0` (`src/lib/services/chat.ts`). Fail-open like `clearRevisions` on Accept.
- Missing `user_roles` (hosted SQL not applied) must not 500 the dashboard — `isAdmin` false on query failure.
- Worker rollback does not undo hosted SQL (`context/deployment/deferred.md`).

## What We're NOT Doing

- Applying or editing `generatePlan` / `validatePlan` / BoundCode from the Admin UI (review only).
- LLM model picker / project settings (FU-011 stays open).
- Capturing unmapped intents, explain, log, LLM-unavailable, or soft-only warnings as reports.
- Storing the member’s chat message body or a week snapshot on the report.
- Notifying members that a report exists.
- Env `ADMIN_EMAILS` allowlist (RLS cannot see env).
- Service-role Supabase, client-exposed secrets, or adding `/api/*` to `PROTECTED_ROUTES`.
- Pagination UI, search, bulk review, or reopening a reviewed report.
- Playwright / jsdom / CI Supabase / hosted `db push`.
- Closing DEP-001–DEP-014 or FU-011.

## Implementation Approach

Two tables: `user_roles` (grant via SQL) and `agent_reports` (member INSERT, Admin SELECT/UPDATE). Pure `buildHardBoundReport` turns `ValidateResult.hard` into a DTO. `sendMessage` inserts that row fail-open. Middleware sets `locals.isAdmin`. JSON `/api/admin/reports` list + PATCH mark reviewed. Hidden `/admin` Astro page + small React island. Topbar Admin link only when `isAdmin`.

## Critical Implementation Details

**404, not 403, for signed-in non-admins.** Unauthenticated HTML still redirects. JSON: `401` if no user, `404` `{ error: { code: "NOT_FOUND", message: "Not found" } }` if not Admin. Do not return `FORBIDDEN`.

**Capture must not break chat.** Wrap report insert in try/catch inside `sendMessage`. Do not change Accept/Reject, pending insert, or member-facing payloads.

**Grant is out-of-band SQL.** Document `INSERT INTO user_roles (user_id, role) VALUES ('<auth.users id>', 'admin');` in README. No self-serve UI.

**`insertPending` is module-private.** Capture belongs in `sendMessage` immediately after `await insertPending(...)` (mutations branch, ~line 146). Do not export `insertPending`. Omit `.select()` on the report insert — member RLS cannot re-read the row.

**Dates stay `YYYY-MM-DD` UTC strings.** Reuse `weekStartSchema` / `utcMondayOf`. Never `new Date("YYYY-MM-DD")`.

---

## Phase 1: Schema and RLS

### Overview

Persist Admin grants and algorithm-improvement reports with RLS that keeps reports hidden from members.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_admin_algorithm_feedback.sql` (new; timestamp at implement time)

**Intent**: Role grants and Admin-only reports, isolated from Worker rollback.

**Contract**:

- `user_roles`: `user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`; `role text NOT NULL`; `CHECK (role IN ('admin'))`.
- `ENABLE ROW LEVEL SECURITY` on `user_roles`. **SELECT** policy only: `auth.uid() = user_id`. No INSERT, UPDATE, or DELETE policies.
- `agent_reports`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `source_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`; `week_start date NOT NULL`; `kind text NOT NULL CHECK (kind IN ('gap', 'algorithm_proposal'))`; `status text NOT NULL CHECK (status IN ('open', 'reviewed'))`; `title text NOT NULL`; `body text NOT NULL`; `bound_codes text[] NOT NULL DEFAULT '{}'`; `created_at timestamptz NOT NULL DEFAULT now()`; `reviewed_at timestamptz`. Comment: this slice inserts `kind = 'algorithm_proposal'` only.
- `ENABLE ROW LEVEL SECURITY` on `agent_reports`. Granular policies, no combined ALL:
  - **INSERT**: `WITH CHECK (auth.uid() = source_user_id)`
  - **SELECT**: `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')`
  - **UPDATE**: same Admin `EXISTS` for `USING` and `WITH CHECK`
  - No DELETE policy
- Comment that Worker rollback does not undo this SQL.

#### 2. Docs and deploy backlog

**Files**: `README.md` (Supabase Configuration), `context/deployment/deferred.md`

**Intent**: Operators can grant Admin locally; hosted SQL is a separate DEP.

**Contract**: Document granting Admin with the `user_roles` INSERT (use the user’s `auth.users.id`). Append **DEP-015**: apply `*_admin_algorithm_feedback.sql` to the hosted project behind `SUPABASE_URL`; Source = this plan; Worker rollback does not undo SQL. Leave DEP-001–DEP-014 unchanged.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_admin_algorithm_feedback.sql` file with `user_roles` and `agent_reports` as specified (checks, FKs, SELECT-only on `user_roles`, INSERT-own + Admin SELECT/UPDATE on `agent_reports`, no member SELECT, no DELETE policy)
- `README.md` documents the `user_roles` Admin grant INSERT
- `context/deployment/deferred.md` has an open DEP-015 for this migration; DEP-001–DEP-014 statuses are unchanged

---

## Phase 2: Report builder, types, and authz helpers

### Overview

Lock the DTO, “hard bounds only”, canned proposal copy, and 404-not-403 JSON in Vitest before HTTP or SQL writes.

### Changes Required:

#### 1. Types

**File**: `src/types.ts`

**Intent**: Shared Admin DTO; do not overload `PlanProposition` or chat `ChatRole`.

**Contract**: Export `AgentReportKind = "gap" | "algorithm_proposal"`, `AgentReportStatus = "open" | "reviewed"`, and `AgentReport` with `id`, `sourceUserId`, `weekStart`, `kind`, `status`, `title`, `body`, `boundCodes: BoundCode[]`, `createdAt`, `reviewedAt: string | null`. Do not add chat transcript or proposed units to the DTO.

#### 2. Pure builder + canned hints

**File**: `src/lib/services/agent-report.ts` (new) and `src/lib/services/agent-report.test.ts` (new)

**Intent**: One function `sendMessage` and tests share; no database in this phase.

**Contract**:

- Export `shouldCaptureHardBoundReport(mutationsLength: number, validation: ValidateResult): boolean` — true iff `mutationsLength > 0` and `validation.hard.length > 0`.
- Export `buildHardBoundReport(input: { sourceUserId: string; weekStart: string; validation: ValidateResult }): Omit<AgentReport, "id" | "createdAt" | "reviewedAt"> | null` — `null` when `hard` is empty. Otherwise `kind: "algorithm_proposal"`, `status: "open"`, `boundCodes` unique from `hard[].code`, `title` like `Hard bounds blocked a plan change ({codes})`, `body` concatenates each hard `message` plus a canned hint per code:
  - `WEEKLY_VOLUME_EXCEEDED` → consider shrinking another day when chat asks for more km
  - `CONSECUTIVE_LONGS` → generator never places `long`; consider a long-placement rule or refusing consecutive-long mutations in the proposer
  - `FROZEN_ANCHOR_DROPPED` → proposer should refuse mutations that drop frozen anchors before they become pending
- Do not include the member message or unit snapshot.

#### 3. `notFound` JSON helper

**Files**: `src/lib/api.ts`, `src/lib/api.test.ts`

**Intent**: Hide Admin APIs from non-admins the same way a missing route would.

**Contract**: Export `notFound()` → `404` JSON `{ error: { code: "NOT_FOUND", message: "Not found" } }` with no `Location` header. Mirror `unauthorized()` tests.

### Success Criteria:

#### Automated Verification:

- `shouldCaptureHardBoundReport` is false for empty mutations, for hard-empty validation, and true only when both mutations and hard violations exist
- `buildHardBoundReport` returns null when `hard` is empty; otherwise `kind` is `algorithm_proposal`, `boundCodes` lists the hard codes, and `body` includes the canned hint for `CONSECUTIVE_LONGS`
- `buildHardBoundReport` output has no field that stores a chat message
- `notFound()` returns 404 JSON `NOT_FOUND` and does not redirect
- `npm test` exits 0
- `npm run lint` exits 0

---

## Phase 3: Capture, HTTP, and middleware

### Overview

Insert reports from chat fail-open, resolve `locals.isAdmin`, and expose Admin JSON list + mark-reviewed.

### Changes Required:

#### 1. Role lookup + locals

**Files**: `src/lib/services/admin-role.ts` (new), `src/middleware.ts`, `src/env.d.ts`

**Intent**: Every request knows Admin vs Member without a service-role client.

**Contract**:

- `isAdminUser(client, userId): Promise<boolean>` — `from("user_roles").select("role").eq("user_id", userId).maybeSingle()`; true iff `role === "admin"`. On error or missing table, return **false** (do not throw).
- Middleware: on **every** request (including `/` where `Welcome.astro` renders Topbar), assign `context.locals.isAdmin = false` first; then if `locals.user` is set and supabase exists, overwrite from `isAdminUser`. Catch so a missing table never redirects/500s HTML.
- `App.Locals` adds `isAdmin: boolean`.
- Add `/admin` to `PROTECTED_ROUTES`. Do **not** add `/api/admin`.

#### 2. Report I/O + chat capture

**Files**: `src/lib/services/agent-report.ts`, `src/lib/services/chat.ts`

**Intent**: Hard-bound pending propositions also leave an Admin-only row; members still get the same chat payload.

**Contract**:

- `insertAgentReport(client, report)` — insert `source_user_id`, `week_start`, `kind`, `status`, `title`, `body`, `bound_codes`. Do not select the row back (member RLS cannot read it).
- `listAgentReports(client): Promise<AgentReport[]>` — newest 100 (`created_at` desc). Map snake_case; skip unparsable rows.
- `markAgentReportReviewed(client, id): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" }>` — update `status = 'reviewed'`, `reviewed_at = now()` where `id` and `status = 'open'`; `NOT_FOUND` if zero rows.
- `sendMessage`: after `insertPending` (mutations path only), if `shouldCaptureHardBoundReport`, `buildHardBoundReport` and `insertAgentReport` inside try/catch. Do not add fields to `ChatList` or HTTP chat bodies. Do not capture on the log branch.

#### 3. HTTP

**Files**: `src/pages/api/admin/reports.ts` (new), `src/pages/api/admin/reports/[id].ts` (new)

**Intent**: JSON APIs matching siblings (zod, `prerender = false`, 401 then 404, try/catch `DB_ERROR`).

**Contract**:

- Both files `export const prerender = false`.
- If `!locals.user` → `unauthorized()`. If `!locals.isAdmin` → `notFound()`.
- `GET /api/admin/reports` → `jsonOk({ reports })`. 503 if no supabase.
- `PATCH /api/admin/reports/[id]`: body `{ status: "reviewed" }` via zod. 400 validation; 404 `NOT_FOUND` (missing, already reviewed, or RLS hide). Success `jsonOk({ ok: true })`.
- Do not add `/api/admin` to `PROTECTED_ROUTES`.

### Success Criteria:

#### Automated Verification:

- `src/pages/api/admin/reports.ts` and `src/pages/api/admin/reports/[id].ts` export `prerender = false`
- Handlers return 401 JSON when `locals.user` is missing and 404 JSON `NOT_FOUND` when `locals.isAdmin` is false
- `PROTECTED_ROUTES` includes `/admin` and does not include `/api/admin`
- `sendMessage` source: after `insertPending` it calls the hard-bound capture inside try/catch; the log branch does not
- Chat success payloads are unchanged (no `reports` field on `ChatList`)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Phase 4: Hidden Admin UI

### Overview

Admin-only page and Topbar link; members who guess the URL see a generic 404.

### Changes Required:

#### 1. Page + island

**Files**: `src/pages/admin.astro` (new), `src/components/admin/AdminReports.tsx` (new)

**Intent**: SSR-seed the list; island only for mark-reviewed. React island because the list mutates on PATCH.

**Contract**:

- If `!locals.isAdmin`, return `new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })` — do not render the panel.
- Else Layout titled “Admin”, Topbar, heading “Algorithm feedback”, short copy that members are not notified. Load `listAgentReports` in try/catch (failure → empty list + `ServerError`). Pass reports into `AdminReports` with `client:load`.
- Island: list `title`, `kind`, `status`, `weekStart`, `boundCodes`, `createdAt`, `body`. Open rows have a Reviewed `Button`. PATCH `/api/admin/reports/${id}` `{ status: "reviewed" }`, `credentials: "same-origin"`. On success set that row `reviewed` locally (or refetch GET). Surface `code: message` via `ServerError`. Reuse `Button` / `cn()`. No `"use client"`. No link to a member dashboard or email. Do not add a public nav entry for non-admins.

#### 2. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: The panel is hidden from Members; Admins can reach it without bookmarking.

**Contract**: In the signed-in link group, render an “Admin” link to `/admin` **only** when `Astro.locals.isAdmin` is true. Members keep Dashboard + Sign out only.

### Success Criteria:

#### Automated Verification:

- `src/pages/admin.astro` returns 404 when `locals.isAdmin` is false and does not mount `AdminReports` on that path
- `Topbar.astro` renders the Admin href only inside an `isAdmin` branch
- `AdminReports` PATCHes `/api/admin/reports/` with `{ status: "reviewed" }`
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- Grant Admin via SQL; sign in as that user; Topbar shows Admin; `/admin` lists a report after a hard-bound chat proposal (e.g. consecutive longs or huge km); mark Reviewed; reload stays reviewed
- Sign in as a non-admin Member; Topbar has no Admin link; `/admin` is 404; dashboard chat is unchanged (hard proposition still cannot Accept)
- Unauthenticated `/admin` redirects to sign-in

---

## Testing Strategy

### Unit Tests:

- `shouldCaptureHardBoundReport` / `buildHardBoundReport` (empty hard, consecutive longs hint, no transcript field).
- `notFound()` 404 JSON.
- Existing `unauthorized()` 401 JSON remains.

### Integration Tests:

- None in CI (no Supabase in GHA). Local `npx supabase db reset` proves the migration applies; not a Progress Manual row.

### Manual Testing Steps:

1. `npx supabase start` + `db reset`; sign up two users; grant Admin to one via SQL.
2. As Member: generate a week; chat a hard-bound change; confirm no Admin UI and Accept still blocked.
3. As Admin: open `/admin`; read the report; mark reviewed; confirm Member was not notified.

## Performance Considerations

Newest 100 reports. One extra `user_roles` lookup per authenticated request. Capture is one insert on hard-bound sends only. Do not close DEP-002.

## Migration Notes

Additive tables. Local: `npx supabase db reset` (or `migration up`) after start, then INSERT into `user_roles`. Hosted: apply via DEP-015 **and** grant at least one Admin before expecting `/admin` to work. Rolling back the Worker does not drop the tables. No backfill of historic hard propositions. Missing tables ⇒ capture/list fail-open / empty; dashboard still loads.

## References

- Roadmap S-06: `context/foundation/roadmap.md`
- PRD FR-011, Access Control Admin row: `context/foundation/prd.md`
- S-03 capture hook: `src/lib/services/chat.ts`, `src/lib/services/validate-plan.ts`
- FU-011 (out of scope): `context/backlog.md`
- AGENTS: zod APIs, `prerender = false`, RLS migrations, `PROTECTED_ROUTES`, `cn()`
- Deploy backlog: `context/deployment/deferred.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and RLS

#### Automated

- [x] 1.1 `supabase/migrations/` contains a `*_admin_algorithm_feedback.sql` file with `user_roles` and `agent_reports` as specified (checks, FKs, SELECT-only on `user_roles`, INSERT-own + Admin SELECT/UPDATE on `agent_reports`, no member SELECT, no DELETE policy) — 8e23e5d
- [x] 1.2 `README.md` documents the `user_roles` Admin grant INSERT — 8e23e5d
- [x] 1.3 `context/deployment/deferred.md` has an open DEP-015 for this migration; DEP-001–DEP-014 statuses are unchanged — 8e23e5d

### Phase 2: Report builder, types, and authz helpers

#### Automated

- [x] 2.1 `shouldCaptureHardBoundReport` is false for empty mutations, for hard-empty validation, and true only when both mutations and hard violations exist — 31906a9
- [x] 2.2 `buildHardBoundReport` returns null when `hard` is empty; otherwise `kind` is `algorithm_proposal`, `boundCodes` lists the hard codes, and `body` includes the canned hint for `CONSECUTIVE_LONGS` — 31906a9
- [x] 2.3 `buildHardBoundReport` output has no field that stores a chat message — 31906a9
- [x] 2.4 `notFound()` returns 404 JSON `NOT_FOUND` and does not redirect — 31906a9
- [x] 2.5 `npm test` exits 0 — 31906a9
- [x] 2.6 `npm run lint` exits 0 — 31906a9

### Phase 3: Capture, HTTP, and middleware

#### Automated

- [x] 3.1 `src/pages/api/admin/reports.ts` and `src/pages/api/admin/reports/[id].ts` export `prerender = false` — 2d0ff38
- [x] 3.2 Handlers return 401 JSON when `locals.user` is missing and 404 JSON `NOT_FOUND` when `locals.isAdmin` is false — 2d0ff38
- [x] 3.3 `PROTECTED_ROUTES` includes `/admin` and does not include `/api/admin` — 2d0ff38
- [x] 3.4 `sendMessage` source: after `insertPending` it calls the hard-bound capture inside try/catch; the log branch does not — 2d0ff38
- [x] 3.5 Chat success payloads are unchanged (no `reports` field on `ChatList`) — 2d0ff38
- [x] 3.6 `npm test` exits 0 — 2d0ff38
- [x] 3.7 `npm run lint` exits 0 — 2d0ff38
- [x] 3.8 `npm run build` exits 0 — 2d0ff38

### Phase 4: Hidden Admin UI

#### Automated

- [x] 4.1 `src/pages/admin.astro` returns 404 when `locals.isAdmin` is false and does not mount `AdminReports` on that path — 12202a0
- [x] 4.2 `Topbar.astro` renders the Admin href only inside an `isAdmin` branch — 12202a0
- [x] 4.3 `AdminReports` PATCHes `/api/admin/reports/` with `{ status: "reviewed" }` — 12202a0
- [x] 4.4 `npm run lint` exits 0 — 12202a0
- [x] 4.5 `npm run build` exits 0 — 12202a0

#### Manual

- [x] 4.6 Grant Admin via SQL; sign in as that user; Topbar shows Admin; `/admin` lists a report after a hard-bound chat proposal (e.g. consecutive longs or huge km); mark Reviewed; reload stays reviewed
- [x] 4.7 Sign in as a non-admin Member; Topbar has no Admin link; `/admin` is 404; dashboard chat is unchanged (hard proposition still cannot Accept)
- [x] 4.8 Unauthenticated `/admin` redirects to sign-in
