# Persist last race result for Estimated paces — Plan Brief

> Full plan: `context/changes/persist-race-result/plan.md`
> Research: `context/changes/persist-race-result/research.md`

## What & Why

Estimated paces today is throwaway `useState`: type a distance and time, see Riegel predictions, reload and they are gone. Persist last race result as date + km + finish seconds on `profiles` so the chip and estimates survive reload and another device (S-08.1–S-08.4), using Notes option (a) only.

## Starting Point

`profiles` stores weekly km / weekdays / mix. Profile HTTP is GET / PUT / DELETE of prefs. Estimated paces has no Save, no chip, no date field. `races` has no finish time or distance — option (b) is forbidden.

## Desired End State

On Profile Estimated paces, a member saves a result; a chip like `12 Apr 2026 · 10K · 41:30` appears; reload still shows the chip and filled Riegel inputs. Writes go through PATCH `/api/profile`, not a race row.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| Write verb | New PATCH `/api/profile` with last-race fields only; PUT prefs unchanged | Notes lock PATCH; weekly-km Save must not send last race | Plan |
| `last_race_name` | Omit the column and any name input | Chip mock has no name; an unused column would be a stub | Unattended |
| Date UI | `type="date"` on Estimated paces | S-08.1 requires a persisted date; the mock is a calendar day, not “today” | Unattended |
| PATCH when no profile row | 404 `NOT_FOUND`; do not insert | `weekly_km` is `NOT NULL`; races PATCH already 404s on missing row | Unattended |
| Chip distance | `STANDARD_DISTANCES` label (epsilon) else `{km} km` | Mock is `10K`, not `10 km` | Unattended |

## Scope

**In scope:** Migration `20260904180000_profile_last_race.sql`; `ProfileView` last-race fields; `lastRaceWriteSchema`; `updateLastRace`; PATCH + GET/PUT contracts; Estimated paces date + Save + chip + SSR seed; formatter tests; migration-safety filename list; DEP-024 for hosted apply.

**Out of scope:** races finish time/distance; `last_race_name`; Riegel changes; Strava; hosted `db push`; new RLS; last race on `Profile`/`ProfilePatch`; Playwright; changing DELETE-on-empty-weekly-km.

## Architecture / Approach

SSR `getProfile` → `DashboardTabs` → `SetupForm` seeds inputs. Save PATCHes `{ lastRaceDate, lastRaceKm, lastRaceTimeSec }`. PUT weekly km omits those columns so they survive. Chip formatting is a pure helper (`last-race.ts`) with a fixture for the mock string.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --------- | ------------------------- | ------------------------- |
| 1. Migration, types, service | Columns + `ProfileView` + schema + `updateLastRace`; GET/PUT JSON gains last-race nulls | PUT accidentally nulling last race; harness filename list; existing `toEqual` fixtures |
| 2. PATCH API | HTTP PATCH + 401/404/owner tests | Forged `userId`; 404 vs insert when no weekly km |
| 3. Estimated paces UI | Date, Save, chip, SSR seed | Empty-then-fill flash if seed is in an effect |

**Prerequisites:** none (Depends on: none). Do not land in parallel with `user-coach-notes` (orchestrator).
**Estimated effort:** ~1 session, 3 phases

## Open Risks & Assumptions

- Hosted schema stays behind until DEP-024; production Save 500s until applied.
- Existing DELETE `/api/profile` (empty weekly km) still drops the last-race columns with the row (FU-134).
- `user-coach-notes` also touches `SetupForm` / `profile.ts` / `types.ts` — this worktree is isolated.

## Success Criteria (Summary)

- Last race round-trips on GET after PATCH and after PUT of prefs
- Chip matches `12 Apr 2026 · 10K · 41:30` for that fixture
- Reload seeds distance + time so estimates show without retyping
