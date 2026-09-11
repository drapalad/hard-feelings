---
change_id: calendar-day-panel
title: Open a day-action panel from a month-calendar cell
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T09:03:33Z
---

## Notes

LOCKED. Human 2026-09-02: restore Edit / Log / Freeze via a **click-cell panel**, not controls inside month cells. Files: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`. Reuse existing APIs: PUT/PATCH `/api/plan/units`, POST/DELETE `/api/plan/logs`. No new table, column, or RLS. No new shadcn dropdown.

### Today

The Week tab is a month grid. Cells show day number, type chip + type, planned km, Rest, TODAY. There are **no** Edit / Log / Freeze / ⋯ controls. `PlanWorkspace` still loads month units and week-scoped generate/chat/restore, but it does not call the unit/log APIs. `_logs` is unused in the calendar UI. Handlers and forms lived in the old seven-card week strip and were removed with `month-calendar`.

### Do

1. **Select an in-month day** (planned or Rest). Padding days outside the month are not clickable. Selected cell: stronger outline / `aria-pressed` or `aria-current` on the day control. Click the same day again (or Esc) to close. Click another in-month day to switch.

2. **Panel below the grid** (same calendar column, not a popover inside the cell, not three `size-9` icons, not a `MoreHorizontal` overflow in every cell). Heading is the selected date (`formatDayLabel`). Close control.

3. **Planned unit in the panel:**
   - **Edit:** type + km (+ structure if the old form had it). Save → PUT `/api/plan/units`. Cancel leaves the unit unchanged.
   - **Log:** do **not** POST on the first click. Number field default = planned `distanceKm` (or existing log km if already logged). **Save log** → POST `{ date, distanceKm }`. **Unlog** is one click → DELETE. Show logged vs planned km when a log exists.
   - **Freeze / Unfreeze:** PATCH `{ date, frozen }` with existing `setFrozen` behavior.

4. **Rest day:** panel explains Rest. No Edit / Freeze / Log (log API requires a planned unit; do not invent an off-plan diary).

5. Wire `PlanWorkspace`: pass `logs` into the calendar; on success merge the returned unit into month state (same date) and merge log slices like generate already does for weeks. Soft validation from edit follows the old calendar pattern. Do not refetch the whole month unless merge is impossible.

6. Frozen units: the panel shows Freeze vs Unfreeze correctly. A small non-interactive frozen hint on the cell is OK; **no** action icons in the cell.

### Do not

- Put Edit, Log, Unlog, Freeze, ⋯, or the km log form **inside** month cells.
- Reintroduce the seven fat week cards or `size-9` icon rows on a week strip.
- Require type-label ellipsis / nowrap (P-15 was a week-column hack).
- Change generate/restore/Today/month navigation, `PlanChat`, dashboard tabs, landing, auth, Topbar.
- Confirm-before-freeze. New migrations.

### Visible

Click Tuesday → a panel under the month grid with that day’s actions. Cells stay compact. Logging asks for km before POST. Rest days open a panel without workout actions.
