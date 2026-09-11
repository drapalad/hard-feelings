# Code review requirements (HardFeelings)

M5L3 #1. Binding criteria for `packages/code-reviewer`. Rubrics are ours; the model does not invent them.

## Overall concept

- Local agent today; later a GHA workflow on every pull request to `master`.
- Composite action for the review itself so the main workflow stays thin.

## Input parameters

- pull request title
- pull request description (optional — cost tradeoff; skip in MVP if tokens hurt)
- git diff

## Code Review Criteria

Each criterion is scored 1–10. **1** is the worst outcome, **10** is the best. Exactly five. Do not add a sixth.

1) **Tenant isolation** — does the change keep Member B off Member A’s plans and logs, and keep guests off gated JSON?
   - _1_: `userId` (or owner) comes from the request body; a logged-in caller can read or mutate another member’s rows; an unauthenticated call to a gated plan/chat/log API returns 200 with product data.
   - _10_: identity is `locals.user` from the session cookie; queries and writes are scoped to that owner; logged-out gated JSON is 401 with no member payload (`/dashboard` may 302 — that is not the API gate).

2) **Hard bounds on Accept** — can a chat/LLM proposition land on the calendar when it violates algorithmic bounds?
   - _1_: Accept persists an out-of-bounds week (volume, frozen flags, or other hard gate) or treats “LLM said yes” / a hidden UI button as the gate.
   - _10_: Accept re-checks live bounds; an illegal proposition stays pending or is rejected; calendar rows are unchanged. Soft warnings may exist; hard bounds never become 200-writes.

3) **Astro / island conventions** — does the diff read like this repo rather than Next.js or a CSS-string app?
   - _1_: `"use client"`; Tailwind classes concatenated instead of `cn()`; a new interactive island where a GET/full reload would do; server secrets (`SUPABASE_*`, `OPENROUTER_API_KEY`, `SENTRY_DSN`) exposed to the client or added to `astro:env` for the Worker when they belong in `.dev.vars` only.
   - _10_: SSR by default; React islands only where there is real interactivity; `cn()` for class lists; API routes keep `prerender = false`; secrets stay server-side as in AGENTS.md.

4) **Trusted API surface** — is mutation input validated, and do failures become real HTTP errors?
   - _1_: untrusted body fields persist (forged owner, extra keys, invalid types); a `catch` logs and still returns `{ ok: true }` / 200; Zod is skipped on a new write path.
   - _10_: handlers validate with Zod; unknown keys including `userId` are stripped; log type comes from the planned unit, not the client; exceptions map to `jsonError` / `{ ok: false }` with an honest status.

5) **Named-risk tests** — if the diff touches a named failure from `context/foundation/test-plan.md`, is that risk actually exercised?
   - _1_: ownership, Accept bounds, volume oracle, migration safety, API contracts, or 401 gates change with no test (or a test that only asserts 200 / snapshots generator output).
   - _10_: the cheapest layer that would catch the failure is updated — two-user ownership, Accept persist-skip, weekly-km oracle, migrate-over-fixture, forged-body reject, or logged-out 401 — and `src/lib/test/quality-gates.test.ts` is not weakened to hide a deleted suite.

## Parked for later

- business alignment (needs product/roadmap context the diff does not carry)
- architectural fit (needs the repo map / change plan, not just the hunk)

## Expected side-effects

- PR comment with `summary`
- labels: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- on-demand retry when label `ai-cr:review` is added (later; not M5L3 #1)

## Out of this file

Do not implement CI or promptfoo here. M5L3 #2 wired these five into `packages/code-reviewer/src/schema.ts` and `src/prompt.ts`.
