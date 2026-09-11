<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Collapse the add-race form behind a button

- **Plan**: context/changes/collapsed-add-race/plan.md
- **Scope**: Phase 1 of 1
- **Date**: 2026-09-01
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

## Drift (Agent 1)

| File | Plan | Actual | Verdict |
|------|------|--------|---------|
| `src/components/setup/SetupForm.tsx` | Collapsed default; form iff adding or editing; type=button Add race; Cancel on add and edit; reset then set adding; startEdit clears adding | `adding` defaults `false`; `formOpen = adding \|\| editingId !== null`; same FormFields and POST/PATCH; Cancel always inside the open form; `openAdd` resets then `setAdding(true)`; `startEdit` sets `adding` false | MATCH |
| `src/pages/dashboard.astro` | Do not add Week/Profile tabs | Unchanged; still hydrates SetupForm then PlanWorkspace | MATCH (untouched) |

No planned files missing. No extra product files. Context artifacts (`plan.md`, `plan-brief.md`, `reviews/plan-review.md`, `change.md`) are expected pipeline output.

## Safety, quality, patterns (Agent 2)

No injection/authz/data-safety change (client island only; `/api/races` payloads unchanged). `cn()` still used on the priority select. Collapsed control is `type="button"` so it does not submit weekly km. Existing `Button` + Plus, no new shadcn. `RaceGroup` and weekly km section unchanged.

## Success criteria

- 1.1–1.3: source inspection PASS (`useState(false)`, `id="race-date"` only under `formOpen`, Cancel not gated on `editingId !== null`, Weekly kilometres h2 before Race calendar, no tab chrome).
- 1.4: `npm test` PASS (140 passed, 2 skipped) — re-run 2026-09-01.
- 1.5: `npm run lint` PASS after worktree `npx astro sync` (`.astro/` gitignored; first lint without types was environmental).
- 1.6 Manual: still `[ ]` — human-only; not rubber-stamped.

## Findings

_(none)_
