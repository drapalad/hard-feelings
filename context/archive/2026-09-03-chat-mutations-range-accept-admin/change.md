# chat-mutations-range-accept-admin

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Coach chat: admin feedback flag, date-range context, Accept for profile/freeze, optimistic send

## Notes

This change bundles four tightly-coupled chat improvements (P-02, P-03, P-04, P-07). They all touch `PlanChat.tsx`, `PlanWorkspace.tsx`, and `src/lib/services/chat.ts`. Implement in order: P-07 (optimistic send), P-02 (admin flag), P-03 (range context), P-04 (accept for profile/freeze).

**Conflict note:** shares UI files with `chat-threading` — do not implement in parallel.

---

### P-02 — Flag for admin (chat-admin-feedback)

**Files:** `src/components/plan/PlanChat.tsx`, `src/lib/services/chat.ts`, `src/lib/services/agent-report.ts` (`insertAgentReport`), `src/pages/api/chat/` or a `POST /api/admin/reports` member-flag route, `src/components/admin/AdminReports.tsx`.

**Today:** Chat inserts an `algorithm_proposal` row only when `shouldCaptureHardBoundReport` is true (mutations + `validation.hard`). Members have no control to file a gap. Admin `/admin` lists reports; members are not notified on Reviewed.

**Do:**
- On the last assistant message, show a muted **Flag for admin** control. After a successful flag, replace it with **Reported to admin** (session-local is enough; do not add a `chat_messages` column unless you need idempotency).
- Flag inserts `agent_reports` with `kind: "gap"` (for a member flag), `status: "open"`, title/body derived from the turn (assistant reply ± user text). Reuse `insertAgentReport`. Do not notify the member when an admin marks Reviewed.
- Keep the existing hard-bound auto-capture. Do not require hard bounds for this path.
- Do not ship a hardcoded report row.

**Do not:** drop hard-bound reports, change the LLM model picker, add a new table, or email/notify members.

**Visible:** member chat can flag a turn; admin Algorithm feedback lists a matching open report.

---

### P-03 — Coach loads a date range (coach-range-context)

**Files:** `src/lib/services/openai-chat.ts`, `src/lib/services/chat.ts`, `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/pages/api/chat/messages.ts`. Update `openai-chat.test.ts`, `chat.test.ts`, `PlanChat.test.ts`, `PlanWorkspace.test.ts`. No new migration.

**Today:** `completeOpenAiPropose` always dumps Week JSON (`weekStart` units) plus last-14d logs/races on the first complete. `dataRequest` is `{ keys: string[] }` with allowlist `logs_42d | prior_plan_14d | races | profile`. `completeSendTurn` fetches those keys and runs one follow-up; if the second complete throws it fail-closes (`COACH_UNAVAILABLE_REPLY`). `PlanChat.formatLoadedChip` maps those keys to labels. Helper copy is "Ask the coach to lay out the next 10–14 days." POST `/api/chat/messages` returns `loadedKeys: string[]`.

**Do:**
1. First complete must **not** dump Week JSON or `weekStart` units. Default payload: `getProfile` plus a compact current-load summary (planned km + logged km over the last 7 UTC days). Keep create-horizon and mutation rules.
2. Replace key allowlist as the **primary** API. Model returns `dataRequest: { from, to } | null` — inclusive UTC `YYYY-MM-DD`, **max 70 days**. Server clamps a too-long span; reject inverted (`from > to`) and invalid dates (no second complete). Drop `logs_42d` / `prior_plan_14d` keys as the request shape (do not keep them as the primary contract).
3. When a valid range remains, one follow-up complete with units + logs for that span (races optional). Fail-closed if the second complete throws — same unavailable reply, no mutations applied, no chip.
4. Response field `loadedRange: { from, to } | null` (not `loadedKeys`). Chip under the last assistant message: human span `Loaded: 3 Sep–12 Nov` (`D Mmm` + en-dash; omit years when both ends share the year). `formatLoadedChip` takes the range, not key labels.
5. Helper copy: the coach starts from profile + current load, not this week's calendar. Do not imply the visible week is already in context.

**Do not:** persist a new table; change week-scoped `chat_messages`; auto-apply vs Accept; live LLM in a UI mock — implement the real two-step complete.

**Visible:** chip reads a date range (e.g. `Loaded: 3 Sep–12 Nov`); helper no longer implies this week's plan is already in the coach's head.

---

### P-04 — Accept for profile and freeze changes (chat-profile-freeze-accept)

**Files:** `src/lib/services/openai-chat.ts` (propose schema), `src/lib/services/chat.ts`, `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/pages/api/chat/messages.ts`, `src/pages/api/chat/accept.ts` (or a dedicated accept-profile route). Migration if you store pending profile/freeze separately: `20260903123000_chat_profile_freeze_pending.sql` + RLS. Decision-pack screen was mocked — implement on the real tables, not a stub card.

**Today:** Send auto-applies calendar mutations. `plan_propositions` pending UI is gone. Coach must not emit frozen flips (`Do not change frozen units`) and has no profile patch fields. Profile is only `SetupForm` + `PATCH /api/profile`. Freeze is only the day-panel button.

**Do:**
- Extend the propose JSON with optional `profile` patch (`weeklyKm`, `longWeekdays`, `restWeekdays`, `mixEasy`, `mixThreshold`, `mixSpeed`) and `freeze` / `unfreeze` date arrays. Calendar km/type mutations stay auto-apply as today.
- If a turn has profile or freeze changes, **do not apply them on Send**. Persist a pending patch (reuse `plan_propositions` **or** a dedicated pending-profile table — pick one and name the migration + RLS). Return it on Send. UI: a review card titled exactly `Accept profile & freeze changes`, listing the patch (e.g. rest weekdays, freeze dates), with **Accept** and **Dismiss**. Accept writes profile via the existing profile service and sets `frozen` on those dates; then clears pending. Hard bounds still block calendar auto-apply independently.
- Plan-only turns (ordinary km/type edits) must **not** show this card — they auto-apply as today.

**Do not:** require Accept for ordinary km/type chat edits; restore Accept for all propositions; change SetupForm layout.

**Visible:** after a profile/freeze propose, Send left a review card; Accept is required; plan-only turns still land without Accept.

---

### P-07 — Optimistic chat send (optimistic-chat-send)

**Files:** `src/components/plan/PlanChat.tsx`, `src/components/plan/PlanWorkspace.tsx`. Update source-scan tests in `PlanChat.test.ts` / `PlanWorkspace.test.ts`.

**Today:** `PlanWorkspace.send` sets `busy` and fetches `POST /api/chat/messages`. `PlanChat` only renders `messages` from the response. The user bubble appears together with the assistant reply. Send is disabled while busy, but there is no pending row and no typing indicator. Chat POST can take tens of seconds (LLM).

**Do:**
- On Send, immediately store the trimmed content as a pending user message (temp id is fine) and clear the textarea.
- While waiting, show that user bubble plus an assistant placeholder: CSS pulse/dots and the text `Coach is thinking`, with `aria-busy` on the transcript and `aria-live="polite"` on the placeholder.
- Keep Send disabled while busy (already). On HTTP error, keep the user bubble, show `ServerError`, and clear the thinking row. On success, replace pending with the server `messages` list and clear thinking.
- Do not wait on a fixed timeout. Do not POST extra endpoints.

**Do not:** change auto-apply, dataRequest, Accept/Reject for profile/freeze, or helper copy under Coach chat.

**Visible:** after Send, the user's text is on screen while the coach thinks; a typing indicator is obvious.
