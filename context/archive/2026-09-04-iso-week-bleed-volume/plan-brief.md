# Show bleed-Monday units and ISO-week volume in coach context — Plan Brief

> Full plan: `context/changes/iso-week-bleed-volume/plan.md`
> Research: `context/changes/iso-week-bleed-volume/research.md`

## What & Why

Bleed Mondays before the 1st already sit in month-grid fetch state but the UI hides them, and first-pass coach context treats rolling today−6…today as load without a Mon–Sun ISO-week breakdown. Bind type+km on those cells, open the same day panel, and inject real `isoWeeks[]` plus prompt text that `weeklyKm` is ISO-week volume.

## Starting Point

`monthGridDates("2026-09-01")[0] === "2026-08-31"`; `loadMonth` fetches that full grid. Cells bind `unit` only when `inMonth`; bleed cells are not buttons; `selectedInMonth` requires the visible month. First-pass has Profile JSON and rolling `currentLoad`; no `isoWeeks[]`. `gateByIsoWeek` already groups by `utcMondayOf`.

## Desired End State

The Monday before the 1st shows km/type (slight fade, clickable). Selecting it opens the same day panel. Empty bleed days have no `Rest` label. When that Monday is out of month, a compact `ISO week includes 31 Aug` caption appears. Every first-pass `complete` gets compact `isoWeeks[]` from stored units/logs for ISO weeks overlapping the create horizon, including previous-month dates in those weeks. The prompt says `weeklyKm` is Mon–Sun ISO; rolling `currentLoad` remains.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Scope option | (a) bleed UI + `isoWeeks[]`; not (b) prompt-only | Locked in Notes | Plan |
| Rolling `currentLoad` | Keep today−6…today beside `isoWeeks[]` | Notes require the model not to treat only that window as “the week”; rolling load is still a distinct last-7-days signal. Replacing it is FU-143 | Unattended |
| ISO grouping | `utcMondayOf` / `weekDates`; do not edit `gateByIsoWeek` | Locked reuse; `groupByMonday` stays private in plan-adaptation | Plan |
| Empty bleed | Non-button; no `Rest` | S-04.2; making them buttons would open the in-month Rest panel copy | Plan |
| Caption placement | Compact `<p>` above weekday headers when `grid[0]` is out of month | Notes want a caption/chip on the week that includes the bleed Monday; load-chart tabs stay above it | Plan |

## Scope

**In scope:** `PlanCalendar.tsx` bleed bind/select/caption; `chat.ts` first-pass `isoWeeks[]`; `openai-chat.ts` `systemPrompt` + `LlmProposeRequest`; tests; optional `isoWeeks` on `ProposeCompleteFn`.

**Out of scope:** generate → `POST /api/plan`; restack load charts; alter `gateByIsoWeek`; option (b); hardcoded date stub; race/Flag on bleed; Make AI / compact day-edit / stages; Playwright; repo-wide lint on untouched files.

## Architecture / Approach

Client already has bleed units; stop dropping them at bind/select. Server loads ISO weeks overlapping `utcCreateHorizon()` with the same Monday helper the volume gate uses, and names that contract in the system prompt while leaving rolling `currentLoad` in place.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Bleed cells + ISO-week first-pass volume | Bleed type+km + panel; ISO caption; `isoWeeks[]` + prompt | Source-scan still expects `inMonth ? (` unit bind and month-only selection |

**Prerequisites:** none (`Depends on: none`). Compact day-edit, Make AI, load-chart tabs, stages, Flag sentinel already on this branch — do not regress.
**Estimated effort:** One short session, one phase (XS).

## Open Risks & Assumptions

- Repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate tests; this phase gates touched-file eslint only.
- Keep-vs-replace `currentLoad` is recorded as FU-143 (`Kind: decision`).

## Success Criteria (Summary)

- Bleed Monday shows type+km, faded, clickable, same day panel; empty bleed has no Rest.
- `ISO week includes <day month>` when the first grid Monday is out of month.
- First-pass `isoWeeks[]` is real Mon–Sun volume including bleed dates; prompt matches; `currentLoad` kept.
