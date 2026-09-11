# Compact, readable training week — Plan Brief

> Full plan: `context/changes/plan-calendar-ui/plan.md`

## What & Why

The training week is hard to scan: ISO dates, all-white type names, three stacked full-width buttons, a tutorial paragraph, seven tall mobile cards, and no today marker. This change makes the week readable on desktop and phone without touching chat or dashboard chrome.

## Starting Point

`PlanCalendar.tsx` already has freeze / edit / log, week nav, generate, and history restore. `weekDates` / `utcToday` are UTC ISO. Vitest is Node-only; the colocated test only covers `formatRevisionLabel`.

## Desired End State

Header and day labels look like `Mon 31 Aug` / `Mon 31 Aug – Sun 6 Sep`. Types have a color chip. Actions are a horizontal icon row. Below `sm`, one compact row per day; from `sm`, `grid-cols-7`. UTC today has `TODAY` plus a stronger light border. The tutorial paragraph is gone; the empty-state line stays.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Files | `PlanCalendar.tsx` + `PlanCalendar.test.ts` only | LOCKED; do not restyle chrome or chat | Plan |
| Visible dates | `Mon 31 Aug` / en-dash week range; UTC parse | LOCKED example; plan dates are UTC ISO | Plan |
| Formatter implementation | Fixed English weekday/month tables + `Date.UTC` | Locale-stable in Node Vitest; same as `dates.ts` UTC rules | Unattended |
| Type color | Chip + tinted name: slate / green / yellow / orange / red / purple | LOCKED tones mapped to Tailwind `slate/emerald/yellow/orange/red/purple` | Plan |
| Actions | `size="icon"` row with existing outline chrome; Save/Cancel stay full width; ISO aria-labels on Log/Unlog/Freeze/Unfreeze; Edit `aria-label="Edit"`; edit form forces `flex-col` | LOCKED; icon-only Edit needs a name; compact row would crush the form | Plan |
| Unlog glyph | Lucide `Undo2` (Log stays `Check`) | Icon-only unlog needs a distinct glyph from check | Unattended |
| Layout | `flex-row` below `sm`, `sm:flex-col` + existing `sm:grid-cols-7` | LOCKED compact list vs seven columns | Plan |
| Structure / logged on xs | Hide below `sm` (`hidden sm:block`) | Keeps the locked one-line mobile row | Unattended |
| Today | `date === utcToday()`; `TODAY` + `border-white/60` last so it wins over frozen purple | LOCKED UTC-today; one `border-*` via `cn()`/`twMerge` | Unattended |
| Helper copy | Delete the four-line tutorial; keep empty-state | LOCKED | Plan |
| Tests | Export formatters; assert in existing `.test.ts`; no RTL | Test-plan §6.1; Vitest is Node | Plan |

## Scope

**In scope:** Day/week labels, type chips, icon actions, compact mobile rows, UTC-today marker, delete tutorial paragraph, formatter unit tests, three open FU items.

**Out of scope:** Dashboard chrome, chat, Generate/history behavior, APIs, Playwright, moving helpers into `dates.ts`.

## Architecture / Approach

Pure presentational change in the existing React island. Formatters sit next to `formatRevisionLabel`. `utcToday` is imported from `@/lib/dates`. Classes merge with `cn()`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Compact readable week | Labels, chips, icons, mobile rows, today, no tutorial | Local TZ in formatters; `twMerge` dropping today or frozen |

**Prerequisites:** generated plan UI already on `/dashboard` (S-02 shipped).
**Estimated effort:** one session, one phase

## Open Risks & Assumptions

- Unlog as `Undo2` vs reusing `Check` is recorded as FU-035 (was FU-032 in this run; remapped on merge with landing-quiet).
- Today border winning over frozen purple is FU-033.
- Hiding structure/logged below `sm` is FU-034.

## Success Criteria (Summary)

- No ISO in visible day/week labels; aria-labels for log/freeze still include ISO dates.
- Phone: compact rows. Desktop: 7 columns + icon actions. Today marked. Tutorial gone.
