<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Drop leftover plan_propositions calendar Accept

- **Plan**: context/changes/chat-drop-pending-propositions/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-05
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Drift

| File | Plan | Actual | Verdict |
| --- | --- | --- | --- |
| `src/lib/services/chat.ts` `acceptProposition` | Thin wrapper: only `acceptPendingProfileFreeze`; empty → `NO_PENDING_PROFILE_FREEZE`; no calendar `loadPending` | Calls `acceptPendingProfileFreeze` then `NO_PENDING_PROFILE_FREEZE`; no `plan_propositions` I/O | MATCH |
| `src/lib/services/chat.ts` `listChat` / send | No `proposition` on `ChatList` | Interface has messages / pendingProfileFreeze / threadId / thread only | MATCH |
| `src/pages/api/chat/reject.ts` | Delete the route | File deleted | MATCH |
| `units.ts` / `undo.ts` / `restore.ts` | Stop `rejectPending` | No `rejectPending` imports or calls | MATCH |
| `PlanWorkspace.tsx` / `DashboardTabs.tsx` / `dashboard.astro` | Drop calendar `proposition` state/prop; keep profile/freeze Accept/Dismiss | Accept/Dismiss still hit `/api/chat/accept` and `/api/chat/dismiss`; card heading unchanged | MATCH |
| `src/types.ts` | Remove `PlanProposition` / `PropositionStatus` | Removed; `PlanDiffEntry` kept (still used by plan-adaptation) | MATCH |
| `supabase/migrations/20260905160000_drop_plan_propositions.sql` | `DROP TABLE IF EXISTS plan_propositions CASCADE` + Worker-rollback comment | Same | MATCH |
| `migration-safety.ts` / `memory-supabase.ts` / `migration-pg.test.ts` | Retire table from owner-readable, memory, and PG seed lists | Retired; `DROP TABLE training_units` failure case unchanged | MATCH |
| `context/deployment/deferred.md` | Open **DEP-030** for hosted `db push`; do not apply | DEP-030 open, Source Unattended / this plan | MATCH |

Diff vs `b11d8ad^`: product/test/SQL/DEP as planned. No SetupForm / `weekly_km` edits. Profile/freeze card copy `Accept profile & freeze changes` unchanged. Calendar Accept UI not restored.

## Success criteria re-run

- 1.1–1.2 Accept is profile/freeze-only — PASS (`accept-proposition.test.ts`; leftover calendar seeds removed in Phase 3 as planned)
- 2.1 GET `/api/chat` has no `proposition` key — PASS (`threads.test.ts` `not.toHaveProperty("proposition")`)
- 2.2 `POST /api/chat/reject` absent — PASS (file deleted; product-gates import gone)
- 3.1 `npm test -- src/lib/test/migration-safety.test.ts` — PASS (DROP classified; remaining owner payloads survive)
- 3.2 Memory persist has no `plan_propositions` — PASS (`MEMORY_TABLES.not.toContain`)
- 3.3 `npm test` — PASS (410 passed, 2 skipped)
- 3.4 DEP-030 on disk — PASS
- Lint: `npm run lint` red on untouched HEAD (training-load / pace-estimate / supabase / middleware). ADAPT: eslint of touched sets — PASS
- Break-checks: leftover-win (p1), `proposition: null` on `listChat` (p2), `MEMORY_TABLES` re-add (p3) — tests went red, restored

Manual 1.5, 1.6, 2.5 remain `[ ]` (human-only). Not rubber-stamped.

## Findings

None.

## Triage

No findings. No code edits. No new FU. Hosted DROP remains **DEP-030** (planned; not a finding).
