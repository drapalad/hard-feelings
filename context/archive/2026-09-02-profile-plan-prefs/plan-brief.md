# Profile schedule prefs and stimulus mix — Plan Brief

> Full plan: `context/changes/profile-plan-prefs/plan.md`

## What & Why

Members can already set weekly km. They cannot yet record which weekdays they prefer for the long run, which weekdays they rest, or how they want Easy / Threshold / Speed to split. This slice **persists and shows** those prefs on the existing profile row so a later generate/chat change can honor them. FR-012 (parked richer prefs) is the PRD lineage; generate is explicitly out of scope.

## Starting Point

`profiles` is `{ user_id, weekly_km }` with owner RLS. PUT `/api/profile` accepts only `weeklyKm`. The Profile tab `SetupForm` saves km (or DELETE if empty) and manages races. Chat and generate read `weeklyKm` only.

## Desired End State

Profile tab under weekly km shows multi-select long-run days (Saturday default), rest-day checkboxes (empty = every day available), and Easy / Threshold / Speed summing to 100 (default 70 / 20 / 10). GET/PUT round-trip the fields. SQL is in-repo; hosted apply is DEP-020.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Persist + show only | Locked Notes: do not teach generate or chat yet | Plan |
| Long-run widget | Multi-select `long_weekdays` checkboxes, not `long_weekday` | Human override; same idea as rest days | Plan |
| Rest empty array | `{}` = every weekday available | Locked Notes; no sentinel “none” value | Plan |
| Mix defaults + types | 70 / 20 / 10 integers, CHECK sum = 100 | Matches `smallint` columns and live-total UI | Plan |
| Save UX | One Save on the weekly-km form PUTs km + schedule + mix | Locked allowed one Save or two; one PUT matches the single profiles row | Unattended |
| GET with no row | `weeklyKm: null` plus SQL prefs defaults | SetupForm SSR needs values; defaults match column DEFAULTs | Unattended |
| Long ∩ rest overlap | Allowed (both arrays stored independently) | Persist-and-show; generate does not consume them yet | Unattended |
| Weekday arrays | Unique values, persisted Mon–Sun order | Zod + stable GET; SQL CHECK does not unique | Unattended |
| Sparse / memory rows | Missing new columns → same SQL defaults | Existing `{ weekly_km }` fixtures must keep working | Unattended |
| Clearing weekly km | Still DELETE the whole profile row | Existing SetupForm semantics; prefs live on that row | Unattended |
| Tests | Profile GET/PUT contracts + SetupForm source-scan; no Playwright | Locked Notes + test-plan §6.3/§6.4 | Plan |
| Hosted SQL | DEP-020, not applied in this run | Same as prior product migrations | Plan |

## Scope

**In scope:** Migration on `profiles`; `Profile` + service + PUT zod; dashboard SSR → SetupForm; schedule checkboxes; stimulus mix + optional bar; GET/PUT tests; SetupForm source-scan; DEP-020.

**Out of scope:** Generate/chat consumption; paces; gym; race CRUD; load chart; single-select long day; second table; Playwright; hosted `db push`.

## Architecture / Approach

Expand `profiles` (existing RLS). Map snake_case ↔ camelCase in `profile.ts`. Zod in `profile-races.ts`. UI under weekly km in `SetupForm`, props from `dashboard.astro` through `DashboardTabs`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Migration | SQL + harness list + DEP-020 | Unclassified `ADD CONSTRAINT` if not one ALTER |
| 2. Types/API | DTO, persist, GET/PUT tests | Sparse memory rows breaking generate tests |
| 3. UI | Checkboxes + mix + source-scan | Save blocked incorrectly; missing SSR props |

**Prerequisites:** Profile tab + `/api/profile` already shipped (S-01).
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- Until DEP-020, production GET/PUT may error on missing columns (same window as S-01 follow-on migrations).
- One Save means changing mix requires the weekly-km form submit (FU-104 records the two-button alternative).
- Overlap of long and rest days is stored without a CHECK; a later generate slice may want to forbid it.

## Success Criteria (Summary)

- Prefs round-trip on GET/PUT and appear on Profile with locked copy and defaults.
- Generate/chat still use weekly km only.
- Migration is expand-only; hosted apply is an open DEP.
