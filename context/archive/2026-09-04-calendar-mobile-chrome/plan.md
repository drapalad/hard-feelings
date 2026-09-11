# Icon-only regenerate on mobile and a denser day-edit form — Implementation Plan

## Overview

On narrow widths the purple generate control currently paints the full `generatePlanButtonLabel` sentence and the day panel stacks Type, Distance, Structure, then always-visible log fields — crowding Save snapshot on the toolbar and pushing Save off a 390-wide panel. This change makes generate icon-only below `sm` (idle `aria-label` unchanged), densifies Type+Distance+Structure, and tucks log fields into a closed disclosure.

## What We're NOT Doing

- Changing Save snapshot, Restore, month nav, day cells, or chat
- Implementing Make AI or structured stages (comment slot only; `workout-stages-make-ai` owns the button)
- Retargeting generate to `POST /api/plan`; keep `onClick={onGenerate}` and the canned 14-day coach prompt
- Changing Save / log / freeze API
- Shipping “always editing”
- Concatenating Tailwind class strings (use `cn()` from `@/lib/utils`)
- Editing `generatePlanButtonLabel` phrases in `src/components/plan/plan-month.ts`
- Playwright / e2e (test-plan §6.3 / §7 visual snapshots)

## Phase 1: Mobile generate chrome + compact day-edit

### Overview

One `PlanCalendar.tsx` pass: responsive generate control, two-column Type+Distance with compact Structure, log in a native `<details>` closed by default, Freeze after that control, Edit still required to enter the form. Update the colocated source-scan so the new chrome is locked.

### Changes Required:

#### 1. Generate control (S-12)

**File**: `src/components/plan/PlanCalendar.tsx`

**Intent**: Stop the long Generate/Regenerate sentence from dominating the toolbar below `sm`, while desktop still reads the full phrase (including `Working...`). Screen readers keep the idle generate/regenerate name even while busy.

**Contract**: Import `RefreshCw` from `lucide-react`. Keep `onClick={onGenerate}` and `disabled={busy}`. Set `aria-label={generatePlanButtonLabel(false, hasHorizonUnit)}` (idle phrases only — never `Working...`, never a shortened label). Below `sm`: visible child is `RefreshCw` only (`sm:hidden`, `aria-hidden`). From `sm` up: visible child is `generatePlanButtonLabel(busy, hasHorizonUnit)` (`hidden sm:inline`). Square the control below `sm` with `cn()` classes; do not add a third `size="icon"` (month chevrons stay the only two). Merge classes with `cn()`. Do not change `plan-month.ts`.

#### 2. Day-edit form + log disclosure (S-13)

**File**: `src/components/plan/PlanCalendar.tsx` (`DayPanel`)

**Intent**: On 390, Save sits under Structure without a tall Type/Distance/Log stack; log fields are one short closed disclosure; Make AI has a merge seam later.

**Contract**:
- Type and Distance (km) on one row (`grid grid-cols-2` or equivalent); same `<select>` / number controls and labels.
- Structure full-width under that row. Compact field chrome: tighter label-to-input gap and input padding than today’s `mt-1` + `fieldClass` `py-1`, via `cn()` — do not change `fieldClass` globally (Restore still uses it).
- Tighten panel / form vertical rhythm (`space-y` / padding) so Save/Cancel sit directly under Structure.
- One-line source comment slot beside Structure for Make AI (`workout-stages-make-ai`); no button, no LLM call.
- Keep Edit to set `editing`; do not default `editing` to true.
- Move Log km / Pace / HR / Save log / Unlog into a native `<details>` (same pattern as `PlanChat` threads) **below** Save, **without** an `open` attribute (closed by default). Short `<summary>` (e.g. `Log`). Move the “Logged … km” status line inside the disclosure so a closed panel is not a second log stack. Freeze stays a sibling **after** the disclosure. Same `onSaveLog` / `onUnlog` / `onSetFrozen` handlers.

#### 3. Source-scan chrome lock

**File**: `src/components/plan/PlanCalendar.test.ts`

**Intent**: Calendar chrome is enforced by Vitest source-scan (test-plan §6.1), not Playwright. Wrapping the generate caption and adding a disclosure will fail today’s scan unless this file is updated in the same phase.

**Contract**: Keep seven-column / Rest / Today / `onClick={onGenerate}` / label-file phrases / month `size="icon"` count **=== 2** / Edit / Save log / Unlog / Freeze locks. Extend (or replace the generate-children assumption) so the scan requires: `RefreshCw`; `aria-label={generatePlanButtonLabel(false, hasHorizonUnit)}`; caption `hidden sm:inline` (or equivalent) and icon `sm:hidden`; Type+Distance two-column row; Structure; `<details>` without `open` wrapping Log km / Save log; Freeze after the disclosure; `setEditing(true)` still on Edit; a one-line Make AI comment beside Structure. Do not assert a Make AI button. Cookbook: test-plan §6.1; no Playwright (§6.3).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/plan/PlanCalendar.test.ts` passes
- `npm test` passes
- Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate tests; do not edit those files)
- `npx astro check` passes
- Source-scan locks icon-only generate below `sm` (`RefreshCw`, idle `aria-label`), full `generatePlanButtonLabel` caption from `sm` up, Type+Distance one row, Structure full-width, log in a closed `<details>`, Freeze after the disclosure, Edit to enter the form, Make AI comment slot, `onClick={onGenerate}`

#### Manual Verification:

- At ~390px (below `sm`): toolbar generate is icon-only (no Generate/Regenerate sentence); day-edit Type+Distance share one row; Save sits under Structure without scrolling past a tall log stack; log fields are behind a closed disclosure; Freeze is after that control
- At `sm+` / ~1280: generate shows the full `generatePlanButtonLabel` phrase, including `Working...` while busy; accessible name stays Generate/Regenerate next 14 days

## Testing Strategy

### Unit Tests:

- Colocated `PlanCalendar.test.ts` source contract as in Phase 1.3. Deliberate-break: restore always-visible generate caption children (no `sm:hidden` icon / no `hidden sm:inline` caption) or drop the log `<details>` and confirm the scan goes red.

## References

- Locked spec: `context/changes/calendar-mobile-chrome/change.md`
- Research: `context/changes/calendar-mobile-chrome/research.md`
- Frame: `context/changes/calendar-mobile-chrome/frame.md`
- Labels: `src/components/plan/plan-month.ts` (`generatePlanButtonLabel`)
- Disclosure pattern: `src/components/plan/PlanChat.tsx` (`<details>`)
- Test cookbook: `context/foundation/test-plan.md` §6.1 / §6.3

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Mobile generate chrome + compact day-edit

#### Automated

- [x] 1.1 `npm test -- src/components/plan/PlanCalendar.test.ts` passes — 09caf85
- [x] 1.2 `npm test` passes — 09caf85
- [x] 1.3 Touched-file lint: `npx eslint src/components/plan/PlanCalendar.tsx src/components/plan/PlanCalendar.test.ts` passes (repo-wide `npm run lint` is red at HEAD on untouched training-load / pace-estimate tests; do not edit those files) — 09caf85
- [x] 1.4 `npx astro check` passes — 09caf85
- [x] 1.5 Source-scan locks icon-only generate below `sm` (`RefreshCw`, idle `aria-label`), full `generatePlanButtonLabel` caption from `sm` up, Type+Distance one row, Structure full-width, log in a closed `<details>`, Freeze after the disclosure, Edit to enter the form, Make AI comment slot, `onClick={onGenerate}` — 09caf85

#### Manual

- [ ] 1.6 At ~390px (below `sm`): toolbar generate is icon-only (no Generate/Regenerate sentence); day-edit Type+Distance share one row; Save sits under Structure without scrolling past a tall log stack; log fields are behind a closed disclosure; Freeze is after that control
- [ ] 1.7 At `sm+` / ~1280: generate shows the full `generatePlanButtonLabel` phrase, including `Working...` while busy; accessible name stays Generate/Regenerate next 14 days
