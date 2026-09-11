---
change_id: calendar-month-polish
title: Compact month toolbar, denser phone cells, session structure, manual snapshots
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/components/plan/PlanCalendar.tsx`, `src/components/plan/PlanWorkspace.tsx`, `src/components/plan/plan-month.ts` (labels only if needed), `src/lib/services/plan.ts` (`generateAndPersist`, `editUnit`, `snapshotWeekIfChanged` / `insertRevision`), `src/lib/services/chat.ts` (`acceptProposition` snapshot calls), new `src/pages/api/plan/snapshots.ts`, `src/pages/api/product-gates.test.ts`, `src/lib/services/plan-revisions.test.ts`, source-scan in `PlanCalendar.test.ts`. Keep `POST /api/plan/restore`. Merge classes with `cn()` from `@/lib/utils`. No new table — reuse `plan_revisions`.

### Today

The month calendar section uses `space-y-4`. Row 1 is a `text-lg` month heading plus prev / Today / next. Row 2 is Generate / Regenerate week and a **Week history** select (**Restore a version** / **No snapshots**). Cells are `min-h-20 p-2` with day number, a TODAY word, type color dot + type name, `N.0 km`, and **Rest** on empty in-month days. `TrainingUnit.structure` is optional; the day panel shows it as muted `text-xs` under km; cells never show it. Generate, accept, and unit edit auto-insert `plan_revisions` via `snapshotWeekIfChanged` / `insertRevision`. Restore already POSTs `{ weekStart, revisionId }`.

### Do

1. **Toolbar.** One flex strip: month heading `text-base`, nav cluster, generate button (keep current `onClick` and `generatePlanButtonLabel` in this change), then snapshot controls. Section stack `space-y-2`. On `md+` one nowrap row; at 390 wrap to two short rows (`gap-2`).

2. **Phone cells (below `sm` only).** `min-h-12 p-1`; day number only (keep the stronger today border, hide the TODAY word); keep the type color dot, hide the type word; km as `8` or `8.5` with no `km` suffix; hide **Rest**. From `sm:` keep today’s cell copy (type name + km, Rest, TODAY). Keep the seven-column grid.

3. **Structure.** When `structure` is set, it is the lead line in the open day panel (`text-base` / `font-medium`, above type and km). On `sm+` cells, a truncated second line with that string; hide it below `sm`. Read the existing field — generate/chat/edit already persist it. Do not add a column. Do not ship hardcoded session strings.

4. **Manual snapshot.** Primary history CTA is **Save snapshot**, enabled when the visible week’s units differ from the latest `plan_revisions` row for that Monday, or when there is no snapshot yet. Helper **Unsaved changes** in that dirty state; hide it when the week matches the latest snapshot. Compact **Restore** `<select>` only when `revisions.length > 0` (`aria-label="Restore"`, placeholder **Restore**). Drop **Week history** / **Restore a version** / **No snapshots** as the primary control.

5. **POST `/api/plan/snapshots`.** Body `{ weekStart }` (zod ISO date, `resolveWeekStart`). Insert the **current** week units into `plan_revisions` for that Monday, then `trimRevisions`. Return `{ weekStart, revisions, undoAvailable }`. Same auth/RLS as restore. Add the route to logged-out product gates (401). `prerender = false`.

6. **Stop auto snapshot.** Remove `snapshotWeekIfChanged` / `insertRevision` from `generateAndPersist`, `acceptProposition`, and `editUnit`. Persist the plan/edit as today; do not archive a version unless the member saved. `restoreWeek` and `POST /api/plan/restore` stay. Wire Save snapshot in `PlanWorkspace` to the new POST (busy + error like generate).

### Do not

- Replace the grid with a list; change Profile, races overlay, or chat Accept/Reject in this change.
- Change `generatePlan` fill logic or `POST /api/plan` generate body (a later change retargets the purple button to chat).
- Add a migration or new snapshot table.
- Ship hardcoded month workouts or fixture structure strings.

### Visible

One control strip with Save snapshot. A full month is readable at 390px. A clicked day with structure reads as a session, not only “anaerobic 8.0 km”. The UI no longer implies every generate/edit archived a version.

### Sequencing

Do not run in parallel with `races-on-calendar`, `generate-via-chat`, or `training-load-chart` (all edit `PlanCalendar.tsx`). Ship this before those three. `dashboard-list-chrome` is a different island and may run in parallel.
