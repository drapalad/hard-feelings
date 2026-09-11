# Show races on the month grid and on the plan list — Plan Brief

> Full plan: `context/changes/races-on-calendar/plan.md`

## What & Why

Races already load on `/dashboard` via `listRaces` but only Profile renders them. Members looking at Calendar or List cannot see the A-priority race on its date. This change overlays the existing `races` array on month cells, the day panel, and List rows.

## Starting Point

`DashboardTabs` has `races` and passes it to `SetupForm` only. `PlanWorkspace` / `PlanCalendar` have no race props. `PlanList` lists planned units in a 21-day window and drops rest days. Profile already uses lucide `Flag` and `Untitled race` / `(A)`.

## Desired End State

An in-month race shows Flag + truncated name + priority on the cell and in the open day panel, alongside a planned unit when one exists. List repeats that marker on matching rows and still lists a race with no planned unit. Data is the SSR `listRaces` snapshot — no hardcoded fixture.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Overlay Calendar + List only; no Profile CRUD, POST, migration, generate, or chat | Locked Notes name the four files and forbid those surfaces | Plan |
| Data source | Thread SSR `races` from `DashboardTabs`; do not refetch `/api/races` | Dashboard already loads `listRaces`; a second fetch would duplicate Profile | Plan |
| Session freshness | Calendar/List keep the page-load snapshot until reload | Changing Profile live-sync would mean lifting SetupForm state; locked Do-not | Plan |
| Cell Rest vs race | Race-only in-month cells omit **Rest**; panel keeps rest copy | Race is the cell’s identity; panel still tells the truth that there is no unit | Unattended |
| Label + truncation | `raceMarkerLabel` + CSS `truncate` + `title`; Flag `aria-hidden` | Matches Profile copy and cell `structure` truncation; Snowflake already hides the icon | Unattended |
| Month padding / past dates | Overlay only `inMonth` cells; any matching date including past-in-month | Locked “matching in-month cell”; List window already starts at today | Plan |
| Marker sharing | Export `raceMarkerLabel` / `RaceMarker` from `PlanCalendar.tsx`; List imports them | Locked file list forbids a new module; List already imports `formatDayLabel` | Unattended |
| List union | `listRows` = in-window units ∪ in-window races; empty copy only when both empty | Locked: do not hide races because rest days are omitted | Plan |
| Duplicate dates | `Map` by `date`; unique `(user_id, date)` already enforces one race | Schema `races_user_id_date_key`; last write if a duplicate array slipped in | Plan |
| Testing | Source-scan + helper unit tests; no Playwright; no `2026-` in production UI | Locked source-scan files; test-plan §6.3; existing List fixture lock | Plan |

## Scope

**In scope:** Prop thread `DashboardTabs` → `PlanWorkspace` → `PlanCalendar` / `PlanList`; Flag + truncated name + priority on in-month cells, day panel, and List; race-only List rows; source-scan/unit tests.

**Out of scope:** Profile CRUD, POST, migrations, generate, chat, live refetch after Profile edits, hardcoded races, Playwright.

## Architecture / Approach

SSR `races` already on the island → pass through → `Map` by `date` in the calendar → same array into List → `listRows` union. Shared marker exported from `PlanCalendar.tsx`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Month grid + day panel | Prop thread + cell/panel marker | Race-only cell still looking like Rest |
| 2. List overlay | Union rows so rest-day races appear | Empty copy hiding race-only windows |

**Prerequisites:** `dashboard-list-chrome` (List + tabs) and `calendar-month-polish` (compact cells) already on this branch.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Race-only cells omit Rest (FU-116). Alternative: Rest + marker together.
- Profile add/edit/delete does not update Calendar/List until reload (locked).

## Success Criteria (Summary)

- In-month race visible on the cell and in the day panel, with unit if planned.
- List shows the same marker; race-only upcoming dates still list.
- No hardcoded race in components; tests lock the contract.
