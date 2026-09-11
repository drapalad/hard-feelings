---
date: 2026-08-31T14:34:09+00:00
researcher: Cursor Grok 4.6
git_commit: 283aea8276de0e041f35c9091e6151946027dbe9
branch: admin-report-capture-research
repository: hard-feelings
topic: "When does a row in agent_reports get created today? What do we not capture? Should that change?"
tags: [research, codebase, agent-reports, admin, chat, validatePlan, FR-011, FU-014, FU-012]
status: complete
last_updated: 2026-08-31
last_updated_by: Cursor Grok 4.6
---

# Research: When does a row in agent_reports get created today? What do we not capture? Should that change?

**Date**: 2026-08-31T14:34:09+00:00
**Researcher**: Cursor Grok 4.6
**Git Commit**: 283aea8276de0e041f35c9091e6151946027dbe9
**Branch**: admin-report-capture-research
**Repository**: hard-feelings

Local `path:line` references (this worktree is not on `master` and must not be pushed). `context/foundation/lessons.md` is not present in this tree.

## Research Question

When does a row in `agent_reports` get created today? What do we *not* capture? Should that change?

Must cover with file:line evidence: `shouldCaptureHardBoundReport`; the insert path in `sendMessage` after `insertPending`; capture iff mutations are present **and** `validatePlan.hard.length > 0`; explicit out-of-capture paths (soft warnings, explain/log, unmapped help, LLM-unavailable, generate failures, Reject); FU-012 (unmapped as `kind=gap`) as related but narrower — document it, do not close it, do not recommend implementing it in this change; historical S-06 decisions (unmapped intents, PII/transcript / FU-013); PRD FR-011.

This change is research-only. Do not implement capture-behavior changes. Do not close FU-014, FU-012, or FU-013.

## Summary

A row in `agent_reports` is created in **one place only**: `sendMessage` in `src/lib/services/chat.ts`, immediately after `insertPending`, and only when `shouldCaptureHardBoundReport` is true — that is, the proposer returned at least one mutation **and** `gateAccept` / `validatePlan` produced a non-empty `hard` array. The inserted kind is always `algorithm_proposal`. Insert is fail-open (try/catch); a missing table must not break chat. There is no other writer in `src/`.

We do **not** capture: soft-only warnings; explain; log; unmapped/help fallback; LLM-unavailable (`COACH_UNAVAILABLE_REPLY`); generate failures (`generatePlan` / `generateAndPersist`); Reject; Accept `HARD_BOUNDS` 409 (already captured at send, if it was); manual calendar edits that persist through hard bounds (FU-002). Schema CHECK allows `kind=gap`, but nothing inserts it.

**Recommendation: keep hard-bound-only.** Do not widen or tighten in this change. FR-011's "algorithm-improvement proposals" is what S-06 shipped; the "gap reports" reading is FU-012 (`admin-unmapped-intent-gaps`) and must stay a separate, later change. Transcript storage is FU-013 (`admin-report-chat-excerpt`). Tightening would empty the only Admin signal that exists.

## Detailed Findings

### Capture predicate

`shouldCaptureHardBoundReport` is a two-clause AND. Tests pin the three cases (empty mutations, empty hard, both present).

```12:14:src/lib/services/agent-report.ts
export function shouldCaptureHardBoundReport(mutationsLength: number, validation: ValidateResult): boolean {
  return mutationsLength > 0 && validation.hard.length > 0;
}
```

```16:37:src/lib/services/agent-report.test.ts
describe("shouldCaptureHardBoundReport", () => {
  it("is false for empty mutations", () => {
    expect(
      shouldCaptureHardBoundReport(
        0,
        validation([hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days.")]),
      ),
    ).toBe(false);
  });

  it("is false for hard-empty validation", () => {
    expect(shouldCaptureHardBoundReport(1, validation([]))).toBe(false);
  });

  it("is true only when both mutations and hard violations exist", () => {
    expect(
      shouldCaptureHardBoundReport(
        1,
        validation([hard("CONSECUTIVE_LONGS", "Long workouts fall on consecutive days.")]),
      ),
    ).toBe(true);
  });
});
```

The `hard` array is the same object `validatePlan` fills. `sendMessage` does not call `validatePlan` by name; it uses `gateAccept`, which always runs `validatePlan` and fails the gate iff `validation.hard.length > 0`:

```47:53:src/lib/services/plan-adaptation.ts
export function gateAccept(plan: Plan, weeklyKm: number, frozenUnits: TrainingUnit[]): AcceptGate {
  const validation = validatePlan(plan, { weeklyKm, frozenUnits });
  if (validation.hard.length === 0) {
    return { ok: true, validation };
  }
  return { ok: false, validation };
}
```

Hard codes today (`src/lib/services/validate-plan.ts`): `WEEKLY_VOLUME_EXCEEDED` above `weeklyKm * 1.2`, `CONSECUTIVE_LONGS`, `FROZEN_ANCHOR_DROPPED`. Soft `WEEKLY_VOLUME_EXCEEDED` (over target, under ceiling) does **not** satisfy the predicate.

### Insert path: `sendMessage` after `insertPending`

The only production call to `insertAgentReport` is here:

```141:161:src/lib/services/chat.ts
    const plan = applyMutations(units, proposed.mutations);
    const frozenUnits = units.filter((unit) => unit.frozen);
    const validation = gateAccept(plan, profile.weeklyKm, frozenUnits).validation;
    await insertMessage(client, userId, monday, "assistant", proposed.reply);
    if (proposed.mutations.length > 0) {
      await rejectPending(client, userId, monday);
      await insertPending(client, userId, monday, plan.units, validation);
      try {
        if (shouldCaptureHardBoundReport(proposed.mutations.length, validation)) {
          const report = buildHardBoundReport({
            sourceUserId: userId,
            weekStart: monday,
            validation,
          });
          if (report !== null) {
            await insertAgentReport(client, report);
          }
        }
      } catch {
        // Missing agent_reports must not fail chat persist.
      }
    }
```

HTTP entry is `POST /api/chat/messages` → `sendMessage` (`src/pages/api/chat/messages.ts:34`).

`insertPending` is module-private (`chat.ts:319-336`). Capture is not exported from chat; it is inlined after that await, matching the S-06 plan contract.

`buildHardBoundReport` (`agent-report.ts:16-36`) returns `null` if `hard` is empty (second guard), otherwise:

- `kind: "algorithm_proposal"` (never `"gap"`)
- `status: "open"`
- `title` like `Hard bounds blocked a plan change (CONSECUTIVE_LONGS)`
- `body` = hard messages + canned `BOUND_HINTS` per code
- `boundCodes` unique from `hard[].code`
- **no** chat message body, **no** proposed units

`insertAgentReport` (`agent-report.ts:57-70`) inserts those columns and does not `.select()` the row (member RLS has INSERT-own, no SELECT-own).

There is **no dedup**: every qualifying send inserts another row. Historic hard propositions are not backfilled (S-06 assumption).

### What is not captured (explicit)

| Path | Why no `agent_reports` row | Evidence |
| --- | --- | --- |
| **Soft warnings only** | Mutations insert a pending proposition, but `hard.length === 0` so `shouldCaptureHardBoundReport` is false. Member can Accept. | `validate-plan.ts:20-25` (soft volume); `agent-report.ts:13`; `chat.ts:145-148` still `insertPending` |
| **Explain** | Stub returns `mutations: []`; LLM path same if no mutations. Outer `if (mutations.length > 0)` skipped. | `propose-adaptation.ts:166-168`, `228-237` |
| **Log** | Early return after `upsertLog`; never reaches `insertPending` / capture. Plan: "Do not capture on the log branch." | `chat.ts:126-139`; `propose-adaptation.ts:169-170`, `192-218` |
| **Unmapped help** | Stub fallback reply with `mutations: []`. | `propose-adaptation.ts:185-189` |
| **LLM-unavailable** | `proposeAdaptation` catch returns `COACH_UNAVAILABLE_REPLY` and `mutations: []`. | `propose-adaptation.ts:153-157`; keyed path in `messages.ts:30-34` |
| **Generate failures** | `generateAndPersist` / `generatePlan` never call `insertAgentReport`. Failures (`NO_A_RACE`, `UNSATISFIABLE_BOUNDS`, …) return to `POST /api/plan`. | `generate-plan.ts:8-52`; `plan.ts:268-294`; `pages/api/plan.ts:60-62` |
| **Reject** | `rejectProposition` only sets `plan_propositions.status = rejected`. | `chat.ts:229-245`; `pages/api/chat/reject.ts:26` |
| **Accept HARD_BOUNDS** | 409; no report insert. If the send already captured, Accept does not duplicate. If capture failed fail-open, Accept still does not insert. | `chat.ts:205-213`; `pages/api/chat/accept.ts:29-30` |
| **Manual edit with hard bounds** | `editUnit` writes anyway and returns `validation` as warnings (FU-002). No capture. | `plan.ts:336-401`; `pages/api/plan/units.ts:48-66` |

Schema CHECK already allows `kind IN ('gap', 'algorithm_proposal')` (`supabase/migrations/20260817120000_admin_algorithm_feedback.sql:1-2,22`) but the migration comment and builder only insert `algorithm_proposal`. `AgentReportKind` in `src/types.ts:109` matches the CHECK.

### FU-012 — unmapped as `kind=gap` (related, narrower, leave open)

FU-012 (`context/backlog.md:75-81`) is a **decision** from S-06: ship hard-bound-only, or later `/10x-new admin-unmapped-intent-gaps` to persist `kind=gap` for help-fallback / LLM-unavailable turns. Alternative reading of FR-011 "gap reports" is skill/coverage gaps, not bound failures.

S-06 plan-brief (`context/archive/2026-08-17-admin-algorithm-feedback/plan-brief.md:21-23`):

- Capture trigger: only chat turns with mutations **and** `validation.hard.length > 0` — "algorithm-friction signal already persisted as non-acceptable pending."
- Unmapped intents: **out of this slice** — "flooding on every help fallback would bury real bound failures."

Plan review F3 kept the unused `gap` CHECK as cheap future-proofing aligned with FU-012 (`reviews/plan-review.md:46-54`).

**This research change must not implement FU-012 and must not close it.** Widening to `kind=gap` is a product slice with its own change-id, PII choices (empty body vs canned "unmapped"), and flood control — not a one-line flip of `shouldCaptureHardBoundReport`.

### FU-013 — transcript (related, not capture-trigger)

S-06 stores `source_user_id` + week, **no** chat message body (`plan-brief.md:25`). FU-013 (`backlog.md:83-89`) next step is confirm canned hint only, or `/10x-new admin-report-chat-excerpt`. That is payload shape, not "when does a row appear." Leave it open. Do not implement here.

### PRD FR-011

```95:97:context/foundation/prd.md
### Admin
- FR-011: Admin can review hidden agent gap reports and algorithm-improvement proposals (without notifying the member). Priority: must-have
```

Business logic and Access Control repeat "gap reports and algorithm-improvement proposals" without notifying members (`prd.md:108,123`). Roadmap S-06 (`context/foundation/roadmap.md:141-152`) is done as `admin-algorithm-feedback`: review queue, not generator edits.

Two readings:

1. **Shipped (S-06):** "algorithm-improvement proposals" = hard-bound chat captures (`kind=algorithm_proposal`). Hidden panel; members not notified. Satisfies the review loop for bound friction.
2. **Deferred (FU-012):** "gap reports" = skill/coverage gaps (`kind=gap`) when chat cannot map an intent or the coach is down.

Nothing on disk says FR-011 requires both kinds in MVP. S-06 chose (1) as the minimum Admin loop. FU-014 exists because a human asked whether that basis should widen or tighten before more code.

## Code References

- `src/lib/services/agent-report.ts:12-14` — capture predicate (mutations AND hard)
- `src/lib/services/agent-report.ts:16-36` — `buildHardBoundReport` → `algorithm_proposal`, canned hints, no transcript
- `src/lib/services/agent-report.ts:57-70` — `insertAgentReport` (no `.select()`)
- `src/lib/services/agent-report.test.ts:16-37` — predicate tests
- `src/lib/services/chat.ts:126-139` — log branch early return (no capture)
- `src/lib/services/chat.ts:141-161` — mutations → `insertPending` → fail-open capture
- `src/lib/services/chat.ts:229-245` — Reject: status only
- `src/lib/services/plan-adaptation.ts:47-53` — `gateAccept` wraps `validatePlan`
- `src/lib/services/validate-plan.ts:6-58` — hard vs soft
- `src/lib/services/propose-adaptation.ts:153-157` — LLM catch → empty mutations
- `src/lib/services/propose-adaptation.ts:185-189` — unmapped help fallback
- `src/lib/services/generate-plan.ts:8-52` — generate failures, no report insert
- `src/lib/services/plan.ts:268-294` — `generateAndPersist` returns generate errors as-is
- `src/lib/services/plan.ts:336-401` — `editUnit` persists despite hard (warnings only)
- `src/pages/api/chat/messages.ts:28-34` — optional OpenAI `complete` into `sendMessage`
- `src/pages/api/chat/reject.ts:26` — Reject HTTP
- `src/pages/api/plan.ts:60-62` — generate HTTP, no reports
- `supabase/migrations/20260817120000_admin_algorithm_feedback.sql:1-24` — CHECK includes unused `gap`
- `src/types.ts:109` — `AgentReportKind = "gap" | "algorithm_proposal"`

## Architecture Insights

- **Single writer.** Grep of `src/` shows `insertAgentReport` only from `chat.ts`. Admin APIs only list and mark reviewed (`src/pages/api/admin/reports.ts`).
- **Fail-open is load-bearing.** Hosted SQL may be missing (`DEP-015`); capture must not 500 the member north-star loop. The empty `catch` is intentional, not an oversight.
- **Pending ≠ finding.** Soft-bound mutations still create `plan_propositions` the member can Accept. Findings are the subset that cannot land.
- **Empty mutations never reach the predicate's interesting branch.** Explain, help, LLM-down, and sanitizer-dropped mutations all share `mutations.length === 0`, so they never `insertPending` either.
- **`kind=gap` is a reserved CHECK, not a feature.** Same pattern as wider CHECKs elsewhere; FU-012 would be the first writer.
- **No chat integration test for insert.** `agent-report.test.ts` pins the pure functions. `chat.test.ts` covers `acceptDecision` / `HARD_BOUNDS` and does not assert an `agent_reports` row. That is a coverage gap for a later test-plan item, not a reason to change capture in this research change.
- **Repeat sends duplicate rows.** No unique constraint on `(source_user_id, week_start, bound_codes)`.

## Historical Context (from prior changes)

- `context/archive/2026-08-17-admin-algorithm-feedback/plan-brief.md` — Key Decisions: hard-bound-only capture; unmapped out; no transcript; fail-open; review queue only.
- `context/archive/2026-08-17-admin-algorithm-feedback/plan.md:30-35,51-55,129,189` — What we're not doing includes unmapped/explain/log/LLM-down/soft-only; capture immediately after `insertPending`; do not capture on the log branch.
- `context/archive/2026-08-17-admin-algorithm-feedback/reviews/plan-review.md:46-54` — F3 unused `gap` CHECK dismissed as FU-012 future-proofing.
- `context/archive/2026-08-17-admin-algorithm-feedback/reviews/impl-review.md` — APPROVED; `generatePlan` / `validatePlan` / OpenAI client not touched by S-06.
- `context/backlog.md:67-89` — FU-014 (this research), FU-012 (`admin-unmapped-intent-gaps`), FU-013 (`admin-report-chat-excerpt`).
- `context/foundation/roadmap.md:141-152,177` — S-06 done.

## Related Research

- No prior `research.md` under `admin-algorithm-feedback` (that change went plan → implement).
- `context/archive/2026-08-24-testing-critical-path-ownership-and-bounds/research.md` — grounds Accept re-checking `validatePlan` (risk #2). Complementary: Accept never lands hard bounds; this document is about whether those blocked sends also become Admin rows (they do, at send time).

## Recommendation

**Keep hard-bound-only.** Do not change capture behavior in `admin-report-capture-research`.

| Option | Verdict | Why |
| --- | --- | --- |
| **Keep** (chosen) | Yes | Matches S-06 intent: Admin sees algorithm friction that already exists as non-acceptable pending. Avoids flooding the 100-row list with help text and coach-down noise. FR-011's proposal loop is live; the gap-report reading is already ticketed. |
| **Widen** | Not in this change | Smallest later widen is already named: `admin-unmapped-intent-gaps` (FU-012) for `kind=gap` on help-fallback / LLM-unavailable. Do **not** implement it here. Soft warnings, explain, log, Reject, and generate failures should not ride along with that slice. Transcript is a different change: `admin-report-chat-excerpt` (FU-013). |
| **Tighten** | No | The current rule is already the narrowest useful signal. Tightening (e.g. capture only after Accept 409, or only one code) would drop rows the member never retries and starve `/admin`. |

Leave FU-014 open until a human reads this and marks it done. Leave FU-012 and FU-013 open. Do not invent a new FU for generate-failure capture unless a later session wants one (`FU-022+`); it is a different product question (frozen-anchor unsatisfiable generate vs chat proposer).

## Open Questions

- After this document, should FU-014 be marked done with "keep hard-bound-only confirmed"? That is a human close, not this change.
- If Admin later wants generate-time `UNSATISFIABLE_BOUNDS` in the same queue, that needs its own change-id (not FU-012).
- Whether to add a `sendMessage` integration assertion that a hard-bound consecutive-long proposal inserts one `agent_reports` row — test-plan follow-up, not a capture-rule change.
