# Save coach notes when weekly km is empty — Plan Brief

> Full plan: `context/changes/profile-notes-save-with-null-km/plan.md`

## What & Why

Coach notes **Save** still refuses an empty Weekly km field (`Save weekly km before saving coach notes`) even though PUT already accepts `weeklyKm: null` plus notes. Take the FU-146 alternative: notes Save must work without a km target.

## Starting Point

`saveKm` already PUTs `weeklyKm: null` and keeps the row. `profileWriteSchema.weeklyKm` is nullable. `saveCoachNotes` is the leftover guard.

## Desired End State

Empty km + notes **Save** → in-page PUT with `weeklyKm: null`, current long/rest/mix, and `coachNotes`. Guard copy gone. Reload keeps notes and null km. One **Save**. Empty notes still SQL NULL.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | UI only: `SetupForm.tsx` + source-read tests | Notes name those files; API/schema/SQL already accept null km + notes | Plan |
| Empty km payload | Same mapping as `saveKm`: `trimmed === "" ? null : Number(trimmed)` | S-146.1 requires `weeklyKm: null` on empty; reuse the existing ternary | Plan |
| Chrome | Keep one notes **Save**; drop only the guard string | S-146.1 / S-146.4 name that button and forbid a second one | Plan |
| Invalid non-empty km | Leave schema / client error (`0`, `abc`) | Notes unlock empty only; non-empty invalid km already fails `profileWriteSchema` | Unattended |
| Tests | Source-read in `SetupForm.test.ts`; no new API test file | Matches this component’s harness; PUT null + empty-notes SQL NULL already covered in `profile.test.ts` | Unattended |

## Scope

**In scope:** Remove empty-km early return; PUT null km + prefs + notes; source-read tests; in-page fetch (locked `Klik:`).

**Out of scope:** Profile restyle, last-race PATCH, `saveKm`, migrations, Playwright, repo-wide lint, `npm run build`.

## Architecture / Approach

Client-only. `saveCoachNotes` parses with the km Save empty→null mapping, then the existing PUT. Server unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Notes Save with null weekly km | Guard gone; PUT null + notes; source-read lock | Accidentally omitting `coachNotes` (would preserve old notes but skip S-146.1) |

**Prerequisites:** Nullable `weekly_km` already live (DEP-029 done).
**Estimated effort:** One session, one phase.

## Open Risks & Assumptions

- Notes Save with a *dirty* km field (cleared in the input, previous km still in React state) will persist `weeklyKm: null` because the mapping reads `kmInput`, matching S-146.1.
- Repo-wide lint stays red; gates stay scoped.

## Success Criteria (Summary)

- Empty km + notes **Save** does not show the weekly-km guard.
- PUT body has `weeklyKm: null` and `coachNotes`.
- Reload: notes kept, km still empty.
