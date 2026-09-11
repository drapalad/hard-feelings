# Races Live on Calendar — Plan Brief

> Full plan: `context/changes/races-live-on-calendar/plan.md`

## What & Why

After adding or editing a race on the Profile tab, the Calendar and List tabs still show stale SSR data until a full page reload. This change lifts `races` state from `SetupForm` to `DashboardTabs` so all three tabs share one live array.

## Starting Point

`dashboard.astro` fetches races at SSR and passes them as a prop through `DashboardTabs` to all panels. `SetupForm` copies that into local `useState` and mutates only its own copy after API calls, so Calendar and List never see the update.

## Desired End State

After Add/Edit/Delete race on Profile, switching to Calendar or List immediately shows the updated race markers and list rows — no page reload needed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| State location | `DashboardTabs` `useState` | It is the closest common ancestor of all three tab panels. | Plan |
| SetupForm keeps local state | Yes, with `onRacesChange` callback | SetupForm still needs `races`/`setRaces` for optimistic form UI; the callback syncs the parent. | Unattended |
| No new tests | Correct — pure prop wiring | No new logic introduced; existing tests cover the race API. | Plan |

## Scope

**In scope:** Lift races state, wire `onRacesChange` callback, pass live array to Calendar and List.

**Out of scope:** API endpoints, race priority rules, RaceMarker styling, Generate/chat/logs.

## Architecture / Approach

Classic React "lift state up". `DashboardTabs` gains `useState<Race[]>`. `SetupForm` gets an `onRacesChange` prop called after each successful mutation. `PlanWorkspace` and `PlanList` receive the live array — no changes needed inside them since they already use `races` as a prop.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lift races state | Live races across all tabs | None — minimal wiring change |

**Prerequisites:** None
**Estimated effort:** ~1 session, 1 phase

## Open Risks & Assumptions

- SetupForm keeping a local copy means two sources of `races` state exist momentarily — acceptable since the callback fires synchronously after `setRaces` and both arrays reference the same sorted result.

## Success Criteria (Summary)

- After Add race on Profile, Calendar shows the Flag marker on that date without reload
- After Delete race on Profile, the marker disappears on Calendar and List without reload
- TypeScript, lint, build, and existing tests all pass
