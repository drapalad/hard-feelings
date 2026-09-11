# Compact month toolbar, denser phone cells, session structure, manual snapshots — Plan Brief

> Full plan: `context/changes/calendar-month-polish/plan.md`

## What & Why

The month calendar is too tall on a phone, hides session `structure` in a whisper, and pretends every generate/edit archived a version. This change densifies the toolbar and cells, promotes `structure` to the session line, and makes snapshots explicit: **Save snapshot** writes `plan_revisions`; generate/Accept/edit do not.

## Starting Point

A two-row toolbar (`text-lg` heading + Week history select), `min-h-20` cells with TODAY / type word / `N.0 km` / Rest, structure only as `text-xs` under km in the day panel. `snapshotWeekIfChanged` / `insertRevision` run from generate, Accept, and edit. Restore already POSTs `{ weekStart, revisionId }`.

## Desired End State

One wrapping control strip with Save snapshot. A full month is readable at 390px. A clicked day with structure reads as a session, not only “anaerobic 8.0 km”. The UI no longer implies every generate/edit archived a version. Restore still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Toolbar, phone cells, structure display, manual snapshot POST, stop auto-archive; not list/profile/races/chat/generate fill/migrations | Locked Notes; later slices own generate-via-chat and races overlay | Plan |
| Dirty after reload | GET `/api/plan` adds `latestSnapshotUnits` (`null` if none); client compares the `weekStart` slice | Summaries alone cannot test “differs from the latest row” after a reload | Unattended |
| Empty week | Save snapshot allowed; no row ⇒ dirty | Locked: enabled when there is no snapshot yet | Plan |
| Snapshot insert | Always insert current week then trim; do not skip on equal; do not swallow errors | Locked POST inserts current units; the member asked to save | Plan |
| Restore auto-snapshot | Keep `snapshotWeekIfChanged` on `restoreWeek` only | Locked: restore stays; generate/Accept/edit are the ones that stop | Plan |
| Dirty Monday | Compare workspace `weekStart` only (same as generate/restore) | Snapshot is a week operation, not the clicked day in another week of the month | Plan |
| Save snapshot chrome | Outline/`sm` next to purple generate; helper **Unsaved changes**; Restore select only if `revisions.length > 0` | “Primary history CTA” is vs Week history, not a second purple generate | Unattended |
| Compact km | `formatCompactKm`: `roundKm` then `"8"` or `"8.5"`, no suffix below `sm` | Locked examples; `sm+` keeps `N.0 km` | Plan |
| Errors / busy | Same `busy` + `calendarError` as generate | Locked: busy + error like generate | Plan |
| Tests | Rewrite `plan-revisions` + Accept snapshot expect; product-gates 401; source-scan UI; no Playwright | Locked files + test-plan §6.3 | Plan |

## Scope

**In scope:** `PlanCalendar` / `PlanWorkspace` / `plan-month` labels, `plan.ts` snapshot helpers + stop auto-insert, `chat.ts` Accept, `POST /api/plan/snapshots`, GET `latestSnapshotUnits`, product-gates, revision tests, source-scan.

**Out of scope:** Grid→list, Profile, races overlay, chat Accept/Reject, `generatePlan` fill / generate POST body, migrations, hardcoded workouts, Playwright.

## Architecture / Approach

Reuse `plan_revisions`. New POST mirrors restore auth/zod/`prerender = false`. GET grows `latestSnapshotUnits` so the island can compute dirty without importing the server service. `snapshotCurrentWeek` always inserts + trims. UI: one flex strip, `sm:` visibility for phone vs desktop cell copy, `unit.structure` as panel lead and `sm+` truncated cell line.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Manual snapshot API and stop auto-archive | POST snapshots, GET latest units, no auto-insert, tests flipped | Old generate-undo tests encode auto-archive |
| 2. Compact month chrome and Save snapshot UI | Toolbar, phone cells, structure, dirty CTA | Source-scan still sees Rest/TODAY strings (must `hidden sm:`) |

**Prerequisites:** Month calendar + day panel + version restore already on disk; `plan_revisions` hosted (DEP-012 done).
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- GET `latestSnapshotUnits` is an extra field on an existing route (not in the original file list) so dirty can honor the latest-row rule after reload (FU-114).
- Save snapshot is outline, not purple (FU-115).
- After restore, the latest row is the pre-restore week, so the restored live week is dirty until Save snapshot.

## Success Criteria (Summary)

- Phone month is a compact seven-column grid; structure leads the day panel.
- Save snapshot archives; generate/Accept/edit do not.
- Restore still lands a chosen `plan_revisions` row.
