# Calendar–Chat No-Overlap Layout Fix — Plan Brief

> Full plan: `context/changes/calendar-chat-no-overlap/plan.md`

## What & Why

The `PlanWorkspace` component renders the calendar grid and chat panel in a 5-column CSS grid that causes the chat to overlap or push the calendar off-screen on viewports narrower than ~1280 px. This fix replaces it with a constrained flex layout so both panels coexist cleanly at all widths.

## Starting Point

`PlanWorkspace.tsx` uses `grid grid-cols-1 lg:grid-cols-5` with col-span-3 / col-span-2, giving the chat 40% of width with no max-width cap. No `min-w-0` on either child, so the calendar's inner 7-column grid can overflow its track.

## Desired End State

At ≥1024 px: calendar and chat side-by-side, chat capped at 420 px, calendar filling remaining space, no horizontal scroll. Below 1024 px: calendar on top, chat below, stacked vertically.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Layout mechanism | Flex instead of grid | Flex with a fixed-width shrink-0 chat panel and flex-1 calendar is simpler and more robust than grid column ratios | Unattended |
| Mobile layout | Vertical stack (no tabs) | Stacking is simpler and avoids hiding content behind a toggle; locked decisions say "or a tab toggle — pick one" | Unattended |
| Breakpoint | lg (1024 px) | Matches Tailwind 4's `lg` breakpoint and the locked decision of ~1024 px | Plan |
| Chat width | Fixed 420 px with shrink-0 | Locked decision specifies ≤ 420 px; fixed width with shrink-0 prevents flex compression | Plan |

## Scope

**In scope:** PlanWorkspace layout wrapper classes only.

**Out of scope:** Calendar cell content, day-edit drawer, chat functionality, plan-month.ts, PlanCalendar/PlanChat internals.

## Architecture / Approach

Replace the 3-div grid structure with a flex container: `flex flex-col lg:flex-row`. Calendar wrapper gets `min-w-0 flex-1 overflow-hidden`; chat wrapper gets `w-full lg:w-[420px] lg:max-w-[420px] shrink-0 min-w-0`. One file, three class-string changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Fix PlanWorkspace layout | Constrained flex layout with no overlap | Calendar inner grid may need additional overflow handling |

**Prerequisites:** None.
**Estimated effort:** ~1 session, single phase.

## Open Risks & Assumptions

- The calendar's 7-column inner grid may still overflow if individual day cells have min-width constraints — mitigated by `overflow-hidden` on the calendar wrapper.

## Success Criteria (Summary)

- At 1440 px, both panels visible side-by-side with no horizontal scroll.
- At 768 px, panels stack vertically.
- No functional regressions in calendar or chat.
