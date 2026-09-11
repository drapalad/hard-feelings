# Algorithmic week honors prefs and A–D — Plan Brief

> Full plan: `context/changes/generate-honors-plan-prefs/plan.md`
> As-built 2026-09-10. Folder created after the code.

## What & Why

Profile already stores long-run weekdays, rest weekdays, and Easy / Threshold / Speed mix. `generatePlan` still round-robined types and never emitted `long`. Recenzent `mvp-check` and FR-012 required the algorithm to honor those prefs and A–D, not only persist them.

## Starting Point

`generateAndPersist` passed `weeklyKm`, races, frozen units, and `weekStart` into `generatePlan`. Fill types cycled `base → recovery → tempo → threshold → anaerobic`. Rest/long/mix on `Profile` were unused. A was only a presence gate (`NO_A_RACE`).

## Desired End State

`POST /api/plan` (Generate week) fills the ISO week using profile prefs: rest weekdays stay empty, preferred long weekdays emit `long` (skip consecutive long), mix steers Easy/Threshold/Speed buckets. A tapers speed by days-to-A and leaves an in-week A day empty; in-week B is tempo, C is recovery, D does not pin type. Volume oracle unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Algorithm + persist wiring only | UI/prefs already shipped; chat stays proposer | As-built |
| Rest | Skip fill on `restWeekdays` (frozen still wins) | Empty rest is the product meaning of the checkbox | As-built |
| Long | `long` on `longWeekdays` unless consecutive long | Matches profile control and existing `CONSECUTIVE_LONGS` bound | As-built |
| Mix | Greedy bucket vs target %; Easy=`base`/`recovery`, Threshold=`tempo`/`threshold`, Speed=`anaerobic` | Reuses locked mix captions from `profile-plan-prefs` | As-built |
| A taper | ≤6d 100% easy; ≤20d no speed; ≥56d +10 speed from easy | Makes A drive the week, not only `NO_A_RACE` | As-built |
| In-week A | Leave that date empty | Race day is not a fill workout | As-built |
| B / C / D | B→tempo, C→recovery, D no pin | FR-003: priorities drive generation; D is a marker only | As-built |
| Defaults | `defaultGeneratePrefs()` = `PROFILE_PREF_DEFAULTS` | Same Sat / empty rest / 70-20-10 as SQL | As-built |
| Tests | Vitest on `generatePlan` + date helpers; no Playwright | test-plan §6; risk #3 already owns this file | As-built |
| PRD/roadmap stamp | Follow-up commit | This change is code; foundation docs are a separate group | As-built |

## Scope

**In scope:** `GenerateInput` prefs fields; `weekdayOf` / `utcDayDiff`; `generatePlan` fill/skip/taper; `buildGenerateInput` + `generateAndPersist` reading profile prefs; Vitest.

**Out of scope:** Profile UI; migrations; chat/Accept; purple 14-day button; PRD Socrates cleanup; quality-gate title pin; code-reviewer rubrics.

## Architecture / Approach

Keep `generatePlan` a pure function. Thread prefs through `buildGenerateInput`. Persist path already `replaceWeek`s the result. No new API route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Types + dates | Prefs on `GenerateInput`; weekday/day-diff helpers | Wrong UTC weekday vs rest/long checkboxes |
| 2. Algorithm | Skip rest, long, mix, A–D | Volume oracle regressions; consecutive long |
| 3. Persist wiring | `generateAndPersist` passes profile prefs | Defaults vs stored prefs mismatch |

**Prerequisites:** `profile-plan-prefs` archived. **Estimated effort:** already implemented.

## Open Risks & Assumptions

- Long ∩ rest overlap: rest skip runs first, so a day in both arrays is rest (no unit).
- Mix percentages are targets over fill days, not exact km shares.
- A taper uses `utcDayDiff(A date, weekStart)`, not the member's local timezone.

## Success Criteria (Summary)

- Rest days empty; preferred long days are `long`; mix 100% speed → all `anaerobic` when no long/rest pins.
- In-week A empty; B tempo; C recovery; D unpinned; A within 21 days drops anaerobic.
- `npm test` keeps the volume oracle green.
