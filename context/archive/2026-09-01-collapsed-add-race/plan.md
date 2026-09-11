# Collapse the add-race form behind a button Implementation Plan

## Overview

Default the race Date / Priority / Name / Goal form in `SetupForm` to collapsed so Upcoming is not buried under an unused empty form. An **Add race** button opens the same fields and submit as today; Cancel closes add and edit; the pencil still opens edit. Weekly km stays above the race block.

## Current State Analysis

`src/components/setup/SetupForm.tsx` is the dashboard island for weekly km + race calendar (`src/pages/dashboard.astro` hydrates it with `client:load` above `PlanWorkspace`). The race section always renders a filled-out-looking form (`id="race-date"` … submit **Add race** / **Save race**) *above* Upcoming / Past. Cancel exists only when `editingId !== null`. Pencil (`aria-label={`Edit …`}`) calls `startEdit`; successful save and `resetRaceForm` clear fields but leave the empty add form visible.

There is no component test for this island. Vitest is Node-only (`src/**/*.test.ts`); `@testing-library` is not in the stack. Test-plan §6.3 forbids adding Playwright for “feels safer.” `dashboard-profile-tab` (Week / Profile tabs) is a **later** change; this worktree still stacks SetupForm above the plan.

## Desired End State

On `/dashboard`, a member with races sees Weekly km, then Race calendar with an **Add race** button and Upcoming (and Past if any) — not an empty Date/Priority/Name/Goal form. Clicking **Add race** reveals the same form and POST/PATCH submit as today. Cancel closes that form for both add and edit. Pencil still opens edit with the same fields. After a successful save (or cancel), the form is collapsed again. After `dashboard-profile-tab` ships, this behavior still applies wherever SetupForm is mounted (Profile).

### Key Discoveries:

- Form markup and `saveRace` / `startEdit` / `resetRaceForm` already exist in `src/components/setup/SetupForm.tsx` (race form ~lines 220–299; `startEdit` ~124–131; Cancel gated on `editingId !== null` ~285–297).
- Cancel-on-add is **new**: today there is no Cancel in add mode (`editingId === null`).
- `RaceGroup` returns `null` when the group is empty — Upcoming is visible only when there is at least one upcoming race. Do not invent an empty Upcoming heading.
- `cn()` from `@/lib/utils` is required for any class merges (AGENTS.md). Existing `Button` + `FormField` are enough; no new shadcn piece.
- Parallel change `dashboard-profile-tab` owns tabs; this change must not add them.

## What We're NOT Doing

- Week / Profile tabs, or any `dashboard.astro` layout change (`dashboard-profile-tab` / `dashboard-chrome`).
- Changing weekly km UI, race field set, zod `raceWriteSchema`, or `/api/races` behavior.
- Restyling the glass card, gradient H1, Topbar, PlanWorkspace, or chat.
- New shadcn Collapsible / Dialog; new Playwright or Testing Library; jsdom Vitest environment.
- Auto-focus, URL hash, or persisting open/closed across reloads.

## Implementation Approach

Keep all race I/O in `SetupForm`. Add collapsed vs open state (add open vs edit open). Default collapsed. Render the existing form only when open. Render a `type="button"` **Add race** control only when collapsed. Show Cancel whenever the form is open. `resetRaceForm` (save success, cancel, delete-while-editing) returns to collapsed. `startEdit` opens the form in edit mode (and is not collapsed).

## State sequencing

`resetRaceForm` must clear add-open (as well as `editingId` and fields). Opening add therefore cannot end with `resetRaceForm`: reset first, then set add-open true. The reverse order leaves the form collapsed. `startEdit` must clear add-open before (or while) setting `editingId` and the four fields so Cancel/`resetRaceForm` cannot leave a stale add-open flag that immediately re-opens an empty add form.

## User experience spec

Default (including zero races): Weekly kilometres section unchanged, then Race calendar heading, existing empty-state copy if `races.length === 0`, **Add race** button, then Upcoming/Past lists as today (groups omit themselves when empty). No Date / Priority / Name / Goal fields until the member opens add or edit.

**Add race** (collapsed control) opens the same bordered form as today: heading “Add a race”, Date / Priority / Name / Goal, `ServerError`, submit **Add race** (Plus icon, busy → “Saving…”). **Cancel** on that form closes it without POST.

Pencil still fills the form from the race (“Edit race”, submit **Save race**). **Cancel** closes edit without PATCH. Opening edit while add is open switches to edit (do not keep a second form). Opening add while edit is open is not required as a second control — the collapsed **Add race** trigger is hidden while the form is open; Cancel then **Add race** is the path.

Successful POST/PATCH still sorts via `sortRacesUpcomingFirst` and then collapses (today’s `resetRaceForm` plus clearing add-open).

Place the collapsed **Add race** control in the same slot the always-open form occupies today (after the race heading / empty copy, before Upcoming). Reuse existing `Button` + Plus icon so it reads as the same CTA, not a new pattern.

## Phase 1: Collapse add and edit race form

### Overview

Gate the existing race form behind collapsed / add / edit in `SetupForm` only, and extend Cancel to add mode.

### Changes Required:

#### 1. SetupForm race section

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Stop showing an empty add form on every dashboard load so Upcoming is immediately visible; keep add/edit payloads identical to today.

**Contract**: Default to collapsed (`adding` false, `editingId` null). Race form (including `id="race-date"`) renders if and only if adding or editing. Collapsed control: `type="button"`, visible label **Add race**, not a submit. Form submit labels stay **Add race** / **Save race** (and **Saving...** when `raceBusy`). Cancel is `type="button"` and visible whenever the form is open. `resetRaceForm` clears add-open as well as `editingId` and fields. Open-add: `resetRaceForm` then set add-open true (not the reverse). `startEdit` clears add-open, sets `editingId`, and fills the four fields from the race. Do not change `saveKm`, `saveRace` URLs/methods, or `RaceGroup`. Merge any new classes with `cn()`. Do not add Week/Profile tabs.

### Success Criteria:

#### Automated Verification:

- `src/components/setup/SetupForm.tsx` still contains FormField `id="race-date"` and submit strings `Add race` / `Save race`; add-open state is initialized to `false`; `id="race-date"` renders only when add-open is true or `editingId` is non-null
- `src/components/setup/SetupForm.tsx` has a `type="button"` Add race control for the collapsed state, and Cancel is shown for add as well as edit (not only wrapped in `editingId !== null`)
- `src/components/setup/SetupForm.tsx` still has the Weekly kilometres `<h2>` before the Race calendar `<h2>`; `src/pages/dashboard.astro` still hydrates `SetupForm` and `PlanWorkspace` and does not introduce Week/Profile tab labels
- `npm test` exits 0
- `npm run lint` exits 0

#### Manual Verification:

- On `/dashboard`, the default view shows Weekly km, an Add race button, and Upcoming (when the member has upcoming races) without empty Date / Priority / Name / Goal fields; Add race opens the same form and submit as today; Cancel closes add and edit; the pencil still opens edit

---

## Testing Strategy

### Unit Tests:

- None new. Collapse is island UI; Vitest is Node-only with no Testing Library (test-plan §1 cost×signal; §6.3 no Playwright). Existing `npm test` must still pass. Source gates above lock the branch/Cancel contract.

### Integration Tests:

- None. No API or schema change.

### Manual Testing Steps:

1. Open `/dashboard` signed in with at least one upcoming race: empty add form must not sit above Upcoming; Weekly km is still above the race block.
2. Click **Add race**, fill Date + Priority, submit; list updates; form collapses.
3. Click **Add race**, then **Cancel**: form closes with no new race.
4. Pencil a race, change a field, **Cancel**: no save; form closes. Pencil again, **Save race**: list updates; form collapses.

## Performance Considerations

Same island; no extra client bundle beyond a boolean of state.

## Migration Notes

None. Client-only default; no persistence of open/closed.

## References

- `context/changes/collapsed-add-race/change.md` — locked Notes
- `src/components/setup/SetupForm.tsx`
- `src/pages/dashboard.astro`
- `context/foundation/test-plan.md` §1, §6.3
- Parallel (do not implement): `context/changes/dashboard-profile-tab/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Collapse add and edit race form

#### Automated

- [x] 1.1 `src/components/setup/SetupForm.tsx` still contains FormField `id="race-date"` and submit strings `Add race` / `Save race`; add-open state is initialized to `false`; `id="race-date"` renders only when add-open is true or `editingId` is non-null — 72f25f1
- [x] 1.2 `src/components/setup/SetupForm.tsx` has a `type="button"` Add race control for the collapsed state, and Cancel is shown for add as well as edit (not only wrapped in `editingId !== null`) — 72f25f1
- [x] 1.3 `src/components/setup/SetupForm.tsx` still has the Weekly kilometres `<h2>` before the Race calendar `<h2>`; `src/pages/dashboard.astro` still hydrates `SetupForm` and `PlanWorkspace` and does not introduce Week/Profile tab labels — 72f25f1
- [x] 1.4 `npm test` exits 0 — 72f25f1
- [x] 1.5 `npm run lint` exits 0 — 72f25f1

#### Manual

- [x] 1.6 On `/dashboard`, the default view shows Weekly km, an Add race button, and Upcoming (when the member has upcoming races) without empty Date / Priority / Name / Goal fields; Add race opens the same form and submit as today; Cancel closes add and edit; the pencil still opens edit
