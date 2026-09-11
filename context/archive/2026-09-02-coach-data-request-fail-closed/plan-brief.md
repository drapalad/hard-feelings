# Fail Send when the extra coach completion throws — Plan Brief

> Full plan: `context/changes/coach-data-request-fail-closed/plan.md`

## What & Why

The extra coach completion can throw after extras were fetched. Today the Send keeps the first propose (and may auto-apply it) with an empty chip. Fail that turn like a first-call LLM failure so a half-finished extra-context turn never lands on the calendar.

## Starting Point

`completeSendTurn` already maps first-call throws to `COACH_UNAVAILABLE_REPLY` and empty mutations. The second-call catch only clears `loadedKeys`. `chat.test.ts` asserts Friday `distanceKm: 9` from the first shot.

## Desired End State

Second-complete throw → canned unavailable assistant reply, no mutations applied, empty `loadedKeys`, calendar unchanged. Chip stays empty. Allowlist, auto-apply, generate, Accept/Reject, Welcome, and Profile stay as they are.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Second-complete throw | `COACH_UNAVAILABLE_REPLY`, empty `mutations`, `loadedKeys: []` | Locked: same as first-call LLM failure; do not keep-first | Plan |
| First-shot `mutations` + `dataRequest` | Discard the first propose; do not auto-apply | Locked: first-shot JSON can include both; calendar must stay untouched | Plan |
| HTTP / UI surface | Stay 200; persist user + canned assistant via existing `sendMessage` | First-call is not `ServerError` (`!response.ok`); matching it avoids a new error code | Unattended |
| Extra-fetch throws | Unchanged: omit that key; skip second complete if none remain | Locked scopes only the second `complete` throw after extras fetched | Plan |
| Logging | Same `console.error("Coach LLM failed:", …)` as the first-call catch | Same failure class; ops already grep that line | Unattended |
| Testing | Invert the existing `chat.test.ts` second-throw case (keep the 9 km + `races` fixture) | Locked: that test must become the fail-closed oracle | Plan |
| FU-122 | Mark done pointing at this change-id | This change is the promotion; keep-first is no longer an open question | Plan |

## Scope

**In scope:** Second-`complete` catch in `completeSendTurn`; invert `chat.test.ts`; close FU-122.

**Out of scope:** Allowlist, chip copy, auto-apply-when-hard-empty, generate, Accept/Reject, Welcome, Profile, extra-fetch omit-key, HTTP 5xx, unrelated FUs / DEP-020.

## Architecture / Approach

Replace first `raw` inside the existing second-`complete` `catch`, then let `sanitizeProposeResult` and `sendMessage` persist the canned turn. No new result type, route, or island change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Fail-closed second complete | Catch replaces `raw`; inverted test; FU-122 done | Leaving first mutations in `raw` so auto-apply still writes Friday 9 |

**Prerequisites:** `coach-data-request` two-pass `sendMessage` already on this branch (`21545b0`).
**Estimated effort:** one phase, one unattended run.

## Open Risks & Assumptions

- Canned reply is an assistant bubble, not the red `ServerError` box — that matches first-call today.
- Extra-fetch throws stay omit-key, not fail-closed.

## Success Criteria (Summary)

- Second-complete throw does not apply first-shot mutations.
- Member sees `COACH_UNAVAILABLE_REPLY`; chip empty.
- Keep-first test is gone; FU-122 is done.
