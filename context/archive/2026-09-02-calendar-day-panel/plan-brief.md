# Calendar day panel — Plan Brief

> Full plan: `context/changes/calendar-day-panel/plan.md`

## What & Why

Month cells are compact and have no Edit / Log / Freeze. Members still need those actions (FR-005, FR-009, FR-013) without putting a control row in every cell. Restore them via a **click-cell panel under the grid**, reusing existing unit/log APIs.

## Starting Point

`PlanCalendar` is a Monday-start month grid (Rest, TODAY, no cell actions). `PlanWorkspace` loads month units/logs but names logs `_logs` and never calls PUT/PATCH `/api/plan/units` or POST/DELETE `/api/plan/logs`. Those handlers were removed with `month-calendar`. APIs and the old edit form (type, km, structure) still exist in git history (`78a705e`).

## Desired End State

Click an in-month day → a panel below the month grid with that date’s actions. Planned days: Edit (PUT), Log km then Save (POST `{ date, distanceKm }`), one-click Unlog, Freeze/Unfreeze (PATCH). Rest: explanation only. Padding days not clickable. Cells stay compact. Logs flow into the calendar. Mutations merge into month state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Surface | Click-cell panel below the grid, not in-cell icons / ⋯ overflow | Locked Notes; existing cell-no-action test stays | Plan |
| Rest days | Panel, no Edit / Log / Freeze | Locked; log API needs a planned unit (FU-003) | Plan |
| Log POST | Km field + Save log; never POST on select / first Log click | Locked; old one-click `{ date }` is not enough | Plan |
| Log field visibility | Always show km + Save log on a planned-unit panel | Panel has room; “first click” meant the old icon POST | Unattended |
| State after mutation | Merge week slice by action-date Monday; freeze merges one unit | PUT/logs return a week; `setUnits(week)` would wipe the month | Plan |
| Selection a11y | `aria-pressed` on the day button, not `aria-current` | Notes allowed either; Today already uses `aria-current="date"` | Unattended |
| After successful save | Keep the panel open; exit edit mode only | Lets the member chain log/freeze; Close/Esc/same-day still dismiss | Unattended |
| Edit form | Type + km + structure (old form payload) | Notes: include structure if the old form had it — it did | Plan |
| Panel action names | Visible text; callbacks `onSaveUnit` / `onSaveLog` / `onSetFrozen` / `onUnlog` | File-wide source locks forbid `aria-label="Edit"` and `onSaveEdit` / `onToggleFreeze` | Plan |
| Tests | Source-read + existing formatters; no Playwright | test-plan §6.3; Node Vitest only | Plan |

## Scope

**In scope:** `PlanCalendar` selection + panel; `PlanWorkspace` logs prop + unit/log handlers + merge; colocated Vitest; backlog FUs this run opens.

**Out of scope:** Cell action icons; generate/chat/Today/month nav behavior; PlanChat; dashboard tabs; landing; auth; migrations; new APIs; shadcn dropdown.

## Architecture / Approach

Calendar-local `selectedDate` toggles a panel rendered after `grid-cols-7`. Workspace restores PUT/PATCH/POST/DELETE and `mergeWeekSlice(..., utcMondayOf(date))` (freeze: replace one unit). Soft+hard PUT warnings use restored `asWarnings`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Selection + panel chrome | Click in-month day → panel; pass `logs`; Rest vs planned display | Padding clickable; panel inside a cell; breaking cell-no-action greps |
| 2. Actions + merge | Edit / Save log / Unlog / Freeze; merge week/unit into month | `setUnits(week)` wipe; POST log without km; actions leaking into cells |

**Prerequisites:** `month-calendar` on this branch (grid, range GET, `mergeWeekSlice`).
**Estimated effort:** ~2 Automated phases, then human UI checklist.

## Open Risks & Assumptions

- Log km field always visible vs Log-click-to-reveal (FU-091).
- `aria-pressed` vs `aria-current` on the day control (FU-092).
- Panel stays open after save (FU-093).
- First paint still uses SSR week until the month GET returns (unchanged).

## Success Criteria (Summary)

- Click in-month day → panel below the grid; padding inert; cells compact.
- Planned: Edit PUT, Save log POST `{ date, distanceKm }`, Unlog DELETE, Freeze PATCH; Rest has none of those.
- Month state merges returned unit/logs; `_logs` unused is gone.
