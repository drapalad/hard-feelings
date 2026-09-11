# Frame Brief: Icon-only regenerate on mobile and a denser day-edit form

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Accepted Notes (Gate 1, P-12 + P-13): the purple generate control always shows the full `generatePlanButtonLabel` sentence (`Generate next 14 days` / `Regenerate next 14 days` / `Working...`). On a 390-wide toolbar that label wraps and crowds Save snapshot. With a unit, Edit opens stacked Type, Distance, Structure (`space-y-2`, panel `p-4`), then always-visible Log km / Pace / HR, then Freeze. On 390 that stack pushes Save down.

## Initial Framing (preserved)

- **User's stated cause or approach**: Visible generate copy is too long below `sm`; day-edit vertical stack plus always-open log is too tall on 390.
- **User's proposed direction**: Icon-only `RefreshCw` below `sm` with idle `aria-label`; Type+Distance one row; tighter Structure; Log in a closed disclosure; comment slot for Make AI; keep Edit-to-enter; `cn()`.
- **Pre-dispatch narrowing**: Wave-audit bundle. Not separated in a live interview.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Generate control visible text vs accessible name** — children are the full phrase; no `aria-label`; no RefreshCw in repo. ← initial framing (P-12)
2. **Day-edit layout** — stacked labels vs two-column Type+Distance; log not in a disclosure. ← initial framing (P-13)
3. **Toolbar flex wrap** — `flex-wrap` + `md:flex-nowrap` (`PlanCalendar.tsx:514`) also affects crowding independently of the sentence length.
4. **Always-editing** — Notes forbid shipping always-editing; HEAD already requires Edit (`:357-368`).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Generate button children = full label always | `PlanCalendar.tsx:551-557`, `plan-month.ts:14-18` | STRONG |
| RefreshCw unused | no matches under `src/` | STRONG |
| Type/Distance/Structure stacked | `PlanCalendar.tsx:290-331` | STRONG |
| Log always visible | `PlanCalendar.tsx:371-437` | STRONG |
| Source-scan tests lock current chrome | `PlanCalendar.test.ts:39-75`, `:135-144` (`size="icon"` count === 2) | STRONG |
| Wrap/nowrap also crowds toolbar | `PlanCalendar.tsx:514` `flex-wrap` / `md:flex-nowrap` | WEAK (present, not the accepted fix) |

## Narrowing Signals

- Accessible name must stay the idle generate/regenerate phrases, never `Working...` (S-12.3).
- Make AI button is owned by `workout-stages-make-ai`; this change leaves a comment slot only (S-13.5).

## Cross-System Convention

Calendar chrome is enforced by Vitest source-scan of `PlanCalendar.tsx`, not Playwright. Changing visible children / adding a third `size="icon"` (RefreshCw) will fail those tests unless updated in this change.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the generate control’s visible text and the day-edit+log vertical stack on narrow widths — not a new generate API and not always-editing.

The initial framing holds. Plan should treat `PlanCalendar.test.ts` / `plan-month.test.ts` as part of the slice. Do not retarget generate to `POST /api/plan`. Confidence MEDIUM because P-12 and P-13 share one file with four other wave ids, and the `sm` breakpoint vs 390 is not measured in-browser in this audit.

## Confidence

- **MEDIUM** — evidence points one way but convention or signal weaker

Bundle of two P-NN; shared `PlanCalendar.tsx`; breakpoint not verified on a device.

## What Changes for /10x-plan

Plan CSS/layout + aria-label + disclosure in `PlanCalendar.tsx` (and source-scan tests). Keep `generatePlanButtonLabel` strings. Leave Make AI to the other change. One verification question: confirm `sm` (640) is the intended cutoff for icon-only vs 390 screenshots.

## References

- Source files: `src/components/plan/PlanCalendar.tsx:265-557`, `src/components/plan/plan-month.ts:14-18`, `src/components/plan/PlanCalendar.test.ts:39-144`
- Related research: `context/changes/calendar-mobile-chrome/research.md`
- Investigation tasks: wave-audit HEAD read (calendar surface)
