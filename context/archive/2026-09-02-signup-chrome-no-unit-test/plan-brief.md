# Drop the signup chrome source-read unit test — Plan Brief

> Full plan: `context/changes/signup-chrome-no-unit-test/plan.md`

## What & Why

The colocated `signup.test.ts` source-read test from `signup-with-nav` is not wanted (FU-058, human 2026-09-02). Delete that file. Do not add a replacement unit test. Sign-up Topbar chrome stays as shipped.

## Starting Point

`/auth/signup` already imports Topbar with sign-in’s cosmic padding and solid card. `signup.test.ts` is the only `src/pages/auth/*.test.ts` and is not in the quality-gates Phase 1–3 floor.

## Desired End State

No signup chrome unit test. Shipped markup (Topbar, card, fields, Create account) is untouched. Chrome checks are grep/review in this change, not CI.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| File to delete | `src/pages/auth/signup.test.ts` only | LOCKED: drop the colocated source-read test | Plan |
| Replacement tests | None — no new unit/integration/Playwright file | LOCKED: do not add a replacement unit test | Plan |
| Sign-up chrome | Leave `signup.astro` as shipped; do not restyle card, fields, or Create account | LOCKED: chrome stays; this change is the test file only | Plan |
| Chrome verification | Implementer/review greps of shipped tokens; do not add a CI/quality-gates lock | LOCKED: chrome checks stay grep/review, not CI | Plan |
| Phase shape | One phase: delete the test and verify chrome + suite | Single-file deletion; no markup or config work | Unattended |
| Manual visual | Omit — no UI delta to observe | Chrome files are not edited; invariance is grep-able | Unattended |
| Quality-gates floor | Leave `PHASE_1_3_TESTS` unchanged | `signup.test.ts` was never in the floor; adding a chrome path would put chrome in CI | Plan |
| Build secrets | Copy `.env.example` → `.env` with dummy placeholders if build needs them; never commit `.env` | Isolation worktree has no real env; CI already injects secrets | Plan |

## Scope

**In scope:** Delete `src/pages/auth/signup.test.ts`; grep shipped signup chrome; leave `signup.astro` unedited; existing `npm test` / lint / build.

**Out of scope:** Restyle; replacement tests; CI chrome assertions; `signup.astro` edits; FU-058 re-open; Welcome test; deploy/infra.

## Architecture / Approach

Delete the Vitest file. Vitest `include: ["src/**/*.test.ts"]` drops it automatically. Chrome stays a source-grep concern for this change and future reviews.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Delete signup chrome unit test | Test file gone; chrome and CI floor unchanged | Accidentally editing `signup.astro` or adding a replacement test |

**Prerequisites:** `signup-with-nav` shipped (file exists to delete).
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- Dropping the source-read lock means a later markup edit can remove Topbar without a failing unit test; that is the accepted FU-058 outcome.
- `npm run build` in this worktree may need dummy `SUPABASE_URL` / `SUPABASE_KEY` from `.env.example`.

## Success Criteria (Summary)

- `signup.test.ts` is gone and no replacement chrome unit test exists.
- Sign-up Topbar chrome (card, fields, Create account) is still the shipped markup.
- `npm test`, lint, and build pass; quality-gates floor has no signup chrome path.
