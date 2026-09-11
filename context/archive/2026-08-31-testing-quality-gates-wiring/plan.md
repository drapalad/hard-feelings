# Quality-gates wiring Implementation Plan

## Overview

Close test-plan rollout Phase 4 (`context/foundation/test-plan.md` §3): keep the existing single CI job failing when Phase 1–3 Vitest suites fail, and lock that floor against silent omission (include drift, deleted suites, YAML that drops `npm test` or enables Docker-Postgres). Do **not** add Playwright: HTTP already sees the Accept persist failure.

## Current State Analysis

`.github/workflows/ci.yml` is one job (`ci`): `npm ci`, `npx astro sync`, `npm run lint`, `npm test`, `npm run build`. `npm test` is `vitest run`. Include is `src/**/*.test.ts` (`vitest.config.ts`). Every Phase 1–3 file already matches that glob. Vitest non-zero on failure already fails the job.

`HF_MIGRATION_PG` is unset in CI. `migration-pg.test.ts` uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`. Default `npm test` skips those two tests. CI has no Docker Postgres.

Accept persist: `PlanWorkspace.accept()` POSTs `/api/chat/accept` with no client-side hard-bounds check. `PlanChat` disables the Accept button when stored `hard.length > 0`. `acceptProposition` re-checks live weekly km and skips `replaceWeek` on hard fail. `accept-proposition.test.ts` is the listed-risk oracle. Playwright would click a disabled control and miss a skipped server re-check.

§5 local gates already match disk: husky → lint-staged related tests; Cursor `afterFileEdit` → `.cursor/hooks/related-tests.sh` on `src/lib/services` and `src/pages/api`.

Unused leftover: `@playwright/test` + `playwright.config.ts` (`testDir: "./tests"`) with no `tests/` directory. Not in CI.

## Desired End State

Default `npm test` (hence CI) fails if a named Phase 1–3 file is missing, if Vitest include is no longer `src/**/*.test.ts`, if the existing `ci` job no longer runs `npm test`, if CI mentions `HF_MIGRATION_PG` or Playwright, or if husky / lint-staged / afterFileEdit drift from §5.

Cookbook §6.3 states e2e was not added because HTTP sees the accept failure. §5 marks “CI includes Phase 1–3 tests” required and Playwright not required. §3 Phase 4 is `complete`.

### Key Discoveries:

- Single job already runs `npm test` (`.github/workflows/ci.yml:21`); a second workflow would create the omission mode this phase exists to prevent.
- Include glob is the collection contract (`vitest.config.ts:4`).
- Accept island disable is UX; persist gate is `acceptProposition` (`src/lib/services/chat.ts:200-214`) plus `POST /api/chat/accept` (`src/pages/api/chat/accept.ts:27-31`).
- `HF_MIGRATION_PG` skippable path is not load-bearing for default CI (`src/lib/test/migration-pg.test.ts:87`).
- Playwright config exists but `tests/` does not (`playwright.config.ts:15`).

## What We're NOT Doing

- Playwright, jsdom, browser e2e, `webServer` + `preview`, or wiring `@playwright/test` into CI.
- Removing unused `playwright.config.ts` / `@playwright/test` (unrelated cleanup).
- A second GitHub Actions workflow or a second job.
- Setting `HF_MIGRATION_PG` in CI or adding Docker / `supabase start` to Actions.
- Hosted `db push`, product SQL, or service/handler behavior changes.
- Reopening closed FU/DEP items. No new DEP unless infra actually appears (it must not).
- File:line in test-plan §1/§2. No §2 backport.

## Implementation Approach

Cost × signal: the floor is already `npm test` in the existing job. Add one colocated meta-test that treats named Phase 1–3 paths and config literals as the oracle. Then fill the cookbook with why e2e stays unused.

Complexity: **LOW**. Config-assertion test + docs. No product code.

## Critical Implementation Details

**Oracle is named paths and config literals**, not “whatever `*.test.ts` files exist.” Required files: `src/lib/services/ownership.test.ts`, `src/lib/services/accept-proposition.test.ts`, `src/lib/services/generate-plan.test.ts`, `src/pages/api/plan-contracts.test.ts`, `src/pages/api/product-gates.test.ts`, `src/lib/test/migration-safety.test.ts`, `src/lib/test/migration-pg.test.ts`.

**Do not execute Playwright or Postgres** inside the meta-test. Read files with `fs`. Repo root is three levels above `src/lib/test/` (`path.resolve(import.meta.dirname, "../../..")`), same `import.meta.dirname` style as `vitest.config.ts`.

**Do not modify `.github/workflows/ci.yml`** unless the meta-test proves it already drifted (it has not). The test locks the current shape.

**Playwright string lives in `package.json`** (`@playwright/test` leftover). Assert `/playwright/i` only against `.github/workflows/ci.yml`, never against `package.json` or `playwright.config.ts`.

**Single job parse:** `on.push` / `on.pull_request` also use two-space keys. Assert the `jobs:` block’s only job id is `ci` (match keys at indent 2 after `jobs:`), not merely that the file contains the substring `ci:`.

---

## Phase 1: Phase 1–3 floor lock (CI wiring)

### Overview

Add a Vitest file collected by the existing include glob that fails when the Phase 1–3 floor is omitted or when CI/local gates drift.

**Behavior asserted:** Named Phase 1–3 suites exist under `src/**/*.test.ts`; the existing `ci` job still runs `npm test` without Docker-Postgres or Playwright; husky / lint-staged / afterFileEdit still match §5; Postgres owner-read stays skippable.

**Regression caught:** Include narrowed; a required file deleted or moved to `tests/`; `npm test` dropped from YAML; `HF_MIGRATION_PG` or Playwright added to CI; pre-commit / afterFileEdit related-tests removed.

**Research source:** research.md Summary + §1–§2, §5.

**Edge/error/boundary:** `migration-pg.test.ts` must remain present (skipped in default `npm test`) so the skippable path cannot vanish unnoticed. Meta-test itself must live under `src/**/*.test.ts`.

**Anti-pattern avoided:** Second workflow; Playwright “because it feels safer”; enabling `HF_MIGRATION_PG` in CI; asserting “some tests ran” instead of named files.

### Changes Required:

#### 1. Quality-gates meta-test

**File**: `src/lib/test/quality-gates.test.ts` (new)

**Intent**: Read repo configs and the named Phase 1–3 files; fail default `npm test` (hence CI) on omission or gate drift.

**Contract**:
- Assert `vitest.config.ts` contains `include: ["src/**/*.test.ts"]`.
- For each required path above: `existsSync` and file text includes `describe(`.
- Assert `.github/workflows/ci.yml` matches `/run:\s*npm test/`, does not match `/HF_MIGRATION_PG/` or `/playwright/i`, and the `jobs:` block has exactly one job id `ci` (indent-2 keys after `jobs:` only — `on.push` is not a job). Do not grep `package.json` for Playwright.
- Assert `package.json` lint-staged `src/**/*.{ts,tsx}` is `["vitest related --run --passWithNoTests"]`.
- Assert `.husky/pre-commit` contains `npx lint-staged`.
- Assert `.cursor/hooks.json` `afterFileEdit[0].command` is `.cursor/hooks/related-tests.sh`.
- Assert `src/lib/test/migration-pg.test.ts` contains `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`.
- Do not import Playwright, `pg`, or product services. Do not spawn subprocesses.

### Success Criteria:

#### Automated Verification:

- `src/lib/test/quality-gates.test.ts` asserts the seven named Phase 1–3 files exist and contain `describe(`
- The file asserts Vitest include is `src/**/*.test.ts`
- The file asserts `.github/workflows/ci.yml` contains `npm test`, a single `ci` job, and does not mention `HF_MIGRATION_PG` or Playwright
- The file asserts lint-staged related tests, husky `lint-staged`, and afterFileEdit `related-tests.sh` still match §5
- The file asserts `migration-pg.test.ts` uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")`
- `npm test` passes
- `npm run lint` passes

---

## Phase 2: Cookbook §6.3 and Phase 4 complete

### Overview

Document that e2e was not added because HTTP sees the Accept failure. Stamp §5 gates this phase actually wired. Mark rollout Phase 4 complete.

**Behavior asserted:** A later agent adding Accept coverage follows persist-skip, not Playwright click-on-disabled.

**Regression caught:** Next contributor fills §6.3 with a Playwright recipe “na wszelki wypadek.”

**Research source:** research.md §3 Playwright verdict; test-plan §6.3 TBD.

**Anti-pattern avoided:** Playwright cookbook; file:line in §1/§2; enabling `HF_MIGRATION_PG` in the cookbook’s CI story.

### Changes Required:

#### 1. Cookbook and gates

**File**: `context/foundation/test-plan.md`

**Intent**: Replace §6.3 TBD with an explicit unused note; update §4 e2e row; flip §5 “CI includes Phase 1–3 tests” to required and Playwright to not required; add §6.6 Phase 4 line; set §3 Phase 4 Status to `complete`; refresh Last-updated.

**Contract**: §6.3 must say e2e was **not** added because HTTP/handler/`acceptProposition` sees the accept failure (calendar rows landing is the listed risk; UI `disabled` is not the gate). Name reference `src/lib/services/accept-proposition.test.ts`. Mention unused `playwright.config.ts` is not a suite and must not be wired. No Playwright how-to. No file:line in §1/§2. §5 e2e row: not required. Do not invent a second CI workflow in the cookbook.

### Success Criteria:

#### Automated Verification:

- `context/foundation/test-plan.md` §6.3 states e2e was not added because HTTP sees the accept failure
- §5 marks “CI includes Phase 1–3 tests” as required and Playwright accept-in-UI as not required
- §3 Phase 4 Status is `complete`
- §6.6 notes Phase 4 (existing job + meta-test; no Playwright)
- `npm test` passes
- `npm run lint` passes

---

## Testing Strategy

This change **is** the quality-gates meta-test plus cookbook.

### Unit Tests:

- Config and named-file assertions in `src/lib/test/quality-gates.test.ts` (Phase 1).

### Integration Tests:

- None new. Phase 1–3 integration suites keep running via existing `npm test`.

## Performance Considerations

The meta-test reads a handful of small text files. Negligible.

## Migration Notes

Not applicable. Do not change CI secrets, hosted DB, or product schema.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Test plan: `context/foundation/test-plan.md` (§3 Phase 4, §5, §6.3 TBD)
- Progress format: `.cursor/skills/10x-plan/references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Phase 1–3 floor lock (CI wiring)

#### Automated

- [x] 1.1 `src/lib/test/quality-gates.test.ts` asserts the seven named Phase 1–3 files exist and contain `describe(` — 3634110
- [x] 1.2 The file asserts Vitest include is `src/**/*.test.ts` — 3634110
- [x] 1.3 The file asserts `.github/workflows/ci.yml` contains `npm test`, a single `ci` job, and does not mention `HF_MIGRATION_PG` or Playwright — 3634110
- [x] 1.4 The file asserts lint-staged related tests, husky `lint-staged`, and afterFileEdit `related-tests.sh` still match §5 — 3634110
- [x] 1.5 The file asserts `migration-pg.test.ts` uses `describe.skipIf(process.env.HF_MIGRATION_PG !== "1")` — 3634110
- [x] 1.6 `npm test` passes — 3634110
- [x] 1.7 `npm run lint` passes — 3634110

### Phase 2: Cookbook §6.3 and Phase 4 complete

#### Automated

- [x] 2.1 `context/foundation/test-plan.md` §6.3 states e2e was not added because HTTP sees the accept failure — 4660829
- [x] 2.2 §5 marks “CI includes Phase 1–3 tests” as required and Playwright accept-in-UI as not required — 4660829
- [x] 2.3 §3 Phase 4 Status is `complete` — 4660829
- [x] 2.4 §6.6 notes Phase 4 (existing job + meta-test; no Playwright) — 4660829
- [x] 2.5 `npm test` passes — 4660829
- [x] 2.6 `npm run lint` passes — 4660829
