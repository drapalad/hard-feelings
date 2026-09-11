---
date: 2026-08-24T16:22:52+00:00
researcher: Cursor Grok 4.6
git_commit: 575081c0e346a3e2cc44b135282e9b3529f1eebb
branch: master
repository: hard-feelings
topic: "Ground rollout Phase 1 of context/foundation/test-plan.md (Risks #1, #2, #6)"
tags: [research, codebase, ownership, bounds, auth, vitest, api, services, middleware]
status: complete
last_updated: 2026-08-24
last_updated_by: Cursor Grok 4.6
---

# Research: Ground rollout Phase 1 of context/foundation/test-plan.md (Risks #1, #2, #6)

**Date**: 2026-08-24T16:22:52+00:00
**Researcher**: Cursor Grok 4.6
**Git Commit**: 575081c0e346a3e2cc44b135282e9b3529f1eebb
**Branch**: master
**Repository**: hard-feelings

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` ("Critical-path ownership and bounds").

Risks to verify: #1 (logged-in Member B reads/changes Member A's plan or logs), #2 (chat/LLM calendar change lands despite hard bounds), #6 (unauthenticated caller reaches gated plan/chat/log routes).

For each risk: ground the real failure path in code, quote relevant lines, verify or correct the response guidance, locate existing tests, identify the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence.

The test plan carries evidence and response intent, not code anchors. This document is the ground truth for `/10x-plan`.

## Summary

Phase 1 risks are **real regression / coverage gaps**, not open product holes. Current code already isolates members, re-checks hard bounds on Accept, and 401s logged-out product APIs. Nothing in the 14-file Vitest suite proves those invariants at persist or handler boundaries.

| Risk | Live hole today? | What would actually break | Cheapest useful layer |
|------|------------------|---------------------------|------------------------|
| **#1** | No demonstrated IDOR on plan/logs | Missing `.eq("user_id", sessionId)` **and** RLS not applying | Two-user **in-memory store** that only hides A's rows when the query filters `user_id`; assert B cannot read/mutate A's `training_units` / `workout_logs` |
| **#2** | No: Accept re-runs `validatePlan` before `replaceWeek` | Skip `if (!decision.ok)` in `acceptProposition`, or treat UI disable as the gate | `acceptProposition` (or `POST /api/chat/accept`) against a **constructed** pending row with `sum(km) > weeklyKm * 1.2`; assert `training_units` snapshot unchanged |
| **#6** | No: every plan/chat/log handler 401s first | New `/api/plan*` or `/api/chat*` ships without `if (!locals.user)` | Handler call with `locals.user = null` / no cookie; assert 401 `UNAUTHORIZED` and no member payload. Not Playwright login. |

**Do not drop or reframe these risks.** They are untested load-bearing gates. Likelihood stays high because of services/API churn plus zero persist/handler coverage.

**Hot-spot evidence is misleading as failure location** (expected under test-plan §1 principle #3):

- Risk #1 cited `src/pages/api` — handlers only check login and pass `locals.user.id`. Isolation lives in **services + RLS**.
- Risk #2 cited `src/lib/services` — accurate as churn, but the landing gate is **`acceptProposition` → `replaceWeek`**, not `openai-chat` / the proposer.
- Risk #6 cited middleware churn — middleware **does not** 401 APIs. The gate is **each JSON handler**.

**Stack constraint that changes the test-plan's "real persist" hypothesis:** CI `npm test` runs with **no** `SUPABASE_URL` / `SUPABASE_KEY` ([`.github/workflows/ci.yml:21`](../../../.github/workflows/ci.yml)). API route modules transitively import `astro:env/server` ([`src/lib/supabase.ts:3`](../../../src/lib/supabase.ts)). There is no two-user fixture, no fake client, no e2e. A Docker/real-JWT suite is **not** the cheapest layer that can run in current CI.

**Response-guidance verdict (do not blindly accept the test plan):**

- **#1 — keep the challenge, correct the oracle.** "Logged in ≠ authorized" is the right challenge (historically real: proposition status was id-only). There is **no** `plan_id` / `log_id` on the HTTP API. B requesting A's **date** as B is **200 with B's week**, not 403. Proof is **A's rows unchanged + payload is not A's km/types**, not HTTP denial.
- **#2 — keep the challenge, correct the persist target.** Out-of-bounds **pending rows are stored on purpose**. Prove Accept does not upsert `training_units`. Existing `gateAccept` / `acceptDecision` tests do **not** close this risk. Browser e2e cannot: the UI disables Accept when stored `hard.length > 0`.
- **#6 — keep the challenge, correct status and layer.** Public 200 on `/` is orthogonal. Gated **APIs** return **401 JSON**, not 302. `/dashboard` is 302. `unauthorized()` unit tests do not prove any handler calls it.

## Detailed Findings

### Risk #1 — Logged-in Member B reads or changes Member A's plan or logs

#### Failure path

**User terms:** Member B, signed in, sees or edits Member A's week or workout logs.

**Code terms:** Every member JSON handler takes `locals.user.id` from the cookie session and never a client-supplied owner. Services trust that `userId` argument and re-apply `.eq("user_id", userId)` on every query. RLS repeats `auth.uid() = user_id`. B reading/writing A's plan/logs today would require **dropping the service filter** and **bypassing RLS** (e.g. `SUPABASE_KEY` set to the service role). A weaker regression (filter dropped, anon JWT still in play) would yield empty selects / failed writes, which the handlers collapse to **empty 200** (reads) or **404** (writes) — still not A's rows, but a failed isolation test if the fake store does not model RLS.

There is **no stealable plan/log UUID** on the API. Resource key is `(user_id, date)` ([`training_units` unique constraint](../../../supabase/migrations/20260813130000_training_units.sql)). Dates are a shared calendar: B `GET /api/plan?weekStart=<A's Monday>` is **B's week for those dates**, often `[]`.

#### How ownership is enforced (session vs body vs DB policy)

| Layer | What it does |
|-------|----------------|
| **Session** | Middleware hydrates `locals.user` on every request ([`src/middleware.ts:8-23`](../../../src/middleware.ts)). Handlers `if (!locals.user) return unauthorized()` then pass `locals.user.id`. |
| **Body / query** | Plan/log/chat schemas are `weekStart` / `date` / `content` / freeze flags. **No `userId` / `user_id` / row UUID.** Zod `safeParse` strips extras. |
| **Service** | Trusts caller `userId`; **always** filters or upserts with it. |
| **RLS** | `auth.uid() = user_id` per operation on `training_units`, `workout_logs`, `chat_messages`, `plan_propositions`. |

Representative handler (plan read — same pattern on logs/chat):

```10:36:src/pages/api/plan.ts
export const GET: APIRoute = async ({ locals, request, cookies, url }) => {
  if (!locals.user) {
    return unauthorized();
  }
  // ...
    const units = await listWeek(supabase, locals.user.id, resolved.weekStart);
    // ...
      logs = await listLogs(supabase, locals.user.id, resolved.weekStart);
    return jsonOk({ weekStart: resolved.weekStart, units, undoAvailable, logs });
```

Service filters:

```211:218:src/lib/services/plan.ts
export async function listWeek(client: SupabaseClient, userId: string, weekStart: string): Promise<TrainingUnit[]> {
  const dates = weekDates(weekStart);
  const { data, error } = await client
    .from("training_units")
    .select(UNIT_COLUMNS)
    .eq("user_id", userId)
    .in("date", dates)
```

```225:238:src/lib/services/plan.ts
export async function replaceWeek(...) {
  const rows = units
    .filter((unit) => window.has(unit.date))
    .map((unit) => ({
      user_id: userId,
      ...toTrainingUnitRow(unit),
    }));
  const { error } = await client.from("training_units").upsert(rows, { onConflict: "user_id,date" });
```

`setFrozen` / `editUnit` also `.eq("user_id", userId).eq("date", date)`. Logs:

```107:114:src/lib/services/workout-log.ts
export async function listLogs(client: SupabaseClient, userId: string, weekStart: string): Promise<WorkoutLog[]> {
  const dates = weekDates(weekStart);
  const { data, error } = await client
    .from("workout_logs")
    .select(LOG_COLUMNS)
    .eq("user_id", userId)
    .in("date", dates)
```

```131:138:src/lib/services/workout-log.ts
  const { error } = await client.from("workout_logs").upsert(
    {
      user_id: userId,
      date: resolved.log.date,
      type: resolved.log.type,
      distance_km: resolved.log.distanceKm,
    },
    { onConflict: "user_id,date" },
```

RLS:

```19:36:supabase/migrations/20260813130000_training_units.sql
ALTER TABLE training_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_units_select_own ON training_units
  FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT WITH CHECK / UPDATE USING+WITH CHECK / DELETE USING: same predicate
```

Same shape on `workout_logs` ([`20260815160000_workout_logs.sql:18-35`](../../../supabase/migrations/20260815160000_workout_logs.sql)) and chat tables ([`20260813160000_chat_gated_adaptation.sql:29-64`](../../../supabase/migrations/20260813160000_chat_gated_adaptation.sql)).

**Bypass:** Postgres service role ignores RLS. The app has **one** client: `createServerClient(SUPABASE_URL, SUPABASE_KEY, cookie JWT)` ([`src/lib/supabase.ts:5-9`](../../../src/lib/supabase.ts)). README/docs treat `SUPABASE_KEY` as the **anon** key; runtime does not assert that. Wrong secret → filters become the only belt. Plans forbade a service-role client (`context/changes/profile-and-race-calendar/plan.md`).

**"Denied" is the wrong HTTP oracle.** Member APIs never send 403. Wrong-owner / missing row is 404 `NOT_FOUND` (e.g. [`src/pages/api/plan/units.ts:24-26`](../../../src/pages/api/plan/units.ts), [`src/pages/api/plan/logs.ts:24-26`](../../../src/pages/api/plan/logs.ts)). Cross-user **read** of a shared `weekStart` is **200** with B's payload.

#### Adjacent surface (not named in Phase 1, but the only UUID IDOR shape)

`PATCH`/`DELETE /api/races/[id]` takes a client UUID and checks owner via `listRaces` + `.eq("id", id).eq("user_id", userId)` ([`src/lib/services/races.ts:139-157`](../../../src/lib/services/races.ts)). Chat once updated propositions by id only; F3 fixed it to `.eq("id", id).eq("user_id", userId)` ([`src/lib/services/chat.ts:338-344`](../../../src/lib/services/chat.ts); [`context/changes/chat-gated-plan-adaptation/reviews/impl-review.md`](../chat-gated-plan-adaptation/reviews/impl-review.md) F3). **Do not expand Phase 1 to races unless the two-user fixture makes the extra case free.** Risk #1 as written is plan + logs.

Admin `GET /api/admin/reports` lists all rows by design (admin SELECT policy). Out of Risk #1.

#### Existing tests

**None prove isolation.** Grep of `src/**/*.test.ts` has no two-user fixture, no `listWeek`/`listLogs`/`upsertLog` with a client, no IDOR. The only `user_id` hit is the races unique-constraint **name** in `races.test.ts`.

- [`src/lib/services/plan.test.ts`](../../../src/lib/services/plan.test.ts) — mapping, `applyUnitEdit` unknown date (`NOT_FOUND` = date not in **this array**, not "another member").
- [`src/lib/services/workout-log.test.ts`](../../../src/lib/services/workout-log.test.ts) — `resolveWorkoutLog` / zod only; never calls persist functions.
- [`src/lib/api.test.ts`](../../../src/lib/api.test.ts) — 401 helper shape (Risk #6), not ownership.

This is exactly the anti-pattern the test plan named: happy-path owner-only (or no owner at all) and no second member.

#### Response guidance — verify / correct

| Test-plan cell | Verdict |
|----------------|---------|
| Prove B's request is denied and does not return or mutate A's rows | **Keep the mutate half; correct "denied".** Assert payload is not A's data **and** A's stored rows unchanged. GET 200 with B's empty week is **success**, not a leak. |
| Challenge "logged in = authorized" | **Keep.** Handlers are login-only; ownership is service+RLS. Historically real (chat F3). |
| Ground session vs body vs DB policy; two-member fixture | **Confirmed.** Session + DB policy. Not body. Fixture: two `userId`s, A's week with distinct km/type, at least one of A's logs, B empty or different unit on the same date. |
| Likely cheapest layer: integration, two users, **real persist** | **Correct the layer.** Real Supabase + two JWTs would also prove RLS, but CI has no DB and no user bootstrap. Cheapest useful proof that still challenges a "always own rows" mock: an in-memory table of **both** members' rows that filters **only when** `.eq("user_id", …)` is invoked. If the service omits the filter, B sees A's rows and the test fails. |
| Avoid happy-path owner-only; avoid mock that always returns own rows | **Keep.** A fake that pre-scopes to the passed `userId` is tautological. |

#### Cheapest useful test layer

1. **Primary:** service-level `listWeek` / `setFrozen` / `editUnit` / `listLogs` / `upsertLog` / `deleteLog` with a shared store and users A and B.
2. **Optional thin handler:** `locals.user = B` + mocked `createClient` returning the same store — only if planning also wants to catch a future body `userId`. That overlaps Risk #5 (Phase 2).
3. **Defer:** real two-JWT Supabase. Worth it later for RLS policy drift; not required to close Phase 1 #1 in current CI.

Browser e2e is not needed: dashboard SSR uses the same `user.id` + services ([`src/pages/dashboard.astro:15-35`](../../../src/pages/dashboard.astro)).

#### Speculative vs real

| Claim | Status |
|-------|--------|
| B can read/change A's plan/logs via the public API today (anon + JWT) | **Not supported.** |
| Isolation is untested | **Real.** |
| "Logged in = authorized" as a class | **Latent / historically real.** Not a live plan/log hole. |
| GET 200 on A's `weekStart` as B is a leak | **False.** |
| `src/pages/api` is where this failure lives | **Misleading hot-spot.** |

---

### Risk #2 — Chat/LLM calendar change lands despite hard bounds

#### Failure path

**User terms:** Chat proposes an illegal week (volume, consecutive longs, or mutated freeze); Accept still rewrites the calendar.

**Code terms:** Propose is `POST /api/chat/messages` → `sendMessage` → `proposeAdaptation`. That path **never** calls `replaceWeek`. It may `insertPending` even when `validation.hard.length > 0`. The only chat write of `training_units` is `acceptProposition` → `replaceWeek` after `acceptDecision` / `gateAccept` / `validatePlan`. Regression: accept upserts **before** (or without) the `if (!decision.ok)` return.

There is **no** `/api/chat/propose`. Accept/reject bodies are `weekStart` only — not a client-supplied proposition snapshot ([`src/pages/api/chat/accept.ts:14-27`](../../../src/pages/api/chat/accept.ts)).

#### Accept / reject path

```
POST /api/chat/messages  → sendMessage → proposeAdaptation → insertPending (full-week snapshot + validation)
POST /api/chat/accept    → acceptProposition → acceptDecision → replaceWeek
POST /api/chat/reject    → rejectProposition (status only)
GET  /api/chat           → listChat
```

Propose does not write the calendar:

```141:147:src/lib/services/chat.ts
    const plan = applyMutations(units, proposed.mutations);
    const frozenUnits = units.filter((unit) => unit.frozen);
    const validation = gateAccept(plan, profile.weeklyKm, frozenUnits).validation;
    await insertMessage(client, userId, monday, "assistant", proposed.reply);
    if (proposed.mutations.length > 0) {
      await rejectPending(client, userId, monday);
      await insertPending(client, userId, monday, plan.units, validation);
```

`insertPending` has no `hard.length` check ([`src/lib/services/chat.ts:319-335`](../../../src/lib/services/chat.ts)). Hard pending + `agent_reports` is **required** S-06 behavior, not a bug.

Accept is the gate:

```200:221:src/lib/services/chat.ts
    const decision = acceptDecision(
      { units: proposedUnits },
      profile.weeklyKm,
      current.filter((unit) => unit.frozen),
    );
    if (!decision.ok) {
      return {
        ok: false,
        error: { code: "HARD_BOUNDS", ... },
        validation: decision.validation,
      };
    }
    await replaceWeek(client, userId, monday, proposedUnits);
    // ...
    await setPropositionStatus(client, userId, pending.id, "accepted");
```

HTTP maps that to **409** with `validation` beside `error` ([`src/pages/api/chat/accept.ts:28-31,42-46`](../../../src/pages/api/chat/accept.ts)). On hard failure the pending row **stays pending**; `training_units` unchanged.

`replaceWeek` callers: `acceptProposition`, `generateAndPersist`, `undoWeek` — **not** the proposer ([grep `replaceWeek`](../../../src/lib/services/plan.ts)).

#### Hard vs soft; independent oracle

PRD states policy, not numbers ([`context/foundation/prd.md:86,102,45-47`](../../../context/foundation/prd.md)): soft may be accepted; hard must never land "even if the member tries to accept."

Numbers live in F-01 / `validatePlan` ([`context/changes/plan-gen-bounds-contract/plan.md:52-54`](../plan-gen-bounds-contract/plan.md)):

```9:24:src/lib/services/validate-plan.ts
  const totalKm = plan.units.reduce((sum, unit) => sum + unit.distanceKm, 0);
  const hardCeiling = context.weeklyKm * 1.2;

  if (totalKm > hardCeiling) {
    hard.push({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "hard", ... });
  } else if (totalKm > context.weeklyKm) {
    soft.push({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft", ... });
  }
```

Also hard: adjacent UTC dates both `type === "long"`; frozen identity (date + type + km + `frozen`) dropped ([`src/lib/services/validate-plan.ts:26-54`](../../../src/lib/services/validate-plan.ts)).

`gateAccept` is `hard.length === 0` ([`src/lib/services/plan-adaptation.ts:47-52`](../../../src/lib/services/plan-adaptation.ts)). Soft never blocks.

| Path | Validates? | Blocks persist on hard? |
|------|------------|-------------------------|
| `generatePlan` | yes | yes → `UNSATISFIABLE_BOUNDS` (no `replaceWeek`) |
| `sendMessage` | yes (display + store) | **no** — pending stored anyway |
| `acceptProposition` | **again**, live `weeklyKm` + live frozen | **yes** |
| `editUnit` (manual PUT) | after write, display | **no** — FR-005 member dictation; **not Risk #2** |

**Can the proposer persist units without Accept?** **NO** for `training_units`. **YES** for `workout_logs` on a log intent (`proposed.log` → `upsertLog` immediately, [`src/lib/services/chat.ts:126-139`](../../../src/lib/services/chat.ts)) — different table, out of this risk.

**Can a failed-validation proposition be stored?** **Yes.** **Accepted while still hard?** Not in current code. If `weeklyKm` **rises** between propose and accept, a previously-hard volume snapshot can become legal and **will land** (server uses live profile). Inverse: weekly km **falls** → 409 even if the UI enabled Accept from the stored snapshot.

**UI is advisory:**

```32:34:src/components/plan/PlanChat.tsx
  const hard = pending?.validation.hard ?? [];
  const acceptEnabled = pending !== null && hard.length === 0 && !busy;
```

S-03 required a **server** re-check "even if the client hides the button" ([`context/changes/chat-gated-plan-adaptation/plan.md:51-53`](../chat-gated-plan-adaptation/plan.md)). Playwright clicking Accept **cannot** hit 409 for stored hard.

DB does not enforce volume/longs/freeze: `training_units` CHECKs type enum and `distance_km >= 0` only.

#### What "calendar unchanged" means

Snapshot `training_units` for `(user_id, dates in Mon..Sun)` — fields `date, type, distance_km, structure, frozen` (`UNIT_COLUMNS`). Compare before vs after Accept.

Do **not** treat `plan_propositions` or `chat_messages` as the calendar. Soft-only Accept **must** change units (negative control). Hard Accept must not change proposition status to `accepted`.

#### Existing tests

| File | Asserts | Gap vs Risk #2 |
|------|---------|----------------|
| `validate-plan.test.ts` | Volume band, longs, freeze on the **validator** | Internals. F-01, not landing. |
| `plan-adaptation.test.ts` | `applyMutations`; `gateAccept` in-memory | No DB. |
| `propose-adaptation.test.ts` | Stub phrases + mutations; then `gateAccept` | **Proposer oracle** if used as expected km. |
| `chat.test.ts` | `acceptDecision` HARD_BOUNDS vs soft-ok | Title says "does not represent a persist" — **comment, not an assertion.** No `acceptProposition`. |
| `generate-plan.test.ts` | Generate-time `UNSATISFIABLE_BOUNDS` | Generate path only. |
| `agent-report.test.ts` | Capture iff mutations + hard | Side channel, not landing. |
| `openai-chat.test.ts` | Schema / HTTP of the model client | No bounds. |
| `plan.test.ts` | `applyUnitEdit` **can** change a frozen day | Confirms **manual** path is ungated. |

**No test imports `acceptProposition` or `replaceWeek`.** Persist-skip is untested.

#### Response guidance — verify / correct

| Test-plan cell | Verdict |
|----------------|---------|
| Out-of-bounds proposition cannot be accepted; calendar unchanged | **Keep**, scoped to **Accept + `training_units`**. Do **not** prove "cannot be stored." |
| Challenge happy-path accept / LLM reply ⇒ safe write | **Keep.** LLM/stub can emit 200 km; that is not a write. |
| Ground accept/reject; hard vs soft; proposer write without accept | **Confirmed.** Proposer cannot write units. Soft is acceptable. |
| Likely cheapest: integration around accept + validator | **Correct:** that means `acceptProposition` / HTTP accept + **row snapshot**, not another `validatePlan` case. `gateAccept` tests already exist and do not close this risk. |
| Avoid validator internals; avoid oracle from generate/proposer output | **Keep.** Construct `sum(distanceKm) > weeklyKm * 1.2` (or two adjacent longs / mutated freeze) from F-01 + `profiles.weekly_km`. Insert a pending row (or `sendMessage` with mocked `complete`). Do not rely on stub phrase `"make Friday 200 km"` as the only fixture. |
| e2e | **Avoid for this risk.** Disabled Accept means the browser never "tries." HTTP/service **is** "the member tries to accept." |

#### Cheapest useful test layer

**Service `acceptProposition` with a fake/real store:** current week in `training_units` + profile `weeklyKm = W` + pending `proposed_units` with volume `> W * 1.2` → not ok / 409 `HARD_BOUNDS` → `listWeek` deep-equals the before snapshot.

Optional control: `W < sum ≤ W * 1.2` **does** change rows (soft lands).

Do not mock `gateAccept` always-ok. Do not fail #2 because `PUT /api/plan/units` persists hard (FR-005).

HTTP accept adds 409 mapping; only worth it if `astro:env` mocking is already in place for Risk #6.

#### Speculative vs real

| Claim | Status |
|-------|--------|
| LLM writes `training_units` on send | **False.** |
| Hard props cannot be stored | **False** — stored by design. |
| Accept currently skips validation | **False.** |
| Tests prove calendar unchanged | **False** — coverage gap. |
| UI disable = NFR | **False.** |
| Manual edit landing hard = Risk #2 | **False.** |
| Regression of `acceptProposition` would land illegal diffs | **Real** — pending already holds illegal snapshots. |
| `src/lib/services` as the test-target list | **Slightly misleading.** Target `chat.ts` accept + `plan.ts` `replaceWeek`. Skip `openai-chat` for this risk. |

---

### Risk #6 — Unauthenticated caller reaches gated plan, chat, or log routes

#### Failure path

**User terms:** Logged-out caller gets member plan, chat, or logs.

**Code terms:** Middleware **always runs** (including `/api/*`) but only **redirects** `/dashboard` and `/admin`. Product JSON is gated by **inline** `if (!locals.user) return unauthorized()` in each handler, **before** zod and `createClient`. A new plan/chat/log route that omits that check is reachable logged-out. RLS would likely yield empty rows (empty 200), which still fails "does not return member data" if any handler skipped the 401.

There is **no** `requireUser` helper. There are **no** `/plan`, `/chat`, or `/logs` pages — product UI is `/dashboard` + `/api/plan*` + `/api/chat*`.

#### Cookie / session vs middleware vs handler

```6:31:src/middleware.ts
const PROTECTED_ROUTES = ["/dashboard", "/admin"];

export const onRequest = defineMiddleware(async (context, next) => {
  // createClient + resolveAuthUser → locals.user
  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }
  return next();
});
```

`resolveAuthUser` is `getUser()`; errors / missing user → `null` ([`src/lib/auth-user.ts:10-19`](../../../src/lib/auth-user.ts)). Empty `Cookie` → no session ([`src/lib/supabase.ts:11-15`](../../../src/lib/supabase.ts)).

JSON APIs **must not** join `PROTECTED_ROUTES`: a middleware 302 would break island `fetch()` (locked in profile/chat plans). `/api/admin/reports` also does not `startsWith("/admin")`.

401 helper:

```15:17:src/lib/api.ts
export function unauthorized(): Response {
  return jsonError(401, "UNAUTHORIZED", "Sign in required");
}
```

Body: `{"error":{"code":"UNAUTHORIZED","message":"Sign in required"}}`. No `Location`.

#### Auth enforcement map

**Pages**

| Route | Gate | Unauthenticated |
|-------|------|-----------------|
| `/` [`src/pages/index.astro`](../../../src/pages/index.astro) | none | **200** marketing — public on purpose |
| `/auth/signin`, `/signup`, `/confirm-email` | none | 200 |
| `/dashboard` | middleware 302 | **302** `/auth/signin`. Page loads data only `if (supabase && user)` ([`dashboard.astro:26`](../../../src/pages/dashboard.astro)) |
| `/admin` | middleware 302, then `isAdmin` 404 | 302 first |

**Plan / chat / log APIs — all handler 401, none middleware-gated**

| Route | Methods | Check |
|-------|---------|-------|
| `/api/plan` | GET, POST | [`plan.ts:11-12,44-45`](../../../src/pages/api/plan.ts) |
| `/api/plan/units` | PATCH, PUT | [`units.ts:11-12,36-37`](../../../src/pages/api/plan/units.ts) |
| `/api/plan/undo` | POST | [`undo.ts:10-11`](../../../src/pages/api/plan/undo.ts) |
| `/api/plan/logs` | POST, DELETE | [`logs.ts:10-11,36-37`](../../../src/pages/api/plan/logs.ts) |
| `/api/chat` | GET | [`chat.ts:10-11`](../../../src/pages/api/chat.ts) |
| `/api/chat/messages` | POST | [`messages.ts:12-13`](../../../src/pages/api/chat/messages.ts) |
| `/api/chat/accept` | POST | [`accept.ts:11-12`](../../../src/pages/api/chat/accept.ts) |
| `/api/chat/reject` | POST | [`reject.ts:10-11`](../../../src/pages/api/chat/reject.ts) |

**Plan/chat/log APIs that skip `locals.user`: none.** Same 401 pattern on `/api/profile` and `/api/races*` (out of named routes but consistent).

**Public auth APIs (must stay off `PROTECTED_ROUTES`):** `POST /api/auth/signin|signup|signout` — form 302s, no JSON 401.

Unauthenticated product API: **401**, not 302, not empty 200, not 500. Check runs before DB — no member data.

If `SUPABASE_*` missing: middleware sets `user = null` → same 401 on APIs. (Authenticated-but-unconfigured is 503; logged-out never gets there.)

#### Challenge: public `/` ⇒ product routes public?

**Orthogonal.** `/` is the marketing landing (`Welcome`). PRD "no guest / cannot access gated product routes" means **`/dashboard` + product APIs**, not `/` ([`prd.md:116-125`](../../../context/foundation/prd.md)). A test that only GETs `/` says nothing about `/api/plan`.

#### Existing tests

- [`src/lib/api.test.ts`](../../../src/lib/api.test.ts) — `unauthorized()` 401 JSON, no `Location`. **Does not import any handler.**
- [`src/lib/auth-user.test.ts`](../../../src/lib/auth-user.test.ts) — mocked `getUser`; no Cookie, no route.
- **No** `middleware.test.ts`. **No** test hits `/api/plan` or `/api/chat` without a session. **No** Playwright.

#### Response guidance — verify / correct

| Test-plan cell | Verdict |
|----------------|---------|
| Logged-out request to gated plan/chat/log routes does not return member data | **Keep.** Assert 401 + `UNAUTHORIZED` + body is not units/logs/messages. |
| Challenge public 200 on `/` | **Keep; `/` is public.** |
| Ground cookie/session vs middleware vs handler | **Confirmed.** Middleware populates user; **handlers** 401 APIs; pages 302. |
| Likely cheapest: integration (no cookie) | **Keep, as handler-level** with `user: null`. Full HTTP no-Cookie is equivalent if middleware is in the loop; not required if handlers own the gate. |
| Avoid full browser login e2e to prove a 401 | **Keep.** Login is irrelevant to logged-out. Also: `/dashboard` is **302**, so a page e2e asserting 401 would be **wrong**. |

**401 is the right assertion for gated APIs. 302 is the right assertion for `/dashboard`.**

#### Cheapest useful test layer

Table-drive `GET /api/plan`, `GET /api/chat`, `POST /api/plan/logs` (plus the rest of plan/chat if cheap) with `locals: { user: null, isAdmin: false }`.

**Vitest snag:** importing `src/pages/api/plan.ts` pulls `@/lib/supabase` → `astro:env/server`. F-01 forbade `astro:` imports in Vitest ([`plan-gen-bounds-contract/plan.md:48`](../plan-gen-bounds-contract/plan.md)). Cheapest unlock: a **one-module** `vi.mock("astro:env/server")` (or extract `unauthorized` usage behind a tiny helper that still leaves **handler imports** as the proof). Do **not** treat another `unauthorized()` unit as closing #6.

Do not add `/api/plan` to `PROTECTED_ROUTES` to make middleware tests green.

#### Speculative vs real

| Claim | Status |
|-------|--------|
| Unauthenticated caller can read/write plan/chat/logs **today** | **Not observed.** |
| Regression: new product API ships without the check | **Real.** Two-layer design + AGENTS.md "protect **pages** via `PROTECTED_ROUTES`." |
| Empty 200 if check skipped and RLS holds | **Plausible** secondary; still a failed HTTP gate. |
| Middleware hot-spot is the failure locus | **Misleading.** Failure lives in `src/pages/api/plan*` and `src/pages/api/chat*`. Middleware bugs that **would** matter: putting `/api` on `PROTECTED_ROUTES` (302 instead of 401). |

---

### Test stack (constraints for `/10x-plan`)

[`vitest.config.ts`](../../../vitest.config.ts): standalone `vitest/config`, `environment: "node"`, `include: ["src/**/*.test.ts"]`, alias `@` → `src`. **Do not** switch to Astro `getViteConfig()`.

Scripts: `npm test` = `vitest run`. CI runs `npm test` **without** Supabase secrets; only `astro build` gets them.

**14 test files, all under `src/lib/`.** None boot Astro, hit HTTP, or use a real DB. No shared factories. No API mocking library. No e2e.

Mocking patterns that exist: `vi.fn()` auth client (`auth-user.test.ts`); injected `fetchImpl` (`openai-chat.test.ts`). **Supabase data access is never mocked.**

Cloudflare adapter / workerd is the **dev** runtime; Vitest is Node-only (test-plan §4). Handler tests in Node are the intended path.

## Code References

- `src/middleware.ts:6-31` — `PROTECTED_ROUTES` `/dashboard` `/admin`; API `next()`
- `src/lib/api.ts:15-17` — 401 `UNAUTHORIZED`
- `src/lib/supabase.ts:1-23` — anon SSR client from Cookie; `astro:env/server`
- `src/lib/auth-user.ts:10-19` — `getUser()` → `null`
- `src/pages/api/plan.ts:10-36` — session id into `listWeek` / `listLogs`
- `src/pages/api/plan/logs.ts` — POST/DELETE 401 then session-scoped upsert/delete
- `src/pages/api/plan/units.ts` — freeze/edit 401; 404 `NOT_FOUND`
- `src/pages/api/chat/accept.ts:10-46` — 401 then `acceptProposition`; 409 `HARD_BOUNDS`
- `src/lib/services/plan.ts:211-241` — `listWeek` / `replaceWeek` `user_id`
- `src/lib/services/workout-log.ts:107-170` — list/upsert/delete scoped by `user_id`
- `src/lib/services/chat.ts:88-227,319-347` — send stores pending; accept re-checks then `replaceWeek`
- `src/lib/services/plan-adaptation.ts:47-52` — `gateAccept`
- `src/lib/services/validate-plan.ts:5-56` — hard ceiling `weeklyKm * 1.2`, consecutive longs, frozen identity
- `src/lib/services/generate-plan.ts:40-47` — generate-time hard block
- `src/components/plan/PlanChat.tsx:32-34` — Accept disabled on stored hard
- `src/pages/index.astro` — public `/`
- `src/pages/dashboard.astro:15-35` — SSR loads only `if (user)`
- `supabase/migrations/20260813130000_training_units.sql:19-36` — RLS
- `supabase/migrations/20260815160000_workout_logs.sql:18-35` — RLS
- `supabase/migrations/20260813160000_chat_gated_adaptation.sql:29-64` — chat/proposition RLS
- `vitest.config.ts` — Node include `src/**/*.test.ts`
- `.github/workflows/ci.yml:21-25` — `npm test` has no Supabase env
- `src/lib/api.test.ts` / `src/lib/services/chat.test.ts` — helper coverage, not persist/handler

## Architecture Insights

1. **Two-layer auth is intentional.** HTML: middleware 302. JSON: per-handler 401. Do not "fix" tests by listing `/api/*` in `PROTECTED_ROUTES`.
2. **Identity for plans/logs is `(user_id, date)`, not a resource UUID.** Cross-user tests must use two users on the **same dates**, not a stolen id.
3. **Services trust `userId`; RLS is the second belt.** Tests that inject a client **without** JWT RLS must still fail if `.eq("user_id")` is missing — that is the application belt.
4. **Chat is propose-then-accept.** Storing an illegal pending row is the product. Landing is `replaceWeek` after a **live** re-check (weekly km and frozen flags can change between propose and accept).
5. **One bound surface.** Do not copy `1.2` / consecutive-long / freeze rules into chat tests as validator-output snapshots. Use documented F-01 constants as the **input** construction, then assert persist-skip.
6. **Vitest cannot see `astro:` without a mock.** Phase 1 handler tests need a single env mock; do not migrate to `getViteConfig()`.
7. **Cost × signal for this stack:** in-memory two-user store + `acceptProposition` persist-skip + handler `user: null` 401s. Real DB and Playwright are more expensive and, for #2, weaker.

## Historical Context (from prior changes)

- `context/foundation/prd.md` — FR-008, NFR hard-bounds, NFR isolation, Access Control (no guest).
- `context/foundation/test-plan.md` — Phase 1 risks #1/#2/#6; response intent this research verifies.
- `context/changes/plan-gen-bounds-contract/plan.md` — Vitest standalone config; volume band `weeklyKm * 1.2`; no `astro:` in F-01 tests.
- `context/changes/chat-gated-plan-adaptation/plan.md` — server re-check on Accept; JSON APIs not `PROTECTED_ROUTES`; pending snapshot + 409; RLS on chat tables.
- `context/changes/chat-gated-plan-adaptation/reviews/impl-review.md` F3 — proposition update was id-only; fixed with `user_id` (shows "logged in = authorized" is a lived pattern).
- `context/changes/profile-and-race-calendar/plan.md` — anon+JWT not service role; do not put `/api/profile` on `PROTECTED_ROUTES`.
- `context/archive/` — empty of slice research (README only).

S-03 allowed a helper-only `acceptDecision` test as a shortcut; that **does not** satisfy "calendar unchanged" for this rollout.

## Related Research

No prior `research.md` in `context/changes/` or `context/archive/`. This is the first research artifact for the test rollout.

## Open Questions

None that block `/10x-plan`. Planner should treat the following as **locked by this research**, not as questions:

1. Do **not** add Playwright for Phase 1.
2. Do **not** require real Supabase/JWTs in CI to close #1/#2/#6 (optional later; Phase 3 already owns migrate-over-fixture).
3. Do **not** treat race UUID IDOR as in-scope unless it rides the same two-user fake for free.
4. Test-plan §2 Source/hot-spot and "real persist" / "denied" wording are **response-guidance corrections** (see Summary). Backport is a `/10x-test-plan` decision: Source column, risk wording, or Risk Response Guidance only — never file:line anchors.
