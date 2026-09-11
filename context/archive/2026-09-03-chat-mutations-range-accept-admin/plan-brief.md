# Coach chat: optimistic send, admin flag, range context, and profile/freeze accept — Plan Brief

> Full plan: `context/changes/chat-mutations-range-accept-admin/plan.md`

## What & Why

This bundled chat change tightens the full member-coach loop without widening scope beyond the existing chat surface. It makes Send feel immediate, lets members escalate a bad or incomplete coach reply to admin, replaces vague key-based extra loading with an explicit date range, and adds a real accept step only for profile/freeze edits while preserving today's auto-apply behavior for ordinary calendar mutations.

## Starting Point

The current chat path already auto-applies calendar mutations on Send, captures hard-bound admin reports, and supports a two-pass LLM completion, but the UI still waits for the server before showing the user's message, extra context is requested through `loadedKeys`, and profile/freeze changes have no accept-required storage path. `plan_propositions` still exists from the old pending-flow era, but it no longer matches the current chat UX.

## Desired End State

Members see their own chat bubble immediately and a visible `Coach is thinking` placeholder while the request runs. They can flag the last assistant message for admin review, see a human-readable loaded date range under the assistant reply when extra context was fetched, and review `Accept profile & freeze changes` only when the coach proposed profile or freeze updates. Ordinary km/type chat edits still land immediately when hard bounds pass.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Delivery order | 4 phases matching P-07 → P-02 → P-03 → P-04 | The user locked the order because all four features touch the same chat files | Plan |
| Optimistic send shape | Local pending user bubble + local assistant thinking row; no extra endpoint | The visible latency problem is purely client-side, so local state is the narrowest fix | Unattended |
| Thinking accessibility | Transcript `aria-busy`; placeholder `aria-live="polite"` with exact `Coach is thinking` | These are explicit locked UX requirements and fit the current presentational split | Plan |
| Member flag API | New `POST /api/chat/report` route | The action belongs to member chat, while `/api/admin/reports` stays admin-only for listing/review | Unattended |
| Gap report payload | Derive `kind: "gap"` title/body from the selected last assistant turn plus optional user prompt | Reuses `insertAgentReport()` and keeps the current admin queue model intact | Plan |
| Hard-bound capture | Keep existing auto-capture unchanged | The locked change explicitly says member flagging is additive, not a replacement | Plan |
| Range request contract | Replace `dataRequest.keys` with `dataRequest: { from, to } | null` | A concrete date span is easier to validate, clamp, render, and test than symbolic keys | Plan |
| First-pass coach context | Profile JSON + compact 7-day planned/logged load summary, not week JSON | The coach should start from profile/current load instead of assuming the visible week is already known | Plan |
| Invalid or inverted range | Skip the second completion and leave `loadedRange: null` | The server can reject bad ranges without failing the whole turn or inventing extra context | Unattended |
| Second-pass failure | Fail closed like `coach-data-request-fail-closed` | A failed follow-up must not apply half-informed mutations or show a misleading chip | Plan |
| Pending profile/freeze persistence | Dedicated `chat_profile_freeze_pending` table with owner RLS | `plan_propositions` is calendar-diff storage, and a separate row shape avoids mixing two workflows | Unattended |
| Freeze/unfreeze targets | Only existing member-owned `training_units` dates survive sanitization | The accept flow must never create or silently retarget units outside the member's actual plan rows | Unattended |
| Accept route | Reuse `/api/chat/accept` for the new pending profile/freeze patch | The existing authenticated accept path is the narrowest place to apply and clear pending member changes | Unattended |
| Dismiss behavior | Dedicated `POST /api/chat/dismiss` clears only the pending profile/freeze row | Keeping dismiss separate avoids reviving the older reject/proposition semantics | Unattended |
| UI contract | Show the exact `Accept profile & freeze changes` card only when a pending patch exists | Locked requirement; plan-only turns must stay auto-applied with no new confirmation surface | Plan |
| Testing | Service/API tests plus existing source-scan UI tests; update migration-safety + add hosted-apply DEP; no Playwright | `context/foundation/test-plan.md` favors the cheapest layer with real signal for these risks | Plan |

## Scope

**In scope:** optimistic send UX, member gap flagging, date-range extra context, pending profile/freeze storage + accept/dismiss flow, listed API/service/UI tests, the one new migration for pending profile/freeze rows, and the matching migration-safety/deploy-backlog updates.

**Out of scope:** requiring Accept for ordinary calendar edits, deleting the old accept-layer leftovers, changing the model picker, adding member notifications, altering `SetupForm`, or teaching generate/validators to consume pending profile/freeze data before Accept.

## Architecture / Approach

`PlanWorkspace` owns all transient chat UI state: optimistic rows, loaded range, reported-message ids, and pending profile/freeze review state. `PlanChat` stays presentational. `chat.ts` remains the orchestration hub for the two-pass LLM flow, auto-applied calendar writes, admin-report insertion, and pending profile/freeze persistence. A dedicated `chat_profile_freeze_pending` table isolates accept-required non-calendar changes from the older `plan_propositions` calendar-diff storage.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Optimistic send transcript | Immediate user bubble + thinking row | Leaving stale optimistic rows on error/success |
| 2. Member flag-for-admin flow | Last-assistant flag control + `kind: "gap"` insert | Accidentally weakening hard-bound auto-capture |
| 3. Date-range coach context | Range-based follow-up loading + loaded span chip | Applying half-valid or overlong extra-context requests |
| 4. Accept profile & freeze changes | Dedicated pending storage + review card + accept/dismiss | Mixing auto-applied calendar edits with accept-required non-calendar patches |

**Prerequisites:** `chat-auto-apply`, `coach-data-request-fail-closed`, `profile-plan-prefs`, and `admin-algorithm-feedback` are already shipped in this worktree and provide the current chat, profile, and admin patterns.
**Estimated effort:** ~1 unattended run across 4 phases, one migration, and targeted service/UI/API tests.

## Open Risks & Assumptions

- Reusing `/api/chat/accept` for profile/freeze accept keeps scope narrow, but implementation must avoid reintroducing the old "accept ordinary chat diffs" behavior.
- `chat_profile_freeze_pending` must be added to `createMemorySupabase()` and related tests or the new service/API coverage will silently lose realism.
- The helper-copy update in `PlanChat` must be coordinated with the new loaded-range chip tests so the source-scan suite stays meaningful rather than brittle.

## Success Criteria (Summary)

- Send feels immediate and clearly shows the coach thinking.
- Members can flag the latest assistant reply for admin review, and `/admin` shows the resulting open report without member notification.
- Extra coach context is requested and displayed as a real date range.
- Profile/freeze proposals require `Accept` or `Dismiss`, while ordinary calendar chat edits still auto-apply.
