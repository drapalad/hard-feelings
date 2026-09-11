import { z } from "zod";

function score(rubric: string) {
  return z.number().int().min(1).max(10).describe(rubric);
}

const NA =
  " Score 6 when this concern is untouched — 6 means not applicable, not a compliment. Score 10 only with positive evidence of the 10-end in the diff. Score 1–3 only when the 1-end pattern is present.";

export const reviewOutputSchema = z.object({
  criteria: z.object({
    tenantIsolation: score(
      "Tenant isolation — does the change keep Member B off Member A’s plans and logs, and keep guests off gated JSON? 1: userId (or owner) comes from the request body; a logged-in caller can read or mutate another member’s rows; an unauthenticated call to a gated plan/chat/log API returns 200 with product data. 10: identity is locals.user from the session cookie; queries and writes are scoped to that owner; logged-out gated JSON is 401 with no member payload (/dashboard may 302 — that is not the API gate)." +
        NA,
    ),
    hardBoundsOnAccept: score(
      "Hard bounds on Accept — can a chat/LLM proposition land on the calendar when it violates algorithmic bounds? 1: Accept persists an out-of-bounds week (volume, frozen flags, or other hard gate) or treats “LLM said yes” / a hidden UI button as the gate. 10: Accept re-checks live bounds; an illegal proposition stays pending or is rejected; calendar rows are unchanged. Soft warnings may exist; hard bounds never become 200-writes." +
        NA,
    ),
    astroIslandConventions: score(
      'Astro / island conventions — does the diff read like this repo rather than Next.js or a CSS-string app? 1: "use client"; Tailwind classes concatenated instead of cn(); a new interactive island where a GET/full reload would do; server secrets (SUPABASE_*, OPENROUTER_API_KEY, SENTRY_DSN) exposed to the client or added to astro:env for the Worker when they belong in .dev.vars only. 10: SSR by default; React islands only where there is real interactivity; cn() for class lists; API routes keep prerender = false; secrets stay server-side as in AGENTS.md. Score 1–3 if the diff introduces a 1-end pattern even in a small hunk.' +
        NA,
    ),
    trustedApiSurface: score(
      "Trusted API surface — is mutation input validated, and do failures become real HTTP errors? 1: untrusted body fields persist (forged owner, extra keys, invalid types); a catch logs and still returns { ok: true } / 200; Zod is skipped on a new write path. 10: handlers validate with Zod; unknown keys including userId are stripped; log type comes from the planned unit, not the client; exceptions map to jsonError / { ok: false } with an honest status." +
        NA,
    ),
    namedRiskTests: score(
      "Named-risk tests — if the diff touches a named failure from context/foundation/test-plan.md, is that risk actually exercised? 1: ownership, Accept bounds, volume oracle, migration safety, API contracts (including races/plan/chat/log writes), or 401 gates change with no test (or a test that only asserts 200 / snapshots generator output). Changing src/pages/api/races.ts or forging userId without a two-user / forged-body test is a 1, not a 10. 10: the cheapest layer that would catch the failure is updated — two-user ownership, Accept persist-skip, weekly-km oracle, migrate-over-fixture, forged-body reject, or logged-out 401 — and src/lib/test/quality-gates.test.ts is not weakened to hide a deleted suite. Score 6 only for diffs that truly do not touch those risks (docs-only, CSS-only, unrelated markdown). Do not score 10 merely because tests were not deleted.",
    ),
  }),
  verdict: z
    .enum(["pass", "fail"])
    .describe(
      "Binding pass/fail for the whole diff. fail if any criterion the diff actually touches lands at the 1-end of its rubric (typically ≤3). pass when there is no 1-end failure. Scores of 6 on untouched criteria are not a reason to pass a broken API, and they are not a reason to fail a docs-only change. Do not fail solely on parked concerns (business alignment, architectural fit).",
    ),
  summary: z
    .string()
    .describe(
      "Markdown suitable as a pull-request comment. Name each of the five criteria with its score and one sentence of evidence from the diff. If a score is 6, say that the concern was not in the diff — do not praise the change for work it did not do. Do not add a sixth criterion.",
    ),
});

export type ReviewOutput = z.infer<typeof reviewOutputSchema>;
