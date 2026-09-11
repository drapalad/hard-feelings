<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Admin coach notes

- **Plan**: `context/changes/admin-coach-notes/plan.md`
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-04
- **Verdict**: APPROVED
- **Findings**: 1 critical, 0 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Success criteria

Automated 1.1–1.4, 2.1–2.3, 3.1–3.5 are `[x]` in Progress. Re-ran `npm test -- src/lib/services/openai-chat.test.ts src/lib/services/chat.test.ts` after F1 (31 passed). Manual 2.4–2.6 remain `[ ]` (human-only).

## Drift vs plan

| File | Plan | Actual | Verdict |
|------|------|--------|---------|
| `supabase/migrations/20260904120100_project_coach_notes.sql` | `ALTER TABLE … ADD COLUMN coach_notes text`; no RLS | Matches | MATCH |
| `src/lib/services/llm-settings.ts` | get/set notes; model-only upsert omits column | `getStoredCoachNotes` / `setStoredCoachNotes`; `setStoredOpenAiModel` unchanged | MATCH |
| `src/pages/api/admin/settings.ts` | optional `coachNotes`, omit-rebuild, 404, clamp | zod transform mirrors `profileWriteSchema`; isAdmin `notFound()` | MATCH |
| `src/pages/admin.astro` | seed prop; keep 404 | `coachNotes={coachNotes}`; 404 HTML unchanged | MATCH |
| `src/components/admin/AdminLlmSettings.tsx` | textarea + Save model sends both | Label, `maxLength={2000}`, PATCH both fields | MATCH |
| `src/lib/services/chat.ts` | load once onto `firstRequest` | `adminCoachNotes: await getStoredCoachNotes(client)` | MATCH |
| `src/lib/services/openai-chat.ts` | `Admin coach notes:` after Member line | Same, after F1 fix | MATCH |

Unplanned paths: tests, `context/backlog.md` FU-137/138, `context/deployment/deferred.md` DEP-026 — expected by the plan.

## Findings

### F1 — Break-check `&& false` leaked into committed `systemPrompt`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/openai-chat.ts:336` (as shipped in `4214eb1`)
- **Detail**: Phase 3 deliberate-break inverted the inject with `if (adminNotes !== "" && false)`. A parallel `git add` raced the break edit, so `4214eb1` committed the inverted guard. Admin notes never reached the model; Member inject still worked. Tests in that commit were run *before* the leak was staged.
- **Fix**: Restore `if (adminNotes !== "") { parts.push(\`Admin coach notes: ${adminNotes}\`) }`.
- **Decision**: FIXED — restored the guard; `openai-chat.test.ts` + `chat.test.ts` 31/31 green.

## Triage

- Fixed: F1
- Deferred: none
- Dismissed: none

► Verdict after fixes: APPROVED
