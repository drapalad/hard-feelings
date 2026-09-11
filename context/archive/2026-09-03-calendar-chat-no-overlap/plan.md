# Calendar–Chat No-Overlap Layout Fix — Implementation Plan

## Overview

Fix the `PlanWorkspace` layout so the calendar grid and chat panel never overlap or push each other off-screen. On wide viewports (≥1280 px) both panels sit side-by-side; below ~1024 px they stack vertically. Chat panel is capped at 420 px on desktop; the calendar fills the remaining space.

## Current State Analysis

`PlanWorkspace` (line 589) renders:

```tsx
<div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
  <div className="lg:col-span-3">
    <PlanCalendar … />
  </div>
  <div className="lg:col-span-2">
    <PlanChat … />
  </div>
</div>
```

The `lg:` breakpoint is 1024 px in Tailwind 4. The 5-column grid gives the chat 40% of the width — on a 1280 px screen that's 512 px, wider than the 420 px cap and the calendar gets only 60%. There is no `min-width: 0` on either child, so a wide calendar can overflow the grid track. On viewports between 1024–1280 px, the fixed gap plus unconstrained columns cause overlap or horizontal scroll.

### Key Discoveries

- `PlanWorkspace.tsx` line 589 is the only layout root — no wrapper div in the Astro page sets additional constraints.
- `PlanCalendar` already has a 7-column inner grid (`grid grid-cols-7 gap-1`, line 530) that needs `min-width: 0` on its parent to shrink properly.
- `PlanChat` has no width constraints of its own.
- `plan-month.ts` has no layout constants — all layout lives in Tailwind classes.
- Tailwind 4 breakpoints: `lg` = 1024 px.

## Desired End State

On a 1440 px viewport, the calendar and chat sit side-by-side with no overlap or horizontal scroll. The chat panel never exceeds 420 px; the calendar fills remaining space. On a 768 px viewport, calendar and chat stack vertically (calendar on top, chat below). Between 1024–1280 px, the same side-by-side layout holds with the chat constrained and calendar fluid.

### Verification

- At 1440 px: both panels visible, no horizontal scrollbar, chat ≤ 420 px wide.
- At 1280 px: both panels visible, no overlap.
- At 768 px: panels stacked vertically, calendar on top.
- No changes to calendar cell content, day-edit drawer, or chat functionality.

## What We're NOT Doing

- Not changing calendar cell content, day-edit drawer behavior, or chat functionality.
- Not adding a tab toggle for mobile — vertical stacking is simpler and sufficient.
- Not changing PlanCalendar or PlanChat internal markup beyond what overflow/min-width requires.
- Not touching `plan-month.ts` (no layout constants there).

## Implementation Approach

Replace the current 5-column grid with a flex layout that uses `max-w-[420px]` on the chat panel and `min-w-0 flex-1` on the calendar. Below `lg` (1024 px), flex-direction is column (Tailwind default for `flex`); at `lg` and above, `flex-row`. Add `min-w-0` to both panels and `overflow-hidden` on the calendar wrapper to prevent the 7-column inner grid from overflowing.

## Phase 1: Fix PlanWorkspace layout

### Overview

Replace the grid layout in `PlanWorkspace` with a constrained flex layout that enforces the chat max-width and prevents calendar overflow.

### Changes Required:

#### 1. PlanWorkspace layout container

**File**: `src/components/plan/PlanWorkspace.tsx`

**Intent**: Replace the 5-column grid with a flex layout. The outer div becomes `flex flex-col lg:flex-row gap-6`. The calendar wrapper gets `min-w-0 flex-1 overflow-hidden`. The chat wrapper gets `w-full lg:w-[420px] lg:max-w-[420px] shrink-0 min-w-0`.

**Contract**: The JSX return block starting at line 589. Only Tailwind class changes on the three wrapper `<div>` elements. No prop or child component changes.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Lint passes: `npx eslint src/components/plan/PlanWorkspace.tsx`
- Build succeeds: `npm run build`

#### Manual Verification:

- At 1440 px viewport: calendar and chat side-by-side, no overlap, no horizontal scroll, chat ≤ 420 px.
- At 1280 px viewport: both panels visible, no overlap.
- At 768 px viewport: panels stacked vertically, calendar on top, chat below.

## Testing Strategy

### Manual Testing Steps:

1. Open the plan page in a browser at 1440 px width — verify side-by-side layout, no scroll.
2. Resize to 1280 px — verify both panels still visible.
3. Resize to 768 px — verify vertical stack.
4. Open day-edit drawer — verify it still works.
5. Send a chat message — verify chat still works.

## Performance Considerations

No performance impact — this is a pure CSS class change with no new components or JS logic.

## References

- `src/components/plan/PlanWorkspace.tsx` — layout root
- `src/components/plan/PlanCalendar.tsx` — inner 7-col grid
- `src/components/plan/PlanChat.tsx` — chat panel

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fix PlanWorkspace layout

#### Automated

- [x] 1.1 TypeScript compiles — 4fbd0c3
- [x] 1.2 Lint passes — 4fbd0c3
- [x] 1.3 Build succeeds — 4fbd0c3

#### Manual

- [x] 1.4 At 1440 px viewport: calendar and chat side-by-side, no overlap, no horizontal scroll, chat ≤ 420 px
- [x] 1.5 At 1280 px viewport: both panels visible, no overlap
- [x] 1.6 At 768 px viewport: panels stacked vertically, calendar on top, chat below
