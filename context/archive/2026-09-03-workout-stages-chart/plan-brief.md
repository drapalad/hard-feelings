# Workout Stages Chart — Plan Brief

> Full plan: `context/changes/workout-stages-chart/plan.md`

## What & Why

The day panel shows `structure` as a sentence. Members cannot see warm-up / work / cool-down at a glance. This slice parses that string client-side and draws a colored horizontal stage bar.

## Starting Point

`DayPanel` prints `unit.structure`. There is no `stages` column. Generate writes short labels or nothing. `TrainingLoadChart` already stacks CSS bars without a chart library.

## Desired End State

A structured session shows a gray / amber-or-red / gray timeline with hover labels. Unparseable or easy runs show one solid bar. Rest days and the Edit form stay chart-less. The structure sentence remains editable text.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Data source | Parse `TrainingUnit.structure`; no DB column | Locked Notes; the type has no `description`/`stages` | Plan |
| Placement | Day panel only, **alongside** the sentence | Locked visible result allows either; keeping text preserves Edit source | Unattended |
| Hide while editing | Yes | Draft string is unsaved; Edit already owns Structure | Unattended |
| Empty / easy fallback | One solid bar from structure or `{km} {type}` | Locked: never error | Plan |
| Interval `N × dist` | One work stage, weight `N * dist` | Do not invent recovery jogs the string never named | Unattended |
| Mixed units width | Time → km at 5:00 /km | One axis without a pace field | Unattended |
| Work color | Amber; red if type is threshold/anaerobic | Locked “amber/red by intensity”; type is the only intensity signal | Unattended |
| Hover/tap | Native `title` + `aria-label` | No tooltip package; matches existing `title` on RaceMarker | Unattended |
| Testing | Parser Vitest + source-read chrome | Matches `TrainingLoadChart.test.ts` / test-plan §6.1; no Playwright | Plan |
| Scope vs full P-12 | Parser + bar only | Locked Do-not: no stages editor, no jsonb, no generate | Plan |

## Scope

**In scope:** `workout-stages.ts` parser, `WorkoutStagesChart.tsx`, DayPanel wiring, unit + source-read tests.

**Out of scope:** stages editor, jsonb, generate, APIs, cell-level bars, chart libraries, LLM parse.

## Architecture / Approach

`parseWorkoutStages({ structure, distanceKm, type })` → weighted segments. `WorkoutStagesChart` maps weights to a flex row. `DayPanel` mounts it in the read-only unit block.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Parser | Deterministic stages + fallback tests | Over-fitting to one example string |
| 2. Day-panel bar | HTML stack + chrome lock | Hiding the sentence or leaking into Edit |

**Prerequisites:** Waves 1–2 calendar + day panel on this worktree.
**Estimated effort:** one unattended run, two phases.

## Open Risks & Assumptions

- Real generate strings are shorter than the Notes example; fallback will be common.
- 5:00 /km time conversion is a width heuristic only, not a pace prescription.

## Success Criteria (Summary)

- Notes example → three colored segments with hover labels.
- Easy / empty → one bar, no throw.
- No new API, migration, or generate change.
