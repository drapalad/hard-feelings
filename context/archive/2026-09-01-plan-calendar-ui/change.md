---
change_id: plan-calendar-ui
title: Compact, readable training week
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

File: `src/components/plan/PlanCalendar.tsx` (and its unit test if labels are asserted). Do not restyle dashboard chrome or chat.

Today each day card shows ISO dates (`2026-08-31`), all-white type names, and three stacked full-width Edit / Log / Freeze buttons. A four-line tutorial sits under “Training week”. On ~390px the week is seven tall cards. No “today” marker.

Do:
- Day label and week-range header: `Mon 31 Aug` / `Mon 31 Aug – Sun 6 Sep`, not ISO.
- One horizontal `size="icon"` row (pencil, check/unlog, snowflake); keep aria-labels including date for Log/Unlog/Freeze/Unfreeze. Edit form Save/Cancel stay full width.
- Type: small color chip + tinted name — base slate, recovery green, tempo yellow, threshold orange, anaerobic red, long purple.
- Below `sm`: one compact row per day (weekday, type, km, icons inline). From `sm`: keep `grid-cols-7`.
- Delete the instructional paragraph under the heading; keep empty-state “No plan for this week yet…”.
- UTC-today card: stronger light border + `TODAY` next to the date.
