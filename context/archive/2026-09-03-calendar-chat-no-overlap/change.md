# calendar-chat-no-overlap

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-03
- **archived_at:** 2026-09-03T19:52:15Z
- **title:** Calendar and chat panel never overlap on wide viewports

## Notes

Source: P-08.

### Files

- `src/components/plan/PlanWorkspace.tsx`
- `src/components/plan/PlanCalendar.tsx`
- `src/components/plan/plan-month.ts` (if layout constants live here)

### Today

`PlanWorkspace` renders the calendar grid and the chat panel in a flex row. On viewports narrower than ~1280 px the chat panel overlaps or pushes the calendar off-screen. There is no explicit constraint keeping both visible side-by-side.

### Do

1. Set a layout where the calendar grid takes the remaining space after the chat panel. Use CSS `grid` or `flex` with `min-width: 0` / `overflow` so neither panel overflows.
2. Below a breakpoint (pick ~1024 px), stack vertically: calendar on top, chat below (or a tab toggle — pick one).
3. On wide viewports (≥1280 px) both must be fully visible without horizontal scroll.
4. Chat panel max-width ≤ 420 px on desktop; calendar fills the rest.
5. Do not change calendar cell content, day-edit drawer, or chat functionality.

### Visible result

On a 1440 px viewport, calendar and chat sit side-by-side with no overlap. On a 768 px viewport, they stack or toggle cleanly.
