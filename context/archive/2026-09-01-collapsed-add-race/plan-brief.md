# Collapse the add-race form behind a button — Plan Brief

> Full plan: `context/changes/collapsed-add-race/plan.md`

## What & Why

The empty Date / Priority / Name / Goal form is always open above Upcoming, so a one-race list sits under unused fields. Collapse it behind **Add race**; keep the same fields and submit; Cancel closes add and edit; pencil still edits. Weekly km stays above the race block.

## Starting Point

`SetupForm` on `/dashboard` always renders the add form, then Upcoming/Past. Cancel exists only in edit. `saveRace` / `startEdit` / `resetRaceForm` already implement create/update. No RTL/Playwright for this island.

## Desired End State

Default: **Add race** button + Upcoming visible (when races exist), no empty fields. Click opens today’s form. Cancel closes add and edit. Pencil opens edit. After save, collapsed again. After Profile tabs ship, the same SetupForm behavior still applies.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | `SetupForm.tsx` only; no Week/Profile tabs | LOCKED Notes; tabs are `dashboard-profile-tab` | Plan |
| Default including empty list | Collapsed even with zero races | Empty form is the problem regardless of list length | Unattended |
| Cancel | Shown for add and edit; closes without save | LOCKED: “Cancel closes add and edit” (today Cancel is edit-only) | Plan |
| After successful save | Collapse via `resetRaceForm` also clearing add-open | Same reset path as today; leaving the form open would recreate the unused-form bug after add | Unattended |
| Open-add order | `resetRaceForm` then set add-open true | Reset last would leave the form collapsed | Unattended |
| Trigger placement | Same slot as today’s form (after heading, before Upcoming) | Replaces the unused form in place; Upcoming stays immediately below | Unattended |
| Tests | No new Vitest/Playwright; source gates + `npm test` / lint; UI is Manual | Test-plan cost×signal; Node Vitest has no Testing Library | Unattended |

## Scope

**In scope:** Collapse/open/cancel for the race form in `SetupForm`; Cancel on add.

**Out of scope:** Dashboard tabs/chrome, weekly km, API/schema, new UI libraries, Playwright.

## Architecture / Approach

One React island. Boolean add-open plus existing `editingId`. Conditional render of the current form vs a `type="button"` **Add race** control. No API changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Collapse add and edit race form | Collapsed default + Cancel on add | Forgetting Cancel-on-add or leaving the form always mounted |

**Prerequisites:** none (S-01 SetupForm already shipped)
**Estimated effort:** one short session, one phase

## Open Risks & Assumptions

- Upcoming still hides when the group is empty (`RaceGroup` returns null); LOCKED means “list not buried,” not a placeholder heading.
- Collapsed **Add race** reuses the existing purple `Button` + Plus so it matches today’s submit CTA (not a second visual language).

## Success Criteria (Summary)

- Default `/dashboard` does not show empty race fields above Upcoming.
- Add / edit / cancel / pencil behave as locked; weekly km remains above the race block.
