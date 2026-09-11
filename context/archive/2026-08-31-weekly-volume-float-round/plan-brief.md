# Weekly volume float round — Plan Brief

> Full plan: `context/changes/weekly-volume-float-round/plan.md`

## What & Why

A just-generated 50 km week can warn `50.00000000000001 km is over the 50 km target` because seven copies of `50/7` do not sum to 50 in IEEE float. Round km to one decimal in the fill split and in volume compare/messages so that dust is not a bound.

## Starting Point

`generatePlan` writes `remainingKm / emptyDays` onto each empty day, then `validatePlan` uses raw `sum > weeklyKm` / `sum > weeklyKm * 1.2` and interpolates those numbers. Profile weekly km is already one decimal; the calendar already displays `toFixed(1)`.

## Desired End State

A 50 km generated week has no soft volume warning, fill km at one decimal summing to 50, and bound copy without a long binary expansion. Real over-target stays soft; over 120% stays hard. FU-015 done.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Rounding places | `generatePlan` fill split and `validatePlan` compare + message text | LOCKED; both sides of the false warning | Plan |
| Precision | One decimal (`Math.round(km * 10) / 10`) | LOCKED; matches profile weeklyKm and UI `toFixed(1)` | Plan |
| Hard band | Still `weeklyKm * 1.2`; round after multiply (50 → ceiling 60) | LOCKED; do not invent a new 60 constant | Plan |
| Fill remainder | Last empty day gets `roundKm(remaining - perDay * (n-1))` | Even `7.1×7` undershoots 50; last-day remainder keeps the target | Unattended |
| Frozen identity | Leave raw `distanceKm ===` | Dropping an anchor is not a float-display bug | Unattended |
| Helper home | New `src/lib/km.ts` `roundKm`; do not move `hasAtMostOneDecimal` | Same shape as `src/lib/dates.ts`; profile refine stays a write-schema rule | Unattended |
| Close FU-015 | Status: done in phase 2 | Queue Gotowe gdy | Plan |

## Scope

**In scope:** `roundKm`, validate volume compare/messages, generate fill split, tests, close FU-015.

**Out of scope:** UI, FU-016, frozen identity, test-plan phase 2 cookbook, changing 1.2.

## Architecture / Approach

Shared `roundKm` → validator uses rounded total/target/ceiling → generator writes 1-decimal fill with last-day remainder → existing `validatePlan` call on generate stays.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Round compare/messages | Dust is not a violation; copy is 1-decimal | Rounding the ceiling could move a 39.96 vs 40 edge (not the 50/60 case) |
| 2. Round fill split | Stored 50 km week sums to 50; FU-015 done | Last-day remainder makes one day a few tenths heavier |

**Prerequisites:** none (F-01/S-02 already shipped)
**Estimated effort:** one session, two short phases

## Open Risks & Assumptions

- Last empty day can be ~0.3 km longer than the others (50 km / 7 → 7.1×6 + 7.4). Accepted so the week still totals 50.
- Rounding `weeklyKm * 1.2` to one decimal can move a non-50 ceiling by at most 0.05 km. Accepted; LOCKED still requires rounding before compare.

## Success Criteria (Summary)

- 50 km generate: no `WEEKLY_VOLUME_EXCEEDED`, no `50.00000000000001` in messages.
- Soft still fires for a real 50.1; hard still fires above 60 when weeklyKm is 50.
- FU-015 done.
