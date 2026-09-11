---
change_id: flag-admin-technical
title: Flag for admin stores technical propose and persist JSON
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:22Z
---

## Notes

Files: `src/lib/services/agent-report.ts` (`buildGapReport` / insert), `src/lib/services/chat.ts` (`sendMessage` snapshot + `reportAssistantGap`), `src/components/admin/AdminReports.tsx`, `src/types.ts`.
Depends on: none.

### Sequencing

Not in parallel with `user-coach-notes`, `admin-coach-notes`, `chat-delete-units`, `iso-week-bleed-volume`, `coach-races-context-accept` (`chat.ts`). Not in parallel with `admin-coach-notes` if both touch `src/pages/admin.astro`.

### Option

(b) append the same JSON to `agent_reports.body`; no migration. S-10.5: implement the **(b)** clause only.
Do not ship (a) `payload jsonb` on `agent_reports`. Do not add column/table `payload` jsonb.

### Today

Flag inserts `kind: gap` via `buildGapReport` — `body` is user text + assistant text only. `agent_reports` has title/body/bound_codes; no `payload` jsonb. `chat_messages` has content only. Admin lists prose; persist applied count is not stored.

### Requirements

- [ ] S-10.1 On Flag, store a technical snapshot of the flagged assistant turn, not only user+assistant prose.
- [ ] S-10.2 Snapshot includes `mutations` JSON, `validation` (hard/soft), `dataRequest` / loaded range, and persist summary with `appliedCount` (units/weeks actually written). Capture at Send — messages do not hold propose JSON today.
- [ ] S-10.3 Admin Algorithm feedback shows that snapshot in a `<pre>` under the prose (label e.g. Technical payload).
- [ ] S-10.4 Persist summary must diagnose “coach said it worked, calendar did not”: `proposedCount` vs `appliedCount` (0 + empty `weeksWritten` when `replaceWeek` wrote nothing).
- [ ] S-10.5 Implement the Notes option: **(a)** migration `20260904160000_agent_reports_payload.sql` adding `payload jsonb` on `agent_reports`; existing insert-own / select-admin / update-admin policies cover the column. **(b)** append the same JSON to `body`; no migration.
- [ ] S-10.6 Leave **Flag for admin** / **Reported to admin** copy and placement unchanged.

### Do not

Notify the member on Reviewed; drop hard-bound auto-capture; change the LLM picker; ship a hardcoded admin row. Do not add column/table `payload` jsonb.

### Visible

Flagged turn on `/admin` shows mutations, validation, dataRequest, and persist applied count — so a successful-sounding reply with `appliedCount: 0` is obvious.
