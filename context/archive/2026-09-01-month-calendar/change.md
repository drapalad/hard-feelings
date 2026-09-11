---
change_id: month-calendar
title: Show the training plan as a month grid with Today and regenerate
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:12Z
---

## Notes

LOCKED. Files: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`. Date helpers may be added to `src/lib/dates.ts` (`weekDates`, `utcMondayOf`, `utcToday`, `addUtcDays` already exist). GET `/api/plan?weekStart=` and/or a date-range variant of the same handler; `listWeek` in `src/lib/services/plan.ts` if a range query is cleaner than repeating week fetches. No new table, column, or RLS.

### Today

The Week tab shows seven fat day cards (Mon–Sun). Prev/next jumps ±7 days. `GET /api/plan?weekStart=` returns one week. Each planned day has three always-visible icon buttons (Edit / Log|Unlog / Freeze). Days without a unit say “Empty”. The purple button always says “Generate plan”. On large screens `PlanWorkspace` is `lg:grid-cols-2` (calendar and chat equal width). Chat, generate POST, restore, and freeze/edit/log APIs stay week-scoped.

### Do

1. **Month grid (Monday start, same as `weekDates`).** Header is month + year (e.g. September 2026). Prev/next change the visible **month** (first of previous/next month), then set `weekStart` to `utcMondayOf` that date. When the visible month is the month that contains `utcToday()`, `weekStart` is `utcMondayOf(utcToday())` so generate/chat stay on the current week.

2. **Cells:** day number, existing type color chip + type, km. Days outside the month: muted, no workout. In-month day with no unit: muted **Rest** (not “Empty”). Today (UTC date): keep the stronger border and TODAY label.

3. **Load the visible month from the API.** Repeat `GET /api/plan?weekStart=` for each Monday covering the grid, or add a from/to range on the existing plan GET. Merge units (and logs if the GET already returns them) into calendar state. **Do not ship hardcoded fixture workouts.** A UX mock used fixtures; this change must persist/read real rows.

4. **Today control** next to the month chevrons. Click: visible month = month of `utcToday()`; `weekStart` = `utcMondayOf(utcToday())`. Disabled + `aria-current="date"` when that month is already visible — not when “this week” happens to match.

5. **Generate label** is about the **active week** (`weekDates(weekStart)`), not the whole month: if that week has any units → **Regenerate week**; if none → **Generate plan**; busy still **Working...**. Same `onGenerate` / POST `{ weekStart }`. No confirm dialog. Restore dropdown and generate POST stay week-scoped.

6. **Width:** `PlanWorkspace` root `lg:grid-cols-5`; wrap calendar in `lg:col-span-3`, chat in `lg:col-span-2`. Keep `grid-cols-1 gap-10` on small screens.

### Do not

- Put Edit, Log, Unlog, Freeze, overflow `⋯`, or an inline “actual km” log form **in month cells**. Day actions are a later change (click-cell panel). Do not reintroduce the three `size-9` buttons on a seven-column week strip.
- Truncate type labels with ellipsis as a required visual (that was a week-column hack). Types may sit small in the cell.
- Change `PlanChat` copy, bubble alignment, height, Enter-to-send, or Accept/Reject.
- Confirm-before-regenerate. Do not regenerate every week in the month from this button.
- Wordmark / remove topbar email. Race list date format. Dashboard tabs URL. Signup/landing chrome.
- Supabase migrations. Leave RLS as-is.

### Visible

Dashboard Week is a real calendar month (5–6 rows), not seven oversized cards. Today jumps back to the current month. Rest days read Rest. A week that already has a plan shows **Regenerate week**. Calendar is wider than chat on desktop. Generate/chat still apply to the active week. Opening a day does not show action icons in the cell.
