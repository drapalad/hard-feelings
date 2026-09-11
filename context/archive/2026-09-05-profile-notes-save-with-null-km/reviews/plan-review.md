<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Save coach notes when weekly km is empty

- **Plan**: context/changes/profile-notes-save-with-null-km/plan.md
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: SOUND
- **Findings**: 0 critical 0 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 4/4 symbols ✓, brief↔plan ✓

- Paths: `SetupForm.tsx`, `SetupForm.test.ts`, `profile.ts` (API), `profile-races.ts`, `profile.test.ts`
- Symbols: guard string + early return (`SetupForm.tsx:339-341`); `saveKm` empty→null (`:286-287`); `profileWriteSchema.weeklyKm` nullable (`profile-races.ts:51`); PUT uses schema + `upsertProfile` (`profile.ts:30-39`)
- Brief decisions match the single-phase UI-only plan; no extra files vs Notes
- Deep verify: all seven riskiest claims CONFIRM (guard is client-only; blast radius is the notes form; source-read tests are the existing pattern)

## Findings

None. The plan matches the code: the product gap is the `saveCoachNotes` empty-km early return; the PUT contract Notes require already exists. Progress rows match Phase 1 Automated/Manual bullets. No TODOs, no contract-surface file to check.
