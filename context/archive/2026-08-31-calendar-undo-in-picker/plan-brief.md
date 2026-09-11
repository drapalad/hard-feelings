# Restore week history only through the picker — Plan Brief

> Full plan: `context/changes/calendar-undo-in-picker/plan.md`

## What & Why

Human chose FU-021 picker-only: one recovery control (Week history), not Undo-plus-picker. FU-020 stays checkout-keep-later (confirmed, no code).

## Starting Point

`calendar-version-restore` shipped snapshot-on-generate/accept, `POST /api/plan/restore`, and a Week history `<select>` beside **Undo last edit** (`PlanCalendar.tsx`). `undoWeek` / `POST /api/plan/undo` still pop the latest snapshot.

## Desired End State

Dashboard calendar restores only via Week history. No Undo button. Checkout-keep-later unchanged. `POST /api/plan/undo` remains for tests / JSON clients. FU-020 and FU-021 Status: done.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| FU-020 | Confirm checkout-keep-later; no code | Human: “FU-020 checkout-keep-later” | Plan |
| FU-021 | Picker-only: remove Undo button and `onUndo` | Human: “FU-021 picker-only”; one recovery control | Plan |
| Undo HTTP | Keep `POST /api/plan/undo` + `undoWeek` | FU-021 names the button, not the API; product-gates and revision tests still use pop-latest | Unattended |
| `undoAvailable` in JSON | Keep on plan responses | Additive field already shipped; stripping it is unrelated churn | Unattended |
| Workspace props | Drop `undoAvailable` / `onUndo` from the island | Dead UI wiring after the button is gone | Unattended |

## Scope

**In scope:** Calendar/workspace/dashboard UI; close FU-020 (confirm) and FU-021 (picker-only).

**Out of scope:** Deleting `undo.ts`; restore semantics; FU-002; new SQL; Playwright; other FU/DEP.

## Architecture / Approach

Remove the Undo control and its client `fetch("/api/plan/undo")`. Picker still `POST /api/plan/restore`. Server `undoWeek` unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Picker-only UI | No Undo button; picker remains; backlog closed | Accidental restore-API or checkout change |

**Prerequisites:** `calendar-version-restore` on disk.
**Estimated effort:** one short phase.

## Open Risks & Assumptions

- Keeping `/api/plan/undo` means a logged-in client can still pop-latest without the picker. That is an unattended keep, not a product promise.

## Success Criteria (Summary)

- No “Undo last edit” on the calendar.
- Week history select still restores by id.
- FU-020 and FU-021 done.
