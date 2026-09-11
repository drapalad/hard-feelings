---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "calendar-mobile-chrome: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: calendar-mobile-chrome

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- Generate control always renders the full `generatePlanButtonLabel(busy, hasHorizonUnit)` string as button children (`src/components/plan/PlanCalendar.tsx:551-557`). Phrases: Working… / Regenerate next 14 days / Generate next 14 days (`src/components/plan/plan-month.ts:14-18`). No `aria-label` on that button. No `RefreshCw` import anywhere under `src/`.
- Day-edit form is stacked Type, Distance, Structure (`space-y-2`, labels `block` + `mt-1`) (`PlanCalendar.tsx:283-331`). Panel chrome `space-y-3` + `p-4` (`:265`). Log km / pace / HR / Save log / Unlog are always visible under the form (`:371-437`). Freeze follows (`:439-450`).
- Edit is a button that sets `editing` true (`:357-368`). Production is not always-editing.
- `PlanCalendar.test.ts` source-scans generate labels, `onClick={onGenerate}`, Structure, Save log, Freeze, `size="icon"` count === 2 (month chevrons) (`:39-75`, `:135-144`).
- `cn()` already used in PlanCalendar (`fieldClass` + `cn(` on cells).

## Code References

- `src/components/plan/plan-month.ts:14-18` - generatePlanButtonLabel
- `src/components/plan/plan-month.ts:21-26` - generateHorizonPrompt (canned 14-day copy)
- `src/components/plan/PlanCalendar.tsx:8` - generatePlanButtonLabel import
- `src/components/plan/PlanCalendar.tsx:265` - panel padding
- `src/components/plan/PlanCalendar.tsx:283-331` - stacked Type / Distance / Structure
- `src/components/plan/PlanCalendar.tsx:351-368` - Edit to enter form
- `src/components/plan/PlanCalendar.tsx:371-450` - Log block + Freeze
- `src/components/plan/PlanCalendar.tsx:551-557` - generate button children
- `src/components/plan/PlanCalendar.test.ts:39-75` - chrome source-scan
- `src/components/plan/PlanCalendar.test.ts:135-144` - Edit / log / Freeze / icon count
- `src/components/plan/plan-month.test.ts:38-43` - label strings

## Architecture Insights

The generate button has no accessible name distinct from visible text; hiding the sentence below `sm` requires `aria-label` from the idle phrases (not `Working...`). Log fields are siblings of the edit form, not a disclosure. `workout-stages-make-ai` will add Make AI beside Structure; this change’s comment slot is the merge seam.

## Open Questions

- `sm` in this file vs Tailwind default 640px vs `MOBILE_MAX_WIDTH_QUERY` 639px (`dashboard-tabs.ts:11`) — not compared for the generate breakpoint.
- Source-scan tests will fail if visible `generatePlanButtonLabel(` as children is wrapped in `sm:inline` / icon-only branch; tests must be updated in this change.
- No migration. Quality-gates named-file lock not opened.
- Merge with `workout-stages-make-ai` / `chat-delete-units` / `iso-week-bleed-volume` / `load-chart-tabs` on `PlanCalendar.tsx`.
