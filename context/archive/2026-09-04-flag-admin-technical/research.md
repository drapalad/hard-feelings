---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "flag-admin-technical: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: flag-admin-technical

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `buildGapReport` body is prose: intro + `User:` + `Assistant:` from `chat_messages.content` (`src/lib/services/agent-report.ts:38-50`). No mutations / validation / dataRequest / persist summary.
- `reportAssistantGap` loads the flagged assistant row and previous user message, then `insertAgentReport(buildGapReport(…))` (`src/lib/services/chat.ts:456-501`). Send path does not snapshot propose JSON onto the message (`insertMessage` content only — grep `chat_messages` insert around `chat.ts:902`).
- `agent_reports` columns: title, body, bound_codes, … — no `payload jsonb` (`supabase/migrations/20260817120000_admin_algorithm_feedback.sql:11-24`). `AgentReport.body` is `string` (`src/types.ts:143-154`).
- Admin Algorithm feedback renders `report.body` in a `<p className="whitespace-pre-wrap">` (`src/components/admin/AdminReports.tsx:96`). No `<pre>` / “Technical payload”.
- Persist applied count is not stored: `persistProposedUnits` returns written units to the Send response (`src/lib/services/chat.ts:359-371`) but Flag does not read that. No `appliedCount` / `proposedCount` / `weeksWritten` identifiers in `src/lib/services`.
- Flag copy: “Flag for admin” / “Reported to admin” (`src/components/plan/PlanChat.tsx:171-184`). Route `POST /api/chat/report` (`src/pages/api/chat/report.ts`).

## Code References

- `src/lib/services/agent-report.ts:38-50` - buildGapReport body parts
- `src/lib/services/chat.ts:456-501` - reportAssistantGap
- `src/lib/services/chat.ts:338-371` - Send persist + validation on response, not on report
- `src/types.ts:143-154` - AgentReport
- `supabase/migrations/20260817120000_admin_algorithm_feedback.sql:11-24` - agent_reports columns
- `src/components/admin/AdminReports.tsx:80-96` - title + body paragraph
- `src/components/plan/PlanChat.tsx:171-184` - Flag / Reported copy
- `src/pages/api/chat/report.ts` - reportAssistantGap
- `src/pages/api/chat/report.test.ts` - 404 for non-latest message

## Architecture Insights

Option (b) means appending JSON to `body` text: `buildGapReport` must receive a snapshot captured at Send, because messages do not store propose JSON. `shouldCaptureHardBoundReport` / `buildHardBoundReport` is a different kind (`algorithm_proposal`) and is not the Flag path.

## Open Questions

- Where to hold the Send snapshot until Flag (in-memory map keyed by message id vs extra DB column). Notes option (b): no `payload` column.
- How to compute `appliedCount` vs `proposedCount` when `decision.ok` is false (appliedUnits undefined, `:359-361`).
- Test harness: `chat.test.ts` / `report.test.ts` / memory-supabase `agent_reports` rows — not fully read.
- `admin.astro` is not in this change’s Files list; AdminReports is. Collision with `admin-coach-notes` is `chat.ts` (and optionally admin.astro if both touch it — this change does not list admin.astro).
