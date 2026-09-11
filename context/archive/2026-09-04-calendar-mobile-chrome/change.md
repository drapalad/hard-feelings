---
change_id: calendar-mobile-chrome
title: Icon-only regenerate on mobile and a denser day-edit form
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:21Z
---

## Notes

Files: `src/components/plan/PlanCalendar.tsx` (generate control + `DayPanel` edit form + Log block). Keep labels in `generatePlanButtonLabel` (`src/components/plan/plan-month.ts`). Source-scan in `PlanCalendar.test.ts` if chrome assertions mention the button. Merge classes with `cn()` from `@/lib/utils`.
Depends on: none.

### Sequencing

Not in parallel with `chat-delete-units`, `iso-week-bleed-volume`, `workout-stages-make-ai`, `load-chart-tabs` (`PlanCalendar.tsx`). S-13.5 leaves a comment slot for Make AI and does not add the button here — `workout-stages-make-ai` owns Make AI and structured stages. If this change lands first, keep the slot; if `workout-stages-make-ai` lands first, compact layout must keep the **Make AI** control.

### Option

tak — icon-only regenerate below `sm`; Type+Distance on one row; Log in a closed disclosure.

### Today

The purple generate control always renders the full string from `generatePlanButtonLabel` (`Generate next 14 days` / `Regenerate next 14 days` / `Working...`). On a 390-wide toolbar that label wraps onto its own row and crowds Save snapshot. With a unit, Edit opens a stacked Type, Distance (km), Structure form (`space-y-2`, panel `p-4`), then Save / Cancel, then always-visible Log km, Pace, HR, Save log, and Freeze. On 390 that stack pushes Save down and the log fields fill the first screen of the panel.

### Requirements

- [ ] S-12.1 Below the `sm` breakpoint, show an icon-only refresh control (`RefreshCw` from lucide-react). Do not show the long Generate/Regenerate sentence.
- [ ] S-12.2 From `sm` upward, show the full visible text from `generatePlanButtonLabel`, including `Working...` while busy. Desktop 1280 must still read the phrase, not icon-only.
- [ ] S-12.3 Accessible name stays `Generate next 14 days` or `Regenerate next 14 days` via `aria-label` from the idle `generatePlanButtonLabel` phrases (never a shortened label, never `Working...`).
- [ ] S-12.4 Keep existing `onClick` / canned 14-day coach prompt. Do not retarget to `POST /api/plan`.
- [ ] S-13.1 Put Type and Distance (km) on one row (two columns). Keep labels and the same controls (type `<select>`, distance number).
- [ ] S-13.2 Keep Structure full-width under that row, with compact field chrome (tighter label-to-input gap and input padding than today).
- [ ] S-13.3 Tighten the day panel and edit form vertical rhythm (`space-y` / padding) so Save sits directly under Structure without a tall empty stack.
- [ ] S-13.4 Move Log km / pace / HR (and Save log / Unlog) into a compact disclosure below Save, closed by default, so the log block does not consume the first screen of the panel. Freeze stays after the log control.
- [ ] S-13.5 Leave a one-line source comment slot for a Make AI control beside Structure. Do not add the button or call an LLM.
- [ ] S-13.6 Keep Edit to enter the form in production. Do not ship “always editing” as product behavior.

### Do not

Change Save snapshot, Restore, month nav, day cells, or chat. Implement Make AI or structured stages in this change; change Save / log / freeze API; concatenate Tailwind class strings (use `cn()`).

### Visible

On phone the toolbar is not dominated by a long purple caption; on `sm+` the caption is unchanged. On 390 the edit form is dense, Save is on screen without scrolling past a tall Type/Distance/Structure/Log stack, and log fields are behind a short disclosure.
