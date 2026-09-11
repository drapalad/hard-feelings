---
date: 2026-08-31T17:37:06+00:00
researcher: Cursor Grok 4.6
git_commit: 7a82cda0a215bc037e60643f60a586b5b44add99
branch: testing-generation-oracle-and-api-contracts
repository: hard-feelings
topic: "Ground rollout Phase 2 of context/foundation/test-plan.md (Risks #3, #5)"
tags: [research, codebase, generate-plan, weekly-km, api-contracts, vitest, zod]
status: complete
last_updated: 2026-08-31
last_updated_by: Cursor Grok 4.6
---

# Research: Ground rollout Phase 2 of context/foundation/test-plan.md (Risks #3, #5)

**Date**: 2026-08-31T17:37:06+00:00
**Researcher**: Cursor Grok 4.6
**Git Commit**: 7a82cda0a215bc037e60643f60a586b5b44add99
**Branch**: testing-generation-oracle-and-api-contracts
**Repository**: hard-feelings

## Research Question

Ground rollout Phase 2 of `context/foundation/test-plan.md` ("Generation oracle and API contracts").

Risks to verify: #3 (generate success but week not executable vs declared weekly km), #5 (server persists a plan/log mutation from untrusted client input).

Risk response guidance to verify, not blindly accept:

- **#3**: prove after generate, total week volume is coherent with declared weekly km (independent oracle); challenge HTTP 200 + some calendar rows means executable; avoid snapshot of generated units as expected km.
- **#5**: prove invalid or forged mutation is rejected; persisted row does not take a client-supplied owner; challenge client-side schema equals server contract; avoid mirroring the handler’s parse in the test.

Hot-spot directories (likelihood evidence — not anchors): `src/lib/services`, `src/pages/api`.

Stack: Vitest 4, include `src/**/*.test.ts`, memory-supabase at `src/lib/test/memory-supabase.ts`, no Playwright in this phase. FU-015 `roundKm` is already shipped — oracle must not fail on `50.00000000000001`.

## Summary

Both risks are **real coverage gaps**, not open product holes. Generate already aims leftover km at the profile target and persists via `generateAndPersist` → `replaceWeek`. Plan/log handlers already parse with Zod and persist `user_id` from `locals.user.id`. Nothing proves (a) week **volume** against an independent 1-decimal oracle after generate, or (b) that a hostile JSON body cannot set owner / extra fields at the handler boundary.

| Risk | Live hole today? | What would actually break | Cheapest useful layer |
|------|------------------|---------------------------|------------------------|
| **#3** | No demonstrated volume miss after FU-015 | Fill-split / last-day remainder / persist drops km; HTTP 200 with 7 rows whose `roundKm(sum)` ≠ profile `weeklyKm` | Unit `generatePlan` with `roundKm(sum) === roundKm(weeklyKm)` from the **input** profile, plus handler `POST /api/plan` that reads **stored** `training_units` with the same oracle |
| **#5** | No demonstrated owner-from-body | Handler skips `safeParse`, or persist copies `userId` from JSON; invalid km/type/date still upserts | Handler-level Vitest: invalid body → 400 and store unchanged; extra `userId`/`user_id`/`type` → 200 but row owner is session id (and log type comes from the planned unit) |

**Do not drop or reframe these risks.** They are untested load-bearing contracts. Likelihood stays high because generate and API handlers churn and Phase 1 explicitly left forged-body to Phase 2.

**Hot-spot evidence is slightly misleading as failure location** (expected under test-plan §1 principle #3):

- Risk #3 cited `src/lib/services` — correct for the algorithm (`generate-plan.ts`) **and** persist (`generateAndPersist` in `plan.ts`). HTTP 200 lives on `POST /api/plan`; proving only the pure function does **not** challenge “rows exist ⇒ executable.”
- Risk #5 cited `src/pages/api` — handlers call `safeParse` then pass `locals.user.id`. Schemas and persist live in **services**. There is **no runtime client schema** to equal; `UnitEditPayload` is TypeScript-only.

**FU-015 is a prior, not this phase’s work.** `roundKm` (`src/lib/km.ts`) is used in the fill split and in `validatePlan` volume compare. Existing generate success test asserts raw `sum === 50` (not `roundKm`) and does not cover remainder weekly km (e.g. 40.5) or persist. The Phase 2 oracle **must** use `roundKm` so IEEE dust is not a false fail, and **must not** copy per-day fill distances from `generatePlan` output.

**Response-guidance verdict:**

- **#3 — keep the challenge; tighten “executable.”** After `ok: true` generate with **at least one empty day** and in-week frozen km **≤** declared weekly km, `roundKm(sum(distanceKm))` equals `roundKm(profile weeklyKm)`. Seven calendar rows / HTTP 200 is not that proof. Frozen already in the 100–120% band may succeed with leftover 0 km days and a **soft** warning — that is product, not a fail. All-days-frozen under target cannot fill; total stays frozen sum. Do not snapshot generated per-day km as expected values. Do not copy `remainingKm / fillCount` into the test.
- **#5 — keep the challenge; correct “client-side schema.”** There is no client Zod. The dangerous assumption is “the React `fetch` body is the contract.” Tests send raw JSON and never `safeParse` with `unitEditSchema` / `workoutLogWriteSchema`. Zod default **strips** unknown keys (`userId`, `frozen` on PUT, `type` on log). Owner is always the session argument into `editUnit` / `upsertLog` / `replaceWeek`. Schema-only unit tests in `plan.test.ts` / `workout-log.test.ts` do **not** prove handler 400 or no persist.

## Detailed Findings

### Risk #3 — Generate reports success, but the week is not executable against declared weekly km

#### Failure path

**User terms:** Member generates a week for their declared weekly km; the calendar looks full but the week is not runnable at that volume (too little, too much, or float dust looking like a miss).

**PRD:** “Generated/adapted plan remains executable relative to the user's declared weekly volume” (`context/foundation/prd.md`). FR-002: weekly km affects the plan.

**Code terms:** `POST /api/plan` → `generateAndPersist` loads profile + races + in-week frozen units, calls `generatePlan`, and on `ok` snapshots then `replaceWeek`.

Fill split (`src/lib/services/generate-plan.ts`):

```27:40:src/lib/services/generate-plan.ts
  const frozenKm = inWeekFrozen.reduce((sum, unit) => sum + unit.distanceKm, 0);
  const remainingKm = roundKm(Math.max(0, input.weeklyKm - frozenKm));
  const fillCount = emptyDates.length;
  const perDay = fillCount === 0 ? 0 : roundKm(remainingKm / fillCount);

  const fillUnits: TrainingUnit[] = emptyDates.map((date, index) => {
    const isLast = index === fillCount - 1;
    const distanceKm = isLast ? roundKm(remainingKm - perDay * (fillCount - 1)) : perDay;
    return {
      date,
      type: FILL_TYPES[index % FILL_TYPES.length],
      distanceKm,
      frozen: false,
    };
  });
```

Then `validatePlan` (hard empty required for `ok: true`). Persist:

```287:309:src/lib/services/plan.ts
export async function generateAndPersist(...) {
  // profile + races + week → generatePlan
  if (!result.ok) {
    return result;
  }
  await snapshotWeekIfChanged(...);
  await replaceWeek(client, userId, monday, result.plan.units);
  return result;
}
```

Handler returns `jsonOk({ weekStart, plan, validation, ... })` on success (`src/pages/api/plan.ts` POST). It does **not** re-check volume. A regression that writes 7 rows totaling 0 km (or 70 km) still 200s if `validation.hard` is empty.

`validatePlan` volume band is **not** the generate oracle: at-or-under target is silent; 100–120% is **soft** (generate still `ok`); over 120% is **hard** (`UNSATISFIABLE_BOUNDS`). A week of 40 km against a 50 km profile has empty hard/soft and would pass a “no WEEKLY_VOLUME_EXCEEDED” assertion. That is why the oracle must be **sum vs declared weekly km**, not validator emptiness.

#### What “executable” means (grounded)

| Input | Expected after `ok: true` |
|-------|---------------------------|
| ≥1 empty day, in-week frozen km ≤ weeklyKm | `roundKm(sum of all unit.distanceKm) === roundKm(weeklyKm)`; `validation.hard` empty |
| In-week frozen km in (weeklyKm, weeklyKm×1.2] | Generate still ok; leftover empty days at 0 km; total ≈ frozen km; **soft** `WEEKLY_VOLUME_EXCEEDED` |
| In-week frozen km > weeklyKm×1.2 (or consecutive frozen longs) | `ok: false`, `UNSATISFIABLE_BOUNDS`; **no persist** |
| Every day frozen, sum ≤ weeklyKm | Cannot fill; total stays frozen sum (not weeklyKm). Boundary, not a fill-split bug |

IEEE: `roundKm(50.00000000000001) === 50` (`src/lib/km.ts`). Profile writes already at most one decimal (`weeklyKmSchema` in `profile-races.ts`).

#### Existing tests

- `generate-plan.test.ts` success path: 7 dates, empty hard/soft, each `distanceKm` one decimal, **`reduce sum === 50`**. That last line is an independent-ish oracle for **one** weeklyKm, but it hardcodes 50 without `roundKm`, does not cover remainder targets (40.5 → last-day remainder), and does not inspect persist.
- Frozen 55 km: leftover 0 km, soft volume — good product pin; not the at-target oracle.
- `validate-plan.test.ts`: `roundKm` dust; 50/7 copies are not a generate test.
- `plan-revisions.test.ts` `generateAndPersist`: snapshots/undo; asserts week **changed** and length 7, **not** volume vs profile.
- No handler-level generate test besides logged-out 401 (`product-gates.test.ts`).

#### Cheapest useful layer

1. **Unit** `generatePlan`: named oracle helper `roundKm(sum(units.distanceKm))` vs `roundKm(input.weeklyKm)` for 50 **and** 40.5, plus one under-target frozen fill. Do not assert per-day km or types as the volume oracle.
2. **Handler integration** `POST /api/plan`: mock `createClient` → memory-supabase (do **not** mock `generateAndPersist`); seed profile + A race; assert HTTP 200 **and** stored rows pass the same oracle. This is the “200 + rows ≠ executable” challenge.

Do not add Playwright. Do not snapshot `result.plan.units` as expected km. Do not treat `validation.soft === []` as the oracle.

#### Speculative?

No. The algorithm and persist exist. The gap is the oracle. Soft-band over-frozen success is **not** a miss vs weekly km — do not fail that case.

---

### Risk #5 — Server persists a plan/log mutation from untrusted client input

#### Failure path

**User terms:** A client (or attacker) posts extra fields (`userId`, another member’s id, `frozen`, workout `type` on a log) or garbage (negative km, unknown type, bad date) and the server writes it.

**Code terms:** Logged-in handlers `safeParse` then call services with **`locals.user.id`**, never a body owner.

Plan/log write schemas (`src/lib/services/plan.ts`, `workout-log.ts`):

- `generateBodySchema`: optional `weekStart` only.
- `freezeWriteSchema`: `date`, `frozen`.
- `unitEditSchema`: `date`, `type` enum, `distanceKm` nonnegative, optional `structure`.
- `workoutLogWriteSchema`: `date`, optional nonnegative `distanceKm`.
- `restoreBodySchema`: optional `weekStart`, `revisionId` uuid.

None include `userId` / `user_id`. Zod object parse **strips** unknown keys (no `.strict()` / `.passthrough()`).

Persist owner:

```439:468:src/lib/services/plan.ts
export async function editUnit(client, userId, patch) {
  // ...
        .update({ type, distance_km, structure })
        .eq("user_id", userId)
        .eq("date", patch.date)
```

```121:138:src/lib/services/workout-log.ts
  const { error } = await client.from("workout_logs").upsert(
    {
      user_id: userId,
      date: resolved.log.date,
      type: resolved.log.type,      // from planned unit, not body
      distance_km: resolved.log.distanceKm,
    },
    { onConflict: "user_id,date" },
  );
```

`replaceWeek` maps `user_id: userId` onto generated rows. Log `type` is copied from the calendar unit (`resolveWorkoutLog`); a body `type: "long"` is stripped before the service runs.

Client (`PlanWorkspace.tsx`): `JSON.stringify({ weekStart })`, `{ date, frozen }`, `UnitEditPayload` (`date`, `type`, `distanceKm`, `structure`), `{ date }` for log. **No Zod.** `UnitEditPayload` is a TS interface in `PlanCalendar.tsx`. Challenge “client-side schema equals server contract” is therefore: do not treat that interface (or importing the server schema in the test) as proof the handler rejects hostile JSON.

Invalid parse → `jsonError(400, "VALIDATION_ERROR", …)` **before** `createClient` (units PUT/PATCH, logs POST). Store must stay unchanged.

#### Existing tests

- `plan.test.ts` `unitEditSchema`: rejects negative km and unknown type — **schema only**, no handler, no store.
- `workout-log.test.ts` `workoutLogWriteSchema`: same.
- `product-gates.test.ts`: logged-out 401 only; never a logged-in body.
- `ownership.test.ts`: B vs A isolation (Phase 1); not extra fields on a valid session.
- Phase 1 plan explicitly deferred “thin handler test that B’s locals.user plus a body userId is rejected” to this phase.

#### Cheapest useful layer

Handler tests colocated under `src/pages/api/` (cookbook §6.4): `vi.mock("astro:env/server")` **and** `vi.mock("@/lib/supabase")` returning the **same** memory client the test seeds (hoisted holder). Do **not** mock `editUnit` / `upsertLog`.

Minimum matrix (cost × signal):

| Call | Body | Prove |
|------|------|--------|
| `PUT /api/plan/units` | negative `distanceKm` / unknown `type` / bad date | 400 `VALIDATION_ERROR`; no `training_units` change |
| `PUT /api/plan/units` | valid edit + `userId` / `user_id` of another member | 200; stored `user_id` is session user; victim has no new/changed row |
| `POST /api/plan/logs` | valid date + extra `userId` + extra `type` | 200; log `user_id` is session; `type` matches planned unit not body |
| `POST /api/plan/logs` | negative `distanceKm` | 400; no log row |

PATCH freeze with extra `userId` is a cheap sibling (same strip + `setFrozen(..., locals.user.id)`). Do not expand to `/api/profile`, `/api/races*`, or admin (not this risk’s plan/log surface). Do not `.strict()` product schemas in this phase.

Do not import `unitEditSchema.safeParse` in the contract test to decide validity — send literals.

#### Speculative?

No. Owner-from-session is implemented; untested at HTTP. `.strict()` rejection of extras is **not** current product (strip + ignore is). Tests should expect strip-and-persist-as-session, not 400 on extra keys.

---

## Code References

- `src/lib/km.ts:1-3` — `roundKm` (FU-015)
- `src/lib/services/generate-plan.ts:8-56` — generate + fill split + `validatePlan` gate
- `src/lib/services/validate-plan.ts:6-26` — volume band (not the generate oracle)
- `src/lib/services/plan.ts:29-48` — write schemas; `287-309` generateAndPersist; `231-261` replaceWeek; `439-509` editUnit
- `src/lib/services/workout-log.ts:11-18` — log schemas; `92-105` resolveWorkoutLog; `121-149` upsertLog
- `src/pages/api/plan.ts:50-83` — POST generate handler
- `src/pages/api/plan/units.ts:10-72` — PATCH freeze / PUT edit
- `src/pages/api/plan/logs.ts:9-33` — POST log
- `src/lib/supabase.ts:5-8` — `createClient` (must mock for logged-in handler tests)
- `src/lib/test/memory-supabase.ts:273-287` — shared fake; leak unless `.eq("user_id")`
- `src/pages/api/product-gates.test.ts` — `vi.mock("astro:env/server")` + handler call pattern
- `src/components/plan/PlanCalendar.tsx:14-19` — `UnitEditPayload` (TS only)
- `src/lib/services/generate-plan.test.ts:60-73` — existing sum===50, not persist, not remainder km
- `src/lib/services/plan.test.ts:176-181` / `workout-log.test.ts:30-35` — schema units, not HTTP

## Architecture Insights

1. **Owner is never a body field** on plan/log JSON. Phase 1 IDOR is missing `.eq("user_id")`. Phase 2 is **forged extras on a valid session**.
2. **Zod strip ≠ reject.** Extra keys do not 400. The proof is persisted owner/type, not `safeParse` failure on extras.
3. **`validatePlan` cannot be the generate volume oracle.** Under-target is valid for the validator and invalid for “executable vs declared weekly km.”
4. **Handler generate tests need `createClient` mocked.** 401 tests return before `createClient`. Logged-in tests would otherwise hit `createServerClient` with stub env. Mock the factory; keep persist services real against memory-supabase.
5. **Do not pre-scope the memory client to `userId`.** Same Phase 1 rule: hide other members only when the query filters by owner.
6. **Last empty day carries remainder** so 50/7 becomes `7.1×6 + 7.4`. Asserting per-day equality to `roundKm(weeklyKm/7)` would fail on purpose. Sum-level oracle is the point.

## Historical Context (from prior changes)

- `context/archive/2026-08-24-testing-critical-path-ownership-and-bounds/` — Phase 1; cookbook §6.2/§6.4; deferred forged-owner body to Phase 2; memory-supabase + product-gates pattern.
- `context/changes/weekly-volume-float-round/` — FU-015 `roundKm` in fill split and validate; explicitly did **not** write Phase 2 cookbook §6.1; last-day remainder accepted so the week still totals the target.

## Related Research

- `context/archive/2026-08-24-testing-critical-path-ownership-and-bounds/research.md` — Risks #1/#2/#6; handler 401; do not pre-scope fake.
- `context/changes/weekly-volume-float-round/plan.md` — fill remainder and 1-decimal rule this oracle must use.

## Open Questions

None that block planning. All-days-frozen under target is documented as an oracle **exception** (cannot fill), not a product change in this phase.
