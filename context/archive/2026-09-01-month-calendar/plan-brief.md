# Month calendar — Plan Brief

> Full plan: `context/changes/month-calendar/plan.md`

## What & Why

The Week tab still shows seven oversized day cards with in-cell Edit/Log/Freeze. Members need a real month grid (Monday start), a Today jump, Rest instead of Empty, generate labeled for the **active week**, and a wider calendar beside chat — reading **persisted** units, not UX-mock fixtures.

## Starting Point

`PlanCalendar` maps `weekDates(weekStart)` to fat cards. `PlanWorkspace` GETs one week and **replaces** `units` on every load/generate. GET `/api/plan?weekStart=` + `listWeek` use `.in("date", seven days)`. SSR in `dashboard.astro` still loads the current week only (out of scope). `PlanChat.tsx` is locked.

## Desired End State

Dashboard Week is a 5–6 row month. Header is month + year. Today is disabled with `aria-current="date"` when that month is already visible. In-month empty days say Rest. Generate is Generate plan / Regenerate week / Working... for `weekDates(weekStart)`. Layout is `lg:grid-cols-5` (calendar 3, chat 2). Cell actions are gone. Chat/generate/restore stay week-scoped.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Month data load | Range GET `from`/`to` via `.in("date", dates)`, cap 42 days | One round-trip; memory persist has no `gte`/`lte`; notes allowed this or N week fetches | Unattended |
| Dashboard SSR | Do not edit `dashboard.astro`; client fetches the month on mount | Locked file list is calendar, workspace, dates, plan GET/`listWeek` | Plan |
| Visible month state | Explicit `YYYY-MM-01`, not derived from `weekStart` | Notes change the visible month independently; current week’s Monday can sit in the previous month | Plan |
| Week mutations | `mergeWeekSlice` after generate/accept/restore | Those APIs return one week; `setUnits(week)` would wipe the month | Unattended |
| Cell actions | Strip buttons, edit form, and workspace freeze/edit/log wiring | Locked: not in month cells; unused handlers fail lint | Plan |
| Generate / chat empty | Active week (`weekDates(weekStart)`), not `units.length === 0` | Locked week-scoped generate; cannot edit `PlanChat.tsx` | Plan |
| Outside-month cells | Muted, no workout even if units exist in state | Locked padding rule; units still kept for week emptiness | Plan |
| Logs in cells | Keep logs in workspace state; do not render them | Cell spec is day number, type chip, km | Plan |
| Tests | Dates + range GET contracts + source-read UI; no Playwright | test-plan §6.1–§6.4; Node Vitest only | Plan |
| Layout / Today disable | `lg:grid-cols-5` 3/2; Today disabled when **month** matches utc today | Locked notes | Plan |

## Scope

**In scope:** Month grid + helpers in `dates.ts`; GET range + `listRange` / `listLogsRange`; `PlanCalendar` / `PlanWorkspace` chrome, fetch, merge; colocated Vitest.

**Out of scope:** Cell day-actions panel; `PlanChat.tsx`; confirm-regenerate; month-wide generate; migrations/RLS; `dashboard.astro`; landing/auth/topbar/tabs.

## Architecture / Approach

Client stores `visibleMonth` + `weekStart`. Month nav sets both, then GET `/api/plan?weekStart&from&to` (grid window) and GET `/api/chat?weekStart`. POST generate still `{ weekStart }`; response units merge by week dates. `listRange` mirrors `listWeek` (owner + `.in`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Date helpers | Month grid / Today weekStart / inclusive dates | Grid off-by-one vs API window |
| 2. Range GET | `from`/`to` units+logs, week GET unchanged | Unbounded `.in` or leaking another member |
| 3. Month UI | Grid, Rest, Today, generate label, 3/2, no cell actions | Tight 7-col mobile; leftover action buttons |
| 4. Fetch + merge | Real month rows; generate does not wipe the month | `setUnits` replace bug; `unitsEmpty` month-wide |

**Prerequisites:** Wave 1 UI merges already on this branch; plan GET and `listWeek` exist.
**Estimated effort:** ~4 Automated phases, then human UI checklist.

## Open Risks & Assumptions

- First paint may show only the SSR week until the month GET returns.
- Range GET vs repeated `weekStart` fetches (FU-088); merge vs refetch-month (FU-089).

## Success Criteria (Summary)

- Month grid with Rest, Today, week-scoped generate label, 3/2 layout, no cell actions.
- Visible month loaded from persisted GET `from`/`to`, not fixtures.
- Generate/chat/restore still one week.
