# Drop the Welcome source-read unit test — Plan Brief

> Full plan: `context/changes/landing-welcome-no-unit-test/plan.md`

## What & Why

The colocated `Welcome.test.ts` source-read lock on landing feature-card chrome is not wanted (FU-048, human 2026-09-02). Delete that test. Leave the shipped Welcome markup alone. Do not replace the test. Chrome stays grep/review, not CI.

## Starting Point

`Welcome.astro` already has three solid `bg-slate-950` cards, quiet H1, CTAs, Topbar, and SiteFooter. `Welcome.test.ts` is the only file that CI-asserts those tokens. `quality-gates.test.ts` does not name it. Sibling chrome changes used implementer greps only.

## Desired End State

`Welcome.test.ts` is gone. Welcome looks as it does today. `npm test` / `lint` / `build` pass. No new test file reads `Welcome.astro`. A human still glances at `/`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| File scope | Delete `src/components/Welcome.test.ts` only; do not edit `Welcome.astro` or other pages | Locked Notes: delete that file; do not restyle cards, H1, CTAs, Topbar, or footer | Plan |
| Replacement tests | None — no new Vitest, Playwright, or visual snapshot | Locked Notes: do not add a replacement unit test; test-plan §6.3 / §7 | Plan |
| Chrome verification | Implementer greps of the shipped keep-list (parent plan 1.1–1.3), not a committed test | Locked Notes: chrome checks stay grep/review, not CI | Plan |
| CI absence lock | Do not add a `quality-gates.test.ts` assertion that `Welcome.test.ts` stays gone | Absence is an implementer gate (`test ! -e`); a CI lock would be a new unit test against “not CI” / “no replacement” | Unattended |
| Success bar | File gone, no `Welcome.astro` in remaining tests, keep-list greps, suite/lint/build green | Matches locked end state without widening into restyle or new harness | Plan |
| Visual check | Keep Manual `/` signed-out glance (cards solid; hero/CTAs/Topbar/footer unchanged) | “Review” in locked Notes is human-only; greps cannot judge frost vs solid on screen | Plan |

## Scope

**In scope:** Delete `src/components/Welcome.test.ts`; grep/review that Welcome chrome is still the shipped keep-list; repo suite/lint/build.

**Out of scope:** Restyle; replacement tests; quality-gates edit; sibling pages; rewriting `landing-feature-solid`; FU-048; schema/API.

## Architecture / Approach

Delete the test file. Reuse `landing-feature-solid` keep-list greps as Automated rows. Skip break-check (no tests added). Dummy `.env` from `.env.example` for build only.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Delete Welcome.test.ts | Test gone; chrome unchanged; suite green | Accidentally restyling Welcome or adding a replacement test |

**Prerequisites:** `landing-feature-solid` chrome already on disk (it is).
**Estimated effort:** one phase, one session.

## Open Risks & Assumptions

- Skipping a CI “file must stay gone” lock is recorded as FU-090; a human may still want that floor.
- Visual solidity remains human-judged (Progress 1.10).

## Success Criteria (Summary)

- `Welcome.test.ts` does not exist; no remaining test reads `Welcome.astro`.
- Welcome chrome keep-list is still in source.
- `npm test` / `lint` / `build` pass.
