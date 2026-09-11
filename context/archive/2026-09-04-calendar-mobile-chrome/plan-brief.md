# Icon-only regenerate on mobile and a denser day-edit form — Plan Brief

> Full plan: `context/changes/calendar-mobile-chrome/plan.md`
> Frame brief: `context/changes/calendar-mobile-chrome/frame.md`
> Research: `context/changes/calendar-mobile-chrome/research.md`

## What & Why

> **The actual problem to plan around is**: the generate control’s visible text and the day-edit+log vertical stack on narrow widths — not a new generate API and not always-editing.

On a 390-wide toolbar the purple Generate/Regenerate sentence wraps and crowds Save snapshot; with a unit, stacked Type/Distance/Structure plus always-open log fields push Save down. Icon-only generate below `sm` and a denser edit form with log behind a closed disclosure.

## Starting Point

Generate always renders `generatePlanButtonLabel` as button children (`PlanCalendar.tsx`); no `aria-label`, no `RefreshCw` in `src/`. Day-edit is stacked Type, Distance, Structure (`space-y-2`, panel `p-4`); log km/pace/HR are always visible; Edit sets `editing`. Chrome is locked by `PlanCalendar.test.ts` source-scan (`size="icon"` count === 2 for month chevrons).

## Desired End State

On phone the toolbar is not dominated by a long purple caption; on `sm+` the caption is unchanged (including `Working...`). On 390 the edit form is dense, Save is on screen under Structure, and log fields sit in a short disclosure closed by default. Accessible name stays Generate/Regenerate next 14 days. Edit still opens the form.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Icon-only cutoff | Tailwind `sm` (640px); 390 is the phone width to verify | LOCKED S-12.1 “below the `sm` breakpoint”; complementary to `MOBILE_MAX_WIDTH_QUERY` 639px | Plan |
| Log disclosure | Native `<details>` closed by default (no `open`); short `Log` summary; status line inside | Notes say compact disclosure; `PlanChat` already uses this primitive; no extra island state | Plan |

## Scope

**In scope:** `PlanCalendar.tsx` generate control + `DayPanel` edit/log; `PlanCalendar.test.ts` source-scan updates. Keep `generatePlanButtonLabel` strings in `plan-month.ts`.

**Out of scope:** Save snapshot / Restore / month nav / day cells / chat; Make AI button or LLM; `POST /api/plan`; Save/log/freeze API; always-editing; concatenating class strings; Playwright.

## Architecture / Approach

One React island already owns the calendar. Responsive children + `aria-label` on the existing generate `Button`; CSS grid for Type+Distance; native `<details>` for log; `cn()` for compact field/panel classes. Canned generate stays `onClick={onGenerate}` in `PlanWorkspace`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Mobile generate chrome + compact day-edit | Icon-only generate below `sm`; dense Type+Distance+Structure; closed log disclosure; source-scan lock | Source-scan still expects caption-as-children / `size="icon"` === 2; Make AI merge seam |

**Prerequisites:** none (`Depends on: none`). `workout-stages-make-ai` has not landed — leave the comment slot.
**Estimated effort:** One short session, one phase (XS).

## Open Risks & Assumptions

- Repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate tests; this phase gates touched-file eslint only.
- If `workout-stages-make-ai` lands first, compact layout must keep the Make AI control; this run only leaves a comment slot.

## Success Criteria (Summary)

- Below `sm`: RefreshCw only; idle `aria-label` Generate/Regenerate next 14 days.
- `sm+`: full `generatePlanButtonLabel` text, including `Working...`.
- 390 edit form: Type+Distance one row, Save under Structure, log behind a closed disclosure, Freeze after, Edit still required.
