# Races Live on Calendar Implementation Plan

## Overview

Lift `races` state from `SetupForm`'s local copy up to `DashboardTabs` so that adding, editing, or deleting a race on the Profile tab immediately reflects on the Calendar and List tabs without a page reload.

## Current State Analysis

- `dashboard.astro` fetches `races` via `listRaces` at SSR time and passes the array into `DashboardTabs`.
- `DashboardTabs` passes `races` as a read-only prop to `PlanWorkspace`, `PlanList`, and `SetupForm`.
- `SetupForm` copies `races` into its own `useState` and mutates that copy after successful POST/PATCH/DELETE calls to `/api/races`. The Calendar and List panels never see those mutations.
- `PlanWorkspace` stores `races` as a plain prop (no local state for races) and passes it to `PlanCalendar`.
- `PlanList` receives `races` as a prop and uses it in `listRows`.
- `RaceMarker` rendering already works — it just needs the live array.

### Key Discoveries:

- `PlanWorkspace` line 197: `races` prop is destructured and forwarded to `PlanCalendar` without local state — no change needed inside `PlanWorkspace` itself, only the prop value needs to be live.
- `PlanList` line 100: `races` is a direct prop used in `listRows` — same story.
- `SetupForm` lines 93–94: `const [races, setRaces] = useState<Race[]>(initialRaces);` — this is the local copy that must be replaced with the lifted callback pattern.
- `SetupForm` lines 241–243 (save) and 259–260 (delete): these are the two mutation sites that must call the new `onRacesChange` callback.

## Desired End State

`DashboardTabs` owns `races` state. After adding, editing, or deleting a race on Profile, the same live array flows into Calendar (via `PlanWorkspace` → `PlanCalendar`) and List (via `PlanList`). Switching tabs shows consistent data without reload.

### Verification:
- Add a race on Profile → switch to Calendar → the race's date cell shows `RaceMarker` (Flag + name + priority).
- Delete a race on Profile → switch to List → the race is gone from the list rows if that date was in range.

## What We're NOT Doing

- Changing `/api/races` endpoints, race priority rules, or `RaceMarker` styling.
- Touching Generate, chat, or logs functionality.
- Hardcoding any fixture/demo race data.
- Adding new API calls or server-side changes.

## Implementation Approach

Classic React "lift state up" pattern. Move `races` from `SetupForm` local state to `DashboardTabs` state, add an `onRacesChange` callback prop to `SetupForm`, and wire it after each successful mutation. No new components, no new files.

## Phase 1: Lift races state to DashboardTabs

### Overview

Move `races` from a read-only prop to `useState` in `DashboardTabs`, pass the live array to all three tab panels, and add an `onRacesChange` callback to `SetupForm`.

### Changes Required:

#### 1. DashboardTabs — own races state

**File**: `src/components/dashboard/DashboardTabs.tsx`

**Intent**: Convert the `races` prop from pass-through to stateful. Initialize `useState<Race[]>(races)` and pass the live state array to `PlanWorkspace`, `PlanList`, and `SetupForm`. Pass a setter callback `onRacesChange` to `SetupForm`.

**Contract**: New state `const [liveRaces, setLiveRaces] = useState<Race[]>(races);`. The JSX replaces every `races` reference in the three tab panels with `liveRaces`. `SetupForm` gets an additional prop `onRacesChange: (next: Race[]) => void` wired to `setLiveRaces`.

#### 2. SetupForm — accept and call onRacesChange

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Replace the self-contained `races` local state with the parent-owned array and notify the parent after every successful save or delete so the live array propagates to Calendar and List.

**Contract**: `SetupFormProps` gains `onRacesChange: (races: Race[]) => void`. The component keeps its local `useState<Race[]>` for optimistic UI (the form still needs `races`, `setRaces` for immediate feedback), but after each successful mutation (inside `saveRace` after `setRaces(sorted)` and inside `removeRace` after `setRaces(next)`), it also calls `onRacesChange(sorted)` / `onRacesChange(next)` so the parent's state updates.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npx tsc --noEmit`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- Existing tests pass: `npm test -- --run`

#### Manual Verification:

- Add a race on Profile → switch to Calendar → RaceMarker appears on the correct date cell
- Delete a race on Profile → switch to Calendar → RaceMarker disappears
- Add a race on Profile → switch to List → if that date is within 21 days the race appears in the list

## Testing Strategy

### Unit Tests:

- No new unit tests required — the change is pure prop wiring with no new logic. Existing race-related tests (if any) continue to pass.

### Manual Testing Steps:

1. On Profile tab, add a race for a date visible on the calendar grid → switch to Calendar → confirm Flag + name + priority marker is present
2. Edit that race's priority → switch to Calendar → confirm the marker reflects the new priority
3. Delete the race → switch to Calendar → confirm the marker is gone
4. Add a race for a date within 21 days → switch to List → confirm it appears in the list rows

## Performance Considerations

None. The change replaces one `useState` prop source with another at the same level of the tree. No additional renders beyond what React already does when state changes.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lift races state to DashboardTabs

#### Automated

- [x] 1.1 TypeScript compiles without errors — a9e4f60
- [x] 1.2 Lint passes — a9e4f60
- [x] 1.3 Build succeeds — a9e4f60
- [x] 1.4 Existing tests pass — a9e4f60

#### Manual

- [x] 1.5 Add race on Profile → Calendar shows RaceMarker on that date
- [x] 1.6 Delete race on Profile → Calendar RaceMarker disappears
- [x] 1.7 Add race on Profile → List shows race if date within 21 days
