---
change_id: iso-week-bleed-volume
title: Show bleed-Monday units and ISO-week volume in coach context
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:23Z
---

## Notes

Files: `src/components/plan/PlanCalendar.tsx`, `src/lib/services/openai-chat.ts` (`systemPrompt`), `src/lib/services/chat.ts` (first-pass payload / `loadCurrentLoad`). `gateByIsoWeek` in `src/lib/services/plan-adaptation.ts` already groups by Monday — reuse, do not reimplement.
Depends on: none.

### Sequencing

Not in parallel with `chat-delete-units`, `workout-stages-make-ai`, `calendar-mobile-chrome`, `load-chart-tabs` (`PlanCalendar.tsx`). Not in parallel with `user-coach-notes`, `admin-coach-notes`, `coach-races-context-accept` (`openai-chat.ts`).

### Option

(a) Bleed cells show and select units; first-pass compact `isoWeeks[]`; prompt: weeklyKm is Mon–Sun ISO.
Do not ship (b) prompt-only reminder.

### Today

Month cells set `unit` only when `inMonth`. `loadMonth` already fetches the full grid (`from` = first Monday). First-pass prompt has horizon, Profile JSON, and rolling 7-day `currentLoad` (today−6…today), not Mon–Sun ISO weeks and not a units list. Units arrive only after `dataRequest {from,to}`.

### Requirements

- [ ] S-04.1 Bind and render a unit (type + km) on out-of-month bleed cells when one exists. Keep a slight fade; content must stay readable and the cell clickable.
- [ ] S-04.2 Selecting a bleed day that has a unit opens the same day panel as an in-month day. Empty bleed days must not show the in-month “Rest” label.
- [ ] S-04.3 When the month grid’s first Monday is outside the visible month, show a compact caption/chip `ISO week includes <day month>` (e.g. `ISO week includes 31 Aug`).
- [ ] S-04.4 On every first-pass completion, inject compact `isoWeeks[]` `{monday, plannedKm, loggedKm, dates[]}` for ISO weeks that overlap the create horizon (planned + logged, Mon–Sun). Do not omit previous-month dates that fall in those weeks.
- [ ] S-04.5 Prompt text: `weeklyKm` is Mon–Sun ISO-week volume; do not plan a month-grid week that drops the bleed Monday. Keep rolling `currentLoad` or replace it — say so in the PR; do not leave the model with only today−6…today as “the week”.
- [ ] S-04.6 Decision-pack calendar was a UI mock (live 31 Aug unit un-hidden; no first-pass JSON). Implement real `isoWeeks` from stored units/logs — do not ship a hardcoded date stub. Option (a) is bleed UI + `isoWeeks`. Do not ship (b) prompt-only unless chosen.

### Do not

Change generate to `POST /api/plan`; restack load charts; alter `gateByIsoWeek` grouping.

### Visible

Monday before the 1st shows km/type; first-pass sees ISO week volume including that Monday.
