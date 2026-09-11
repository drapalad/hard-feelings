# Show bleed-Monday units and ISO-week volume in coach context — Implementation Plan

## Overview

Month-grid bleed cells already load units (`loadMonth` from first Monday) but drop them in the UI, and first-pass coach context names `weeklyKm` plus a rolling 7-day `currentLoad` (today−6…today) instead of Mon–Sun ISO weeks. This change binds type+km on bleed cells (clickable, same day panel), captions the bleed ISO week, and injects real `isoWeeks[]` on every first-pass completion.

## What We're NOT Doing

- Option (b) prompt-only reminder — no `isoWeeks[]`, no bleed UI
- Changing generate to `POST /api/plan`
- Restacking load charts (`LoadChartTabs`, `km per week` / `daily load (decay 0.85)`)
- Altering `gateByIsoWeek` grouping in `src/lib/services/plan-adaptation.ts` (reuse `utcMondayOf`; do not reimplement)
- Hardcoded date stubs for `isoWeeks`
- Binding races/Flag on bleed cells (in-month Flag sentinel stays)
- Moving Make AI, compact day-edit, or `training_units.stages`
- Concatenating Tailwind class strings (use `cn()` from `@/lib/utils`)
- Playwright / e2e (test-plan §6.3 / §7 visual snapshots)
- Repo-wide lint fixes on untouched training-load / pace-estimate files

## Phase 1: Bleed cells + ISO-week first-pass volume

### Overview

One pass: render and select bleed-Monday units in `PlanCalendar`; load compact `isoWeeks[]` from stored units/logs on first-pass `complete`; prompt that `weeklyKm` is Mon–Sun ISO-week volume. Keep rolling `currentLoad`.

### Changes Required:

#### 1. Bleed cells bind, fade, and open the day panel (S-04.1, S-04.2, S-04.3)

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Out-of-month grid days that already have a unit in client state must show type+km, stay slightly faded but readable, and open the same `DayPanel` as an in-month day. Empty bleed days stay non-buttons and must not show the in-month `Rest` label. When the grid’s first Monday is outside the visible month, show a compact caption `ISO week includes <day month>` (e.g. `ISO week includes 31 Aug`).

**Contract**: Look up `unit` from `byDate` for every grid date, not only `inMonth`. Wrap `(inMonth || unit)` in the existing day `<button>` (`aria-pressed`, toggle `selectedDate`). Leave empty bleed as non-button `DaySummary` with `unit={undefined}` so `inMonth && race === undefined` still gates `Rest`. Open `DayPanel` for a selected bleed date that has a unit — stop requiring `utcMonthStart(selectedDate) === utcMonthStart(visibleMonth)`. Keep race/Flag lookup in-month only. Keep existing bleed fade (`opacity-40`); if type+km fail contrast, raise via `cn()` (e.g. `opacity-60`) without dropping fade. Caption: when `grid[0]` is out of month, a compact `<p>` above the seven-column weekday headers (after `LoadChartTabs`), copy `ISO week includes ${day} ${shortMonth}` with no leading zero on day (reuse `MONTHS`). Merge classes with `cn()`. Do not restack load charts, do not move Make AI / compact day-edit / stages.

#### 2. First-pass `isoWeeks[]` from stored units and logs (S-04.4, S-04.6)

**File**: `src/lib/services/chat.ts` (first-pass payload / `loadCurrentLoad`)

**Intent**: Every first-pass `complete` sees compact ISO-week volume for weeks that overlap the create horizon, including previous-month dates in those weeks. Rolling `currentLoad` stays.

**Contract**: Next to `loadCurrentLoad`, load `{ monday, plannedKm, loggedKm, dates[] }[]` for each ISO week whose Monday is `utcMondayOf(createFrom)` through `utcMondayOf(createTo)` (same Monday grouping as `gateByIsoWeek`; do not edit `plan-adaptation.ts`). `dates[]` is `weekDates(monday)` (all seven UTC days — do not omit bleed Mondays). `plannedKm` / `loggedKm` are 1-decimal sums from `listRange` / `listLogsRange` over first Monday through last Sunday of that span. Pass `isoWeeks` on the first-pass request (and the follow-up `complete` spread). Keep `loadCurrentLoad` (today−6…today) unchanged. Real stored rows only — no hardcoded date stub. Extend `ProposeCompleteFn` in `src/lib/services/propose-adaptation.ts` with optional `isoWeeks` so the extra field type-checks.

#### 3. Prompt: weeklyKm is Mon–Sun ISO (S-04.5)

**File**: `src/lib/services/openai-chat.ts` (`systemPrompt`, `LlmProposeRequest`)

**Intent**: The model must not treat rolling `currentLoad` as “the week” or plan a month-grid week that drops the bleed Monday.

**Contract**: Add optional `isoWeeks` on `LlmProposeRequest`. Beside `weeklyKm: ${request.weeklyKm}`, state that `weeklyKm` is Mon–Sun ISO-week volume and not to plan a month-grid week that drops the bleed Monday. When `isoWeeks` is present, append compact JSON (same shape as chat). Keep `Current load summary JSON` when `currentLoad` is present. Do not ship option (b) prompt-only (no `isoWeeks` payload).

#### 4. Tests

**Files**: `src/components/plan/PlanCalendar.test.ts`, `src/lib/services/chat.test.ts`, `src/lib/services/openai-chat.test.ts`

**Intent**: Lock bleed chrome, real `isoWeeks` from seeded units/logs, and prompt wording. Calendar chrome stays source-scan (test-plan §6.1).

**Contract**: Update PlanCalendar source-scan: bleed cells bind `byDate.get(date)` without an `inMonth` guard; day button when `inMonth || unit`; panel selection not month-only; `ISO week includes`; keep Rest gated on `inMonth`; keep Flag in-month; keep `LoadChartTabs` / Make AI / compact day-edit / `onClick={onGenerate}` locks; no hardcoded `2026-` stub. chat.test: on first-pass `complete`, `isoWeeks` includes `utcMondayOf(createFrom)` with `dates[]` containing that Monday even when it is before `createFrom`, and `plannedKm`/`loggedKm` match seeded rows; `currentLoad` still present. openai-chat.test: system prompt contains Mon–Sun ISO `weeklyKm` wording, `isoWeeks` JSON when provided, and still `Current load summary JSON`. Cookbook: test-plan §6.1; no Playwright (§6.3).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/plan/PlanCalendar.test.ts src/lib/services/chat.test.ts src/lib/services/openai-chat.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts src/lib/services/chat.ts src/lib/services/chat.test.ts src/lib/services/openai-chat.ts src/lib/services/openai-chat.test.ts src/lib/services/propose-adaptation.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate files; do not edit those files)
- `npx astro check` passes
- Source-scan / first-pass tests lock bleed unit bind + select, no Rest on empty bleed, `ISO week includes` caption, real `isoWeeks[]` from stored units/logs (bleed Monday in `dates[]`), prompt Mon–Sun ISO `weeklyKm`, rolling `currentLoad` kept

#### Manual Verification:

- Month whose first Monday is the previous month (e.g. September 2026 / 31 Aug): that bleed cell shows type+km, slight fade, clickable; opening it shows the same day panel as an in-month unit day; empty bleed cells have no `Rest` label
- That month shows a compact `ISO week includes 31 Aug` (or the matching bleed Monday) above the weekday headers

## Testing Strategy

### Unit Tests:

- PlanCalendar source-scan as in Phase 1.4. Deliberate-break: restore `unit = inMonth ? byDate.get(date) : undefined` and month-only `selectedInMonth`, or drop the ISO-week caption, and confirm the scan goes red.
- chat.test first-pass capture: seed a unit/log on `utcMondayOf(utcToday())` when that Monday is before `createFrom`; invert by omitting that date from `isoWeeks[].dates` and confirm the assertion goes red.
- openai-chat.test prompt: ISO-week `weeklyKm` sentence + `isoWeeks` JSON; invert by dropping the sentence.

## References

- Locked spec: `context/changes/iso-week-bleed-volume/change.md`
- Research: `context/changes/iso-week-bleed-volume/research.md`
- Dates: `src/lib/dates.ts` (`monthGridDates`, `utcMondayOf`, `weekDates`)
- ISO grouping to reuse: `src/lib/services/plan-adaptation.ts` `gateByIsoWeek` / `groupByMonday` (`utcMondayOf`)
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Bleed cells + ISO-week first-pass volume

#### Automated

- [x] 1.1 `npm test -- src/components/plan/PlanCalendar.test.ts src/lib/services/chat.test.ts src/lib/services/openai-chat.test.ts` passes — 053a988
- [x] 1.2 `npm test` passes — 053a988
- [x] 1.3 Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts src/lib/services/chat.ts src/lib/services/chat.test.ts src/lib/services/openai-chat.ts src/lib/services/openai-chat.test.ts src/lib/services/propose-adaptation.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate files; do not edit those files) — 053a988
- [x] 1.4 `npx astro check` passes — 053a988
- [x] 1.5 Source-scan / first-pass tests lock bleed unit bind + select, no Rest on empty bleed, `ISO week includes` caption, real `isoWeeks[]` from stored units/logs (bleed Monday in `dates[]`), prompt Mon–Sun ISO `weeklyKm`, rolling `currentLoad` kept — 053a988

#### Manual

- [ ] 1.6 Month whose first Monday is the previous month (e.g. September 2026 / 31 Aug): that bleed cell shows type+km, slight fade, clickable; opening it shows the same day panel as an in-month unit day; empty bleed cells have no `Rest` label
- [ ] 1.7 That month shows a compact `ISO week includes 31 Aug` (or the matching bleed Monday) above the weekday headers
