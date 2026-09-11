---
date: 2026-08-31T20:26:35+02:00
researcher: Cursor Grok 4.6
git_commit: 7dcb20a1d4e10f6ae9caa80bcaecd1d91393414b
branch: testing-quality-gates-wiring
repository: hard-feelings
topic: "Ground rollout Phase 4 of context/foundation/test-plan.md (quality-gates wiring; Playwright only if HTTP misses Accept-in-UI)"
tags: [research, codebase, ci, vitest, husky, lint-staged, playwright, accept-ui]
status: complete
last_updated: 2026-08-31
last_updated_by: Cursor Grok 4.6
---

# Research: Ground rollout Phase 4 of context/foundation/test-plan.md

**Date**: 2026-08-31T20:26:35+02:00
**Researcher**: Cursor Grok 4.6
**Git Commit**: 7dcb20a1d4e10f6ae9caa80bcaecd1d91393414b
**Branch**: testing-quality-gates-wiring
**Repository**: hard-feelings

## Research Question

Ground rollout Phase 4 of `context/foundation/test-plan.md` (§3 and §5).

Prove: CI fails if Phase 1–3 suites fail (ownership, accept persist-skip, generate oracle, API contracts, migration-safety harness).

Playwright on accept-in-UI only if HTTP/handler tests cannot see a real Accept-in-UI failure. Challenge: “add e2e because it feels safer.”

Existing: `src/pages/api/product-gates.test.ts`, `accept-proposition.test.ts`, `plan-contracts.test.ts`, `generate-plan.test.ts`, `migration-safety.test.ts`, `migration-pg.test.ts` (skipped unless `HF_MIGRATION_PG=1`).

Calendar Accept is a React island; HTTP Accept is the persist gate. Determine whether UI-only bugs (disabled button vs still-callable fetch) are a listed risk that HTTP misses.

If Playwright is NOT warranted, say so explicitly and do not add it.

Also check: lint-staged / husky / afterFileEdit already mentioned in §5 — do they still match disk? Do not invent a second CI workflow if one job already runs `npm test`.

Fill cookbook §6.3 only if e2e is added; otherwise write why it stays unused.

## Summary

**Playwright is not warranted. Do not add e2e.** HTTP and the `acceptProposition` persist-skip suite already see the listed Accept failure (out-of-bounds week landing on `training_units`). The Accept button `disabled` attribute is a UX hint, not the NFR. A still-callable `fetch("/api/chat/accept")` while the button is disabled is the intended architecture, not a hole the browser must close.

**CI already fails when Phase 1–3 tests fail.** One job in `.github/workflows/ci.yml` runs `npm test` (`vitest run`) after lint. Vitest include is `src/**/*.test.ts`. Every Phase 1–3 file sits under that glob. Default CI does not set `HF_MIGRATION_PG` (2 skipped Postgres tests) — keep it that way. Do not add a second workflow.

**The remaining Phase 4 hole is silent omission**, not “tests run but CI ignores failures.” If `include` narrows, if a required file is deleted, if `npm test` is dropped from the YAML, or if someone enables Docker-Postgres in Actions, the floor moves. A colocated meta-test that reads those configs (and asserts the required files exist) is the cheapest extra signal. It cannot catch deleting the entire `npm test` step *and* the meta-test together — that is the same class as deleting the job.

**§5 local gates still match disk:** husky `pre-commit` → `lint-staged --concurrent false`; lint-staged runs `vitest related --run --passWithNoTests` on `src/**/*.{ts,tsx}`; Cursor `afterFileEdit` runs `.cursor/hooks/related-tests.sh` scoped to `src/lib/services` and `src/pages/api`. No §2 backport.

| Question | Verdict |
|----------|---------|
| Does CI fail if Phase 1–3 suites fail? | **Yes today**, via single-job `npm test` + `src/**/*.test.ts` |
| Does HTTP miss a listed Accept-in-UI failure? | **No.** Persist gate is `acceptProposition` / `POST /api/chat/accept` |
| Add Playwright? | **No.** UI disable is the anti-pattern named in §2 Risk #2 |
| Enable `HF_MIGRATION_PG` in CI? | **No.** CI has no Docker Postgres; skippable path is not load-bearing for the default floor |
| Second CI workflow? | **No.** One `ci` job already runs `npm test` |
| §5 husky / lint-staged / afterFileEdit stale? | **No.** Disk matches §5 |

## Detailed Findings

### 1. Current CI already runs the Phase 1–3 floor

`.github/workflows/ci.yml` is a single job `ci` on `ubuntu-latest`: checkout, Node 22, `npm ci`, `npx astro sync`, `npm run lint`, `npm test`, `npm run build` (build is the only step with `SUPABASE_URL` / `SUPABASE_KEY`). There is no other workflow under `.github/workflows/`.

`package.json` `"test": "vitest run"`. `vitest.config.ts` uses standalone `vitest/config` (AGENTS.md lock) with `include: ["src/**/*.test.ts"]` and Node environment.

Phase 1–3 files on disk, all matching the include glob:

| Suite | Path | Role |
|-------|------|------|
| Ownership | `src/lib/services/ownership.test.ts` | Risk #1 two-user isolation |
| Accept persist-skip | `src/lib/services/accept-proposition.test.ts` | Risk #2 calendar unchanged on hard bounds |
| Generate oracle | `src/lib/services/generate-plan.test.ts` | Risk #3 `roundKm` vs declared weekly km |
| API contracts | `src/pages/api/plan-contracts.test.ts` | Risks #3 persist + #5 forged/invalid bodies |
| Product 401 | `src/pages/api/product-gates.test.ts` | Risk #6 logged-out JSON APIs, including `POST /api/chat/accept` |
| Migration harness | `src/lib/test/migration-safety.test.ts` | Risk #4 migrate-over-fixture in default `npm test` |
| Postgres owner-read | `src/lib/test/migration-pg.test.ts` | Risk #4 skippable; `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")` at line 87 |

`npm test` is `vitest run`. Vitest exits non-zero on failed tests. A failing Phase 1–3 assertion already fails the `ci` job. That is the “fail CI if suites fail” proof for the current YAML.

**Do not enable `HF_MIGRATION_PG` in CI.** The skippable path needs local Docker Postgres (`127.0.0.1:54322`). This workflow has no Docker service, no `supabase start`, and no compose. Making that path required would turn skippable tests into CI-red without adding the listed default-floor protection. The default harness (`migration-safety.test.ts`) is the CI-cheap oracle; Postgres remains local opt-in.

### 2. Silent-omission risk (what Phase 4 still buys)

Three omission modes the current job does **not** assert:

1. **Include drift** — changing `include` to e.g. `src/lib/services/**/*.test.ts` would drop API contracts, product gates, and the migration harness while `npm test` still exits 0.
2. **File deletion / move** — removing `ownership.test.ts` or moving it to `tests/` (Playwright’s empty `testDir`) drops the suite without a YAML change.
3. **YAML drift** — deleting `run: npm test`, adding `HF_MIGRATION_PG: "1"`, or adding a Playwright job “because e2e exists in package.json”.

Cheapest extra layer: a Vitest file under the existing include (e.g. `src/lib/test/quality-gates.test.ts`) that **reads** `vitest.config.ts`, `.github/workflows/ci.yml`, `package.json` lint-staged, `.husky/pre-commit`, `.cursor/hooks.json`, and `migration-pg.test.ts` as text, and asserts:

- include still `src/**/*.test.ts`
- the seven required files exist (and contain `describe(`)
- CI YAML contains `npm test`, does not mention `HF_MIGRATION_PG` or `playwright`, and still has a single `ci` job
- lint-staged / husky / afterFileEdit still match §5
- `migration-pg.test.ts` still uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`

This is not tautological: the oracle is the **named Phase 1–3 paths and config literals**, not “whatever tests currently exist.” It lives inside `npm test`, so it rides the existing job. Do **not** add a second workflow or a second job that only lists files.

Limitation (honest): if someone removes both `npm test` and this file, nothing in CI notices. Catching that without a second job is GitHub required-checks / review, not a new workflow.

### 3. Accept-in-UI vs HTTP persist — Playwright is not warranted

**Listed risk (#2):** a chat/LLM calendar change **lands** even though it violates hard bounds. Oracle: `training_units` unchanged; storing pending is allowed. Anti-pattern already in the test plan: “Playwright Accept click (UI disables the button).”

**Persist path (HTTP sees this):**

- `PlanWorkspace.accept()` always `fetch("/api/chat/accept", { method: "POST", body: JSON.stringify({ weekStart }) })` — no client-side hard-bounds check (`src/components/plan/PlanWorkspace.tsx` ~296–331).
- `POST` handler requires `locals.user`, parses `weekStart`, then calls `acceptProposition` (`src/pages/api/chat/accept.ts` 10–27). Out-of-bounds returns 409 `HARD_BOUNDS` (49–53).
- `acceptProposition` re-runs `acceptDecision` / `gateAccept` against **live** `weeklyKm` and frozen units. On `!decision.ok` it returns `HARD_BOUNDS` **before** `replaceWeek` (`src/lib/services/chat.ts` 200–214).
- `accept-proposition.test.ts` constructs `sum(distanceKm) > weeklyKm * 1.2`, calls `acceptProposition`, asserts week snapshot unchanged and proposition stays `pending`. Soft-band control **does** land. Live `weeklyKm` drop re-check is covered.

**UI path (HTTP does not need this for Risk #2):**

- `PlanChat` computes `acceptEnabled = pending !== null && hard.length === 0 && !busy` and sets `disabled={!acceptEnabled}` on the Accept `Button` (`src/components/plan/PlanChat.tsx` 31–34, 99–106).
- Stored `validation.hard` is a **display** snapshot. Accept **re-checks live** weekly km (service test already covers a previously-soft snapshot after a profile drop).

**Disabled button vs still-callable fetch:**

| Scenario | Listed risk (#2) hit? | Who sees it |
|----------|----------------------|-------------|
| Button disabled, user still POSTs `/api/chat/accept` | Only if persist skips the re-check | `acceptProposition` / handler tests |
| Button enabled despite stored hard violations | UX; persist still 409 if gate holds | HTTP; Playwright would only assert `disabled` |
| Button disabled **and** persist re-check removed | Calendar would land **if** a client POSTs | HTTP tests go red; Playwright click on disabled control **never fires** the request and **masks** the hole |

The “UI-only bug” (disabled vs fetch) is **not** a listed risk that HTTP misses. It is the architecture the NFR requires: the island may hide Accept; the server must still refuse. Adding Playwright because it “feels safer” is the exact anti-pattern in §2.

`product-gates.test.ts` already calls the Accept handler with `locals.user = null` and asserts 401 JSON. That is Risk #6, not #2. Do not add Playwright for 401 either (§6.4).

### 4. Unused Playwright leftover is not a suite

`@playwright/test` is a devDependency. `playwright.config.ts` points `testDir` at `./tests`. There is **no** `tests/` directory and **no** `*.spec.ts` e2e file. CI does not run Playwright. `package.json` has no `test:e2e` script.

This is bootstrap leftover, not a quality gate. Phase 4 must **not** wire it, **not** add `webServer` + `preview`, **not** install browsers in Actions. Leave the unused files unless a later cleanup change removes them (out of this phase). Cookbook §6.3 should say e2e was **not** added and why, not how to write Playwright.

### 5. §5 local gates still match disk

| Gate | §5 claim | Disk |
|------|----------|------|
| lint | local + CI | `npm run lint` → `eslint .`; CI step present |
| related tests on staged `src/**/*.{ts,tsx}` | pre-commit (lint-staged) | `package.json` lint-staged: `"src/**/*.{ts,tsx}": ["vitest related --run --passWithNoTests"]` |
| husky | implied by lint-staged | `.husky/pre-commit`: `export AI_AGENT=1` then `npx lint-staged --concurrent false`; `"prepare": "husky"` |
| afterFileEdit on services/API | Cursor hook, local not CI | `.cursor/hooks.json` `afterFileEdit` → `.cursor/hooks/related-tests.sh`; script greps `^src/(lib/services\|pages/api)/.+\.(ts\|tsx)$`, fail-open, `AI_AGENT=1 npx vitest related` |

No drift. Phase 4 should **assert** these literals remain, not reinvent them.

### 6. Response-guidance / §2 backport

- Risk #2 cheapest layer stays integration around accept persist-skip. Playwright remains the anti-pattern.
- No speculative-risk drop. No misleading hot-spot that needs a Source-column edit.
- **Do not backport file:line into §2.**

§6.3 must **not** become a Playwright cookbook. Fill it with an explicit unused note: HTTP sees the accept failure.

§5 rows this phase actually wires:

- “CI includes Phase 1–3 tests” → `required` (meta-test + existing `npm test`).
- “e2e on accept-in-UI (Playwright)” → **not required**; research: HTTP sees the accept failure.
- lint / related tests / unit+integration / production build — already `required`; confirm, do not duplicate jobs.

## Code References

- `.github/workflows/ci.yml:1-25` — single `ci` job; `npm test`; no Docker; secrets only on build
- `vitest.config.ts:4-6` — Node env, `include: ["src/**/*.test.ts"]`
- `package.json:13` — `"test": "vitest run"`
- `package.json:69-85` — lint-staged related-tests + eslint
- `.husky/pre-commit:1-3` — `AI_AGENT=1` + lint-staged
- `.cursor/hooks.json:4-8` — afterFileEdit → related-tests.sh
- `.cursor/hooks/related-tests.sh:32-41` — scope services/API; vitest related
- `src/components/plan/PlanChat.tsx:31-34,99-106` — Accept `disabled` from stored `hard.length`
- `src/components/plan/PlanWorkspace.tsx:296-331` — Accept `fetch` with no client gate
- `src/pages/api/chat/accept.ts:10-33,49-53` — session check; `acceptProposition`; 409 HARD_BOUNDS
- `src/lib/services/chat.ts:177-218` — live re-check; no `replaceWeek` on hard fail
- `src/lib/services/accept-proposition.test.ts:65-120` — persist-skip + soft control + live weeklyKm
- `src/pages/api/product-gates.test.ts:42,48-61` — logged-out Accept is 401 JSON
- `src/lib/test/migration-pg.test.ts:87` — skipUnless `HF_MIGRATION_PG=1`
- `playwright.config.ts:15` — unused `testDir: "./tests"` (directory absent)

## Architecture Insights

1. **One CI job is the floor.** Inventing `ci-tests.yml` or a Playwright job would split the signal and create the omission mode Phase 4 exists to prevent.
2. **Vitest include is the collection contract.** Phase 1–3 all colocated `src/**/*.test.ts` on purpose. Moving suites to `tests/` would silently drop them from `npm test` and land them in an empty Playwright dir.
3. **Accept is two layers on purpose.** Island disables the button from stored validation; server re-validates live weekly km and frozen flags. Tests that click the button cannot substitute for persist-skip.
4. **Skippable Postgres is not the CI floor.** Default `npm test` already runs the SQL harness. Flag-on-in-Actions without Docker would fail for the wrong reason or skip if someone “fixed” skipIf.

## Historical Context (from prior changes)

- `context/archive/2026-08-24-testing-critical-path-ownership-and-bounds/research.md` — Risk #2: UI disable is not the gate; browser e2e cannot close persist-skip. Phase 4 was explicitly deferred.
- `context/changes/testing-generation-oracle-and-api-contracts/` — §6.4: do not add Playwright for 401 or contracts.
- `context/changes/testing-migration-data-safety/research.md` — no Playwright, no Phase 4 CI job, no Docker in Actions. `HF_MIGRATION_PG` skippable.
- `context/changes/testing-migration-data-safety/plan.md` What We're NOT Doing — “Phase 4 CI job / Docker-in-Actions.”

## Related Research

- `context/archive/2026-08-24-testing-critical-path-ownership-and-bounds/research.md`
- `context/changes/testing-generation-oracle-and-api-contracts/research.md`
- `context/changes/testing-migration-data-safety/research.md`

## Open Questions

None that block planning. Playwright leftover (`@playwright/test` + `playwright.config.ts`) can be removed in an unrelated cleanup; this phase must not wire it.
