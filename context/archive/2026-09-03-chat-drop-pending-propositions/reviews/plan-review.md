<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Drop leftover plan_propositions calendar Accept

- **Plan**: context/changes/chat-drop-pending-propositions/plan.md
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: SOUND
- **Findings**: 0 critical 3 warnings 1 observation (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 13/13 paths ✓ (`chat.ts`, `accept-proposition.test.ts`, `reject.ts`, `units.ts`, `undo.ts`, `restore.ts`, `PlanWorkspace.tsx`, `DashboardTabs.tsx`, `dashboard.astro`, `memory-supabase.ts`, `migration-safety.ts`, `accept.ts`, `dismiss.ts`), 6/6 symbols ✓ (`acceptProposition`, `rejectPending`, `loadPending`, `listChat`+`proposition`, `rejectProposition`, `plan_propositions` CREATE), brief↔plan ✓ after PLAN-FIX.

Deep verification (inline; no sub-agent): `acceptProposition` still prefers `loadPending` over `acceptPendingProfileFreeze` (`chat.ts` ~464–500). `insertPending` is already gone. `migrateOverFixture` classifies `DROP TABLE` then fails payloadDiff / missingSelectOwn for owner-readable tables. `product-gates.test.ts` imports `/api/chat/reject`. PlanChat copy `Accept profile & freeze changes` is unchanged.

## Findings

### F1 — DROP TABLE fails migrate-over-fixture unless owner-readable list is retired

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Migration / `migration-safety.ts`
- **Detail**: Plan success criterion 3.1 said “classified … (no distinctive-key rewrite)”. `applyStatement` already classifies `DROP TABLE` (deletes table/rows/policies). `migrateOverFixture` then seeds `OWNER_READABLE_TABLES` including `plan_propositions` and throws `member rows did not survive migration` / `owner SELECT policy missing`. The existing test that `DROP TABLE training_units` throws is this payload/policy path, not unclassified SQL. `migration-pg.test.ts` `forceOwnerRls` would also throw on the dropped table when `HF_MIGRATION_PG=1`.
- **Fix**: Retire `plan_propositions` from `OWNER_READABLE_TABLES` / `DISTINCTIVE_SEEDS` / pg `OWNER_TABLES`+`seedMemberA` in the same phase as the DROP. Use **DEP-030** for hosted apply.
- **Decision**: FIXED — Phase 3 now retires the table from those lists, updates the filename/newest assertions, and records DEP-030. 3.1 wording matches the real harness.

### F2 — Phase 1 leftover-row tests collide with Phase 3 memory-table removal

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1.2 vs Phase 3 memory-supabase
- **Detail**: Phase 1.2 requires seeding `plan_propositions` in `accept-proposition.test.ts`. Phase 3 removes that name from `MEMORY_TABLES` / `MemorySeed`. Leaving the leftover test (and `chat.test.ts` / `threads.test.ts` seeds) makes `npm test` fail after Phase 3.
- **Fix**: Mark 1.2 as Phase-1-only; Phase 3 deletes leftover-row seeds when the memory table goes away.
- **Decision**: FIXED — Phase 1 contract + Phase 3 leftover-seed file list.

### F3 — Checkboxes in Success Criteria; dummy Manual 3.4; missing types.ts / product-gates paths

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase Success Criteria / Phase 2 files / Phase 3.4
- **Detail**: Phase blocks used `- [ ]` outside `## Progress`. 3.4 “hosted apply is tracked as an open DEP” is agent-verifiable. Phase 2 omitted `src/types.ts` (`PlanProposition`) and the concrete `product-gates.test.ts` import of `reject.ts`.
- **Fix**: Plain bullets in Success Criteria; move 3.4 to Automated as DEP-030; name types.ts and product-gates.test.ts.
- **Decision**: FIXED — Success Criteria are plain bullets; Progress Phase 3 Automated includes 3.4; Phase 2 file list updated.

### F4 — insertPending already deleted

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 Intent
- **Detail**: Plan said delete `insertPending`. `chat-auto-apply` already removed it; only `rejectPending` remains on Send.
- **Fix**: Note absence; do not restore.
- **Decision**: FIXED — Phase 2 Intent says `insertPending` is already absent.

## Triage

- Fixed: F1, F2, F3, F4
- Skipped: none
- Dismissed: none

► Verdict after fixes: SOUND
