# Drop the signup chrome source-read unit test Implementation Plan

## Overview

Remove the colocated `signup.test.ts` source-read lock that `signup-with-nav` added. Do not replace it with another unit test. Leave sign-up Topbar chrome, card, fields, and Create account as shipped. Chrome invariance is checked by grep/review during this change, not by CI.

## Current State Analysis

`src/pages/auth/signup.astro` already has the shipped chrome from `signup-with-nav`: cosmic root `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, `<Topbar />` as the first child, centering wrapper `flex flex-1 items-center justify-center` (no inner `p-4`), card class `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`, gradient H1 `Sign up`, `SignUpForm` with `client:load`, in-card Sign in link, and `SiteFooter`.

`src/pages/auth/signup.test.ts` is a Node Vitest file that `readFileSync`s the sibling `signup.astro` and asserts those chrome tokens. It is the only file under `src/pages/auth/` matching `*.test.ts`. It is not named in `src/lib/test/quality-gates.test.ts` `PHASE_1_3_TESTS`. Vitest include is `src/**/*.test.ts` (`vitest.config.ts`), so deleting the file drops it from `npm test` with no config edit.

`signin.astro` uses the same chrome pattern and has no colocated unit test. FU-058 is already done and promoted to this change — do not re-open it. Test-plan §6.3 forbids Playwright; §1 cost×signal does not require a chrome source-read for risk-map #1–#6.

## Desired End State

`src/pages/auth/signup.test.ts` is gone. No new unit test covers signup chrome. `/auth/signup` markup is bitwise the shipped Topbar chrome (same card, fields, Create account). Reviewers (and this plan’s Automated greps) confirm chrome; CI does not gain a chrome assertion.

### Key Discoveries:

- The test file is the entire product delta; `signup.astro` must not be edited (`src/pages/auth/signup.test.ts`, `src/pages/auth/signup.astro` lines 1–28).
- `quality-gates.test.ts` does not list `signup.test.ts`; leaving that floor unchanged keeps chrome out of CI (`src/lib/test/quality-gates.test.ts` lines 7–15).
- Sibling `signin.astro` already ships Topbar chrome without a colocated source-read test — that is the pattern this change matches.
- AGENTS.md `cn()` does not apply: no class-string edits.

## What We're NOT Doing

- Adding a replacement unit, integration, Playwright, or quality-gates chrome lock.
- Restyling the sign-up card, fields, or Create account button.
- Editing `signup.astro`, `signin.astro`, `Topbar.astro`, or `SignUpForm.tsx`.
- Re-opening FU-058.
- Touching `Welcome.test.ts` / `landing-welcome-no-unit-test`.
- Auth API, middleware, cookies, deploy/infra.

## Implementation Approach

Delete `src/pages/auth/signup.test.ts`. Verify chrome with source greps against the shipped `signup.astro` tokens (implementer/review, not a new CI test). Run `npm test`, `npm run lint`, and `npm run build`.

## Phase 1: Delete signup chrome unit test

### Overview

Remove the source-read Vitest file and prove signup chrome and the quality-gates floor are unchanged.

### Changes Required:

#### 1. Colocated chrome test

**File**: `src/pages/auth/signup.test.ts`

**Intent**: Drop the source-read unit test the human rejected in FU-058.

**Contract**: Delete the file. Do not add `src/pages/auth/signup.test.ts` or any other new `src/**/*.test.ts` whose purpose is signup chrome. Do not edit `vitest.config.ts` or `src/lib/test/quality-gates.test.ts`.

### Success Criteria:

#### Automated Verification:

- `src/pages/auth/signup.test.ts` does not exist
- The only `src/**/*.test.ts` delta is deleting `src/pages/auth/signup.test.ts` (no replacement chrome test under `src/`)
- `src/pages/auth/signup.astro` still contains `import Topbar from "@/components/Topbar.astro"`, `<Topbar />` before the card class string, cosmic root `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, centering wrapper `flex flex-1 items-center justify-center` without `flex flex-1 items-center justify-center p-4`, card class `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`, and `SignUpForm serverError={error} client:load`
- `src/pages/auth/signup.astro`, `src/pages/auth/signin.astro`, `src/components/Topbar.astro`, and `src/components/auth/SignUpForm.tsx` are unchanged
- `src/lib/test/quality-gates.test.ts` `PHASE_1_3_TESTS` is unchanged (no signup chrome path added)
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

---

## Testing Strategy

### Unit Tests:

- None added. Deleting `signup.test.ts` is the change. Remaining `src/**/*.test.ts` suites must still pass (`npm test`).

### Integration Tests:

- None.

## Performance Considerations

None. Test-file deletion only.

## Migration Notes

None. If `npm run build` needs `SUPABASE_URL` / `SUPABASE_KEY` in this worktree, copy `.env.example` to `.env` with dummy placeholders; never commit `.env`.

## References

- `context/changes/signup-chrome-no-unit-test/change.md` — LOCKED Notes
- `context/changes/signup-with-nav/plan.md` — origin of `signup.test.ts`
- `src/pages/auth/signup.astro` — shipped chrome
- `src/pages/auth/signin.astro` — sibling chrome without a colocated test
- `src/lib/test/quality-gates.test.ts` — CI floor (must stay chrome-free)
- `context/foundation/test-plan.md` §1, §6.1, §6.3
- `context/backlog.md` FU-058 (done; promoted here)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Delete signup chrome unit test

#### Automated

- [x] 1.1 `src/pages/auth/signup.test.ts` does not exist — 970d92e
- [x] 1.2 The only `src/**/*.test.ts` delta is deleting `src/pages/auth/signup.test.ts` (no replacement chrome test under `src/`) — 970d92e
- [x] 1.3 `src/pages/auth/signup.astro` still contains `import Topbar from "@/components/Topbar.astro"`, `<Topbar />` before the card class string, cosmic root `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, centering wrapper `flex flex-1 items-center justify-center` without `flex flex-1 items-center justify-center p-4`, card class `w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 p-8 text-white`, and `SignUpForm serverError={error} client:load` — 970d92e
- [x] 1.4 `src/pages/auth/signup.astro`, `src/pages/auth/signin.astro`, `src/components/Topbar.astro`, and `src/components/auth/SignUpForm.tsx` are unchanged — 970d92e
- [x] 1.5 `src/lib/test/quality-gates.test.ts` `PHASE_1_3_TESTS` is unchanged (no signup chrome path added) — 970d92e
- [x] 1.6 `npm test` exits 0 — 970d92e
- [x] 1.7 `npm run lint` exits 0 — 970d92e
- [x] 1.8 `npm run build` exits 0 — 970d92e
