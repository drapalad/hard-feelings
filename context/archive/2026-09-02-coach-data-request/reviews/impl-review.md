<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Coach allowlisted extra context

- **Plan**: context/changes/coach-data-request/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-09-02
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Second-pass extra JSON had no prompt test

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/openai-chat.test.ts
- **Detail**: `systemPrompt` serializes `extra.logs42d` / `priorPlan` / `races` / `profile`, but tests only covered first-pass races/logs. A silent drop of the follow-up block would not fail CI.
- **Fix**: Assert the follow-up extra JSON strings appear in the completion request body.
- **Decision**: FIXED — added `puts follow-up extra JSON into the system prompt`.

## Drift summary

| Planned | Actual | Verdict |
| --- | --- | --- |
| `openai-chat.ts` schema, allowlist, prompt | `dataRequest` required; `filterAllowlistedKeys`; structure/races/logs/extra in prompt | MATCH |
| `chat.ts` two-pass + `loadedKeys` | `completeSendTurn` + `fetchCoachExtra`; empty-hard auto-apply unchanged | MATCH |
| `propose-adaptation.ts` completer type + `toRawProposeResult` | Exported; `dataRequestKeys?` on complete result | MATCH |
| `messages.ts` spread | Unchanged; still `...result.data` (carries `loadedKeys`) | MATCH |
| `PlanChat` muted chip | `formatLoadedChip`; sibling under last assistant | MATCH |
| `PlanWorkspace` session keys | Clear on send/loadMonth; set from Send JSON | MATCH |
| Accept / extra POST / migration | Not present | MATCH |

## Success criteria

Automated rows in Progress are `[x]` with SHAs `20fb6f6` / `6dc9e2f` / `d81814a`. Re-ran phase Vitest files: pass. Manual 3.5 remains `[ ]`.
