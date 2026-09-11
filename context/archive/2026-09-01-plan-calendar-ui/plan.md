# Compact, readable training week Implementation Plan

## Overview

Make the dashboard training week scannable: human date labels, type color, a single icon action row, a compact mobile list, a UTC-today marker, and no tutorial paragraph. Stay inside `PlanCalendar.tsx` and its colocated unit test.

## Current State Analysis

`src/components/plan/PlanCalendar.tsx` is the week island. The header range and each day card print raw ISO (`2026-08-31`). Workout type is `capitalize` white text. Filled days stack three full-width `size="sm"` Edit / Log / Freeze buttons. A four-line helper sits under “Training week”. The grid is `grid-cols-1` below `sm` and `sm:grid-cols-7`, so ~390px is seven tall cards. There is no today marker.

UTC calendar math already lives in `src/lib/dates.ts` (`weekDates`, `utcToday`). Vitest is Node-only (`src/**/*.test.ts`); `PlanCalendar.test.ts` currently asserts only `formatRevisionLabel`. Log/Unlog/Freeze `aria-label`s already include the ISO date. Edit form Save/Cancel are `flex-1`. Frozen days use `border-purple-300/40`.

## Desired End State

A member looking at the week can read weekday+day+month without decoding ISO, see intensity from a colored type chip, hit Edit/Log/Freeze as a tight icon row, scan seven compact rows on a phone, spot UTC today, and not wade through a tutorial. Empty-state copy and Generate / Week history stay. Chat and dashboard chrome are untouched.

### Key Discoveries:

- Date helpers are UTC ISO strings throughout the plan stack (`weekDates` / `utcToday` in `src/lib/dates.ts`). Visible labels must parse with `Date.UTC`, never local `new Date("2026-08-31")`.
- Vitest cannot mount React (`environment: "node"`, no Testing Library). Label contracts belong on exported formatters in `PlanCalendar.test.ts`; markup contracts are source greps.
- Existing Log/Unlog/Freeze accessible names use the ISO date; LOCKED keeps that. Edit is currently named by visible “Edit” text — icon-only needs `aria-label="Edit"`.
- `cn()` from `@/lib/utils` is required for class merges (`AGENTS.md`). `twMerge` keeps one `border-*` winner when today and frozen both apply.

## What We're NOT Doing

- Dashboard chrome, Topbar, profile tab, SetupForm, or `PlanChat.tsx`.
- Changing Generate / Week history / revision picker behavior or `formatRevisionLabel`.
- API, persistence, validators, or CSS of other islands.
- Playwright / RTL / new test runner. Do not add `@testing-library/react`.
- Restyling the cosmic glass card, moving formatters into `dates.ts`, or translating the UI.

## Implementation Approach

Export two UTC formatters beside `formatRevisionLabel`, assert them in the existing test file, then restyle the calendar markup in the same component: formatted labels, type tones, `size="icon"` actions, responsive row/column layout, UTC-today chrome, delete the helper paragraph.

## Critical Implementation Details

Visible labels are UTC. Split `YYYY-MM-DD`, construct `Date.UTC`, and format with fixed English weekday/month tables (`Mon` / `Aug` / `Sep`) so Node tests are locale-stable. Aria-labels for Log/Unlog/Freeze/Unfreeze keep the ISO `date` string. The week-range separator is an en dash (`–`, U+2013), matching `Mon 31 Aug – Sun 6 Sep`. Below `sm` the card is a row; the edit form is a stacked column — do not leave the form inside the compact row.

## Phase 1: Compact readable week

### Overview

Ship the locked calendar presentation and the formatter tests that pin the date strings.

### Changes Required:

#### 1. Date labels

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Members read weekday and calendar day, not ISO, in the week header and on each day.

**Contract**: Export `formatDayLabel(isoDate: string): string` and `formatWeekRange(weekStart: string): string`. `formatDayLabel("2026-08-31")` is `Mon 31 Aug`; `formatDayLabel("2026-09-06")` is `Sun 6 Sep` (no leading zero on the day). `formatWeekRange` uses `weekDates` and returns `formatDayLabel(monday) + " – " + formatDayLabel(sunday)` with a Unicode en dash. The header `<p>` currently interpolating `{dates[0]} – {dates[6]}` shows `formatWeekRange(weekStart)`. Each day’s visible date line shows `formatDayLabel(date)`, never the raw ISO. Do not change `aria-label={`Log ${date}`}` / Unlog / Freeze / Unfreeze (ISO stays).

#### 2. Type color

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Intensity is visible without reading the type word.

**Contract**: Replacing the white `capitalize` type `<p>`, render a small `size-2 rounded-full` chip plus the type name, both using `cn()`. Tones: `base` slate (`bg-slate-400` / `text-slate-300`), `recovery` green (`bg-emerald-400` / `text-emerald-300`), `tempo` yellow (`bg-yellow-400` / `text-yellow-300`), `threshold` orange (`bg-orange-400` / `text-orange-300`), `anaerobic` red (`bg-red-400` / `text-red-300`), `long` purple (`bg-purple-400` / `text-purple-300`). Edit-form type `<select>` stays uncolored.

#### 3. Icon actions and compact layout

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Actions stop dominating the card; below `sm` the week is a list of one-line days.

**Contract**: Filled-day Edit / Log-or-Unlog / Freeze become one horizontal `flex flex-row` of `size="icon"` `variant="outline"` buttons (pencil, check for Log, `Undo2` for Unlog, snowflake). Keep the same outline chrome as today’s week-nav buttons (`border-white/20 bg-white/10 text-white hover:bg-white/20`) so icons stay visible on the glass card. No visible “Edit” / “Log” / “Unlog” / “Freeze” / “Frozen” text on those three. `aria-label="Edit"` on Edit; keep ISO-date aria-labels on Log/Unlog/Freeze/Unfreeze; keep `aria-pressed` on Freeze. Save/Cancel stay `size="sm"` `flex-1` (not `icon`). Day `<article>`: `flex flex-row items-center gap-2 sm:flex-col sm:items-stretch`. When that day is being edited, force `flex-col` (and `w-full` on the form) so stacked fields and Save/Cancel remain usable below `sm`. Grid remains `grid grid-cols-1 gap-2 sm:grid-cols-7`. Below `sm`, the row is weekday-date, type, km, icons inline; hide `unit.structure` and the “Logged … km” line below `sm` (`hidden sm:block`) so the row stays one line. Empty days stay a row with formatted date + “Empty” and no action icons. Merge all classes with `cn()`.

#### 4. Today marker and helper copy

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: UTC today is obvious; the tutorial paragraph is gone.

**Contract**: Import `utcToday`. When `date === utcToday()`, add `TODAY` immediately after the formatted date (small caps-friendly label, e.g. `text-[10px] font-semibold tracking-wide text-white`) and `border-white/60` on the article. Apply today border after the frozen class so `twMerge` keeps the light border when both apply; frozen remains visible via the snowflake `aria-pressed`. Delete the instructional `<p>` that starts “Generate a week from your saved weekly km”. Keep “No plan for this week yet. Generate to fill the calendar.” Do not restyle Generate / Week history.

#### 5. Formatter unit tests

**File**: `src/components/plan/PlanCalendar.test.ts`

**Intent**: Date-label regressions fail in `npm test` without mounting React.

**Contract**: Keep the existing `formatRevisionLabel` example. Import `formatDayLabel` and `formatWeekRange`. Assert `formatDayLabel("2026-08-31") === "Mon 31 Aug"`, `formatDayLabel("2026-09-06") === "Sun 6 Sep"`, and `formatWeekRange("2026-08-31") === "Mon 31 Aug – Sun 6 Sep"` (en dash). Do not add a `.test.tsx` or change `vitest.config.ts`.

#### 6. Follow-ups opened while planning

**File**: `context/backlog.md`

**Intent**: Unattended layout/icon choices are on disk, not only in the transcript.

**Contract**: Keep FU-035 (unlog glyph; was FU-032 in this run), FU-033 (today vs frozen border), FU-034 (hide structure/logged below `sm`) as Status: open under `## Open`. Do not close unrelated FU/DEP items. Include this file in the phase commit.

### Success Criteria:

#### Automated Verification:

- `formatDayLabel("2026-08-31")` is `Mon 31 Aug`, `formatDayLabel("2026-09-06")` is `Sun 6 Sep`, and `formatWeekRange("2026-08-31")` is `Mon 31 Aug – Sun 6 Sep` (en dash) in `src/components/plan/PlanCalendar.test.ts`
- `src/components/plan/PlanCalendar.tsx` header range uses `formatWeekRange` (no `{dates[0]}` / `{dates[6]}` in the visible header `<p>`); day cards use `formatDayLabel(date)` for visible dates; Log/Unlog/Freeze/Unfreeze `aria-label`s still include the ISO `date`
- Filled-day Edit/Log/Unlog/Freeze buttons use `size="icon"`; Save and Cancel do not; Save/Cancel still include `flex-1`
- Type tones include `bg-slate-400`, `bg-emerald-400`, `bg-yellow-400`, `bg-orange-400`, `bg-red-400`, and `bg-purple-400` plus a `size-2 rounded-full` chip
- Grid still has `sm:grid-cols-7`; articles use `flex-row` and `sm:flex-col`; instructional copy `Generate a week from your saved weekly km` is absent; empty-state `No plan for this week yet` remains
- UTC today uses `utcToday` and visible `TODAY`; today border class is `border-white/60`
- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

#### Manual Verification:

- At ~390px width, each day is one compact row (weekday/date, type, km, icons inline), not a tall stacked card
- From `sm` and up, the week is seven columns; actions are a horizontal icon row, not three full-width labeled buttons
- The UTC-today card shows `TODAY` and a stronger light border; the tutorial paragraph under “Training week” is gone; empty-state still appears when the week has no units

---

## Testing Strategy

### Unit Tests:

- `formatDayLabel` / `formatWeekRange` on the LOCKED example week (Mon 31 Aug → Sun 6 Sep) and a single-digit day (`6 Sep`).
- Existing `formatRevisionLabel` case unchanged.

### Integration Tests:

- None. No API or persist change.

### Manual Testing Steps:

1. Open `/dashboard` signed in, generate a week if empty.
2. Confirm header `Mon D Mon – Sun D Mon` style (not ISO) and type chips.
3. Narrow to ~390px: list of compact rows; widen: 7-column grid.
4. Confirm today’s card (UTC) and that the helper paragraph is gone.

## Performance Considerations

Seven day cards; no extra islands or network. Icon buttons reduce DOM text only.

## Migration Notes

None. Presentation-only; no schema.

## References

- `context/changes/plan-calendar-ui/change.md` — LOCKED Notes
- `src/components/plan/PlanCalendar.tsx`
- `src/components/plan/PlanCalendar.test.ts`
- `src/lib/dates.ts` — `weekDates`, `utcToday`
- `src/components/ui/button.tsx` — `size="icon"`
- `AGENTS.md` — `cn()`, React islands, no `"use client"`
- `context/foundation/test-plan.md` §6.1 — colocated `*.test.ts`, Node Vitest

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Compact readable week

#### Automated

- [x] 1.1 `formatDayLabel("2026-08-31")` is `Mon 31 Aug`, `formatDayLabel("2026-09-06")` is `Sun 6 Sep`, and `formatWeekRange("2026-08-31")` is `Mon 31 Aug – Sun 6 Sep` (en dash) in `src/components/plan/PlanCalendar.test.ts` — 78a705e
- [x] 1.2 `src/components/plan/PlanCalendar.tsx` header range uses `formatWeekRange` (no `{dates[0]}` / `{dates[6]}` in the visible header `<p>`); day cards use `formatDayLabel(date)` for visible dates; Log/Unlog/Freeze/Unfreeze `aria-label`s still include the ISO `date` — 78a705e
- [x] 1.3 Filled-day Edit/Log/Unlog/Freeze buttons use `size="icon"`; Save and Cancel do not; Save/Cancel still include `flex-1` — 78a705e
- [x] 1.4 Type tones include `bg-slate-400`, `bg-emerald-400`, `bg-yellow-400`, `bg-orange-400`, `bg-red-400`, and `bg-purple-400` plus a `size-2 rounded-full` chip — 78a705e
- [x] 1.5 Grid still has `sm:grid-cols-7`; articles use `flex-row` and `sm:flex-col`; instructional copy `Generate a week from your saved weekly km` is absent; empty-state `No plan for this week yet` remains — 78a705e
- [x] 1.6 UTC today uses `utcToday` and visible `TODAY`; today border class is `border-white/60` — 78a705e
- [x] 1.7 `npm test` exits 0 — 78a705e
- [x] 1.8 `npm run lint` exits 0 — 78a705e
- [x] 1.9 `npm run build` exits 0 — 78a705e

#### Manual

- [x] 1.10 At ~390px width, each day is one compact row (weekday/date, type, km, icons inline), not a tall stacked card
- [x] 1.11 From `sm` and up, the week is seven columns; actions are a horizontal icon row, not three full-width labeled buttons
- [x] 1.12 The UTC-today card shows `TODAY` and a stronger light border; the tutorial paragraph under “Training week” is gone; empty-state still appears when the week has no units
