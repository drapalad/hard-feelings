# Quality-gates wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Rollout Phase 4 of `context/foundation/test-plan.md`: fail CI if Phase 1–3 suites fail or are silently omitted. Do not add Playwright — HTTP already sees the Accept persist failure. Challenge: “add e2e because it feels safer.”

## Starting Point

One GitHub Actions job already runs `npm test` (`vitest run`, include `src/**/*.test.ts`). Phase 1–3 files are already collected. `HF_MIGRATION_PG` is unset in CI (2 skipped tests). Husky / lint-staged / afterFileEdit match §5. Playwright config exists with no `tests/` dir and is not in CI. Accept UI disables the button; `acceptProposition` is the persist gate.

## Desired End State

A meta-test in default `npm test` locks named Phase 1–3 files, Vitest include, the existing `ci` job’s `npm test` line (no Docker-Postgres, no Playwright), and the §5 local hooks. Cookbook §6.3 says e2e was not added. §3 Phase 4 is `complete`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Complexity | LOW | One meta-test plus cookbook; CI YAML already correct | Unattended |
| Playwright | Do not add | HTTP/`acceptProposition` sees calendar-land failure; UI disable would mask a skipped re-check | Research / test-plan §2 |
| CI shape | Keep the single `ci` job; do not edit `ci.yml` | A second workflow is the omission mode this phase prevents | Research |
| Postgres in CI | Leave `HF_MIGRATION_PG` unset | CI has no Docker Postgres; skippable path is not the default floor | Research + constraints |
| Extra signal | Colocated `quality-gates.test.ts` reading configs + named files | Cheapest lock against include/file/YAML drift inside existing `npm test` | Research |
| Playwright leftover | Leave unused config/dep | Cleanup is out of scope; must not wire it | Unattended |
| Cookbook §6.3 | Unused note, not a Playwright how-to | Phase 4 fills §6.3 only if e2e is added — it is not | Test-plan + research |

## Scope

**In scope:** `src/lib/test/quality-gates.test.ts`; test-plan §6.3 / §5 / §3 / §6.6 / §4 e2e row.

**Out of scope:** Playwright; second workflow; `HF_MIGRATION_PG` in CI; deleting unused Playwright files; product code; hosted DB.

## Architecture / Approach

Treat named Phase 1–3 paths and config literals as the oracle. Ride the existing `npm test` job. Document why Accept e2e stays unused.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Floor lock | Meta-test in `npm test` | Green because include quietly dropped suites |
| 2. Cookbook | §6.3 unused + Phase 4 complete | Next agent adds Playwright “to be safe” |

**Prerequisites:** Phases 1–3 complete; Vitest include already `src/**/*.test.ts`.
**Estimated effort:** one session, two phases.

## Open Risks & Assumptions

- Deleting both `npm test` from YAML and the meta-test in the same change would still go unnoticed without GitHub required-checks; that is accepted, not a second job.
- Current YAML already matches the assertions; Phase 1 should be green on first run.

## Success Criteria (Summary)

- Named Phase 1–3 files + include + CI `npm test` locked in default `npm test`.
- No Playwright added; §6.3 says HTTP sees the accept failure.
- §3 Phase 4 `complete`; Playwright gate not required.
