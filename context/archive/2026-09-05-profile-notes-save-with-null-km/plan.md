# Save coach notes when weekly km is empty — Implementation Plan

## Overview

Coach notes **Save** must work when Weekly km is empty. Drop the `saveCoachNotes` early return that shows **Save weekly km before saving coach notes**. Empty km maps to `weeklyKm: null` on the same in-page `PUT /api/profile` that already carries long/rest/mix and `coachNotes`. No schema or migration work.

## Current State Analysis

`saveCoachNotes` in `src/components/setup/SetupForm.tsx` reads `kmInput.trim()` and, when it is `""`, sets `notesError` to `"Save weekly km before saving coach notes"` and returns — no parse, no fetch. That leftover from the old NOT NULL km column is FU-146. The km field can already be empty: `saveKm` PUTs `weeklyKm: null` and the UI shows **No weekly km set yet**.

`profileWriteSchema.weeklyKm` is already `weeklyKmSchema.nullable()`. PUT `/api/profile` upserts `weekly_km: null` and, when `coachNotes` is in the body, writes trimmed notes (empty string → SQL NULL). Hosted and local SQL for nullable `weekly_km` is already applied (DEP-029).

When km is non-empty, `saveCoachNotes` still `Number(trimmedKm)` and PUTs prefs + `coachNotes`. Last-race PATCH is a separate form. Notes Save does not update `weeklyKm` React state from the response; it only syncs `notesInput` from `body.coachNotes`.

Repo-wide `npm run lint` is red at HEAD on untouched files. Phase gates use scoped eslint on the touched set, `npm test`, and `npx astro check` — not repo-wide lint. `npm run build` needs `SUPABASE_*`; do not use it as a gate.

SetupForm tests are vitest source-read (`SetupForm.test.ts`), not RTL / fetch mocks.

## Desired End State

A member with an empty Weekly km field can click **Save** on Coach notes. The request is in-page `PUT /api/profile` with `weeklyKm: null`, current long/rest/mix, and `coachNotes`. The guard copy never appears. After Save without reload: notes stay as saved, km stays empty, **No weekly km set yet** still visible, last race / mix / long / rest unchanged. Reload GET: `coachNotes` persisted, `weeklyKm` still `null`. Empty notes still save as SQL NULL. One **Save** on the notes form.

### Key Discoveries:

- The API already accepts the payload Notes require. The only product bug is the client early return on empty `kmInput`.
- Empty km mapping already exists in `saveKm`: `weeklyKm: trimmed === "" ? null : Number(trimmed)`. Notes Save should use the same mapping instead of `Number(trimmedKm)` after a hard empty reject.
- `saveCoachNotes` must keep sending `coachNotes` (unlike `saveKm`, which omits it so notes are preserved). Empty notes still go through schema trim → `null`.
- Invalid non-empty km (`0`, `abc`) stays a schema / client error. Notes only unlock the empty field.

## What We're NOT Doing

- Requiring weekly km before notes Save.
- Restyling Profile or adding a second notes button.
- Changing last-race PATCH.
- Changing `saveKm`, DELETE (already gone), schema, or migrations.
- Playwright / e2e.
- Fixing HEAD lint outside the touched set.
- `npm run build` as a gate.

## Implementation Approach

One phase: remove the empty-km guard in `saveCoachNotes`, parse `weeklyKm` with the same empty→`null` mapping as `saveKm`, keep the existing PUT body (prefs + `coachNotes`), extend source-read tests.

## Phase 1: Notes Save with null weekly km

### Overview

Unlock Coach notes Save when Weekly km is empty. Same in-page PUT, same **Save** button.

### Changes Required:

#### 1. SetupForm notes Save

**File**: `src/components/setup/SetupForm.tsx`

**Intent**: Empty Weekly km must not block notes Save. The PUT must send `weeklyKm: null` plus current long/rest/mix and `coachNotes` so a null-km row can still store notes (S-146.1–4).

**Contract**: Delete the `trimmedKm === ""` early return and the string `Save weekly km before saving coach notes`. Pass `weeklyKm: trimmedKm === "" ? null : Number(trimmedKm)` into `profileWriteSchema.safeParse` (same empty mapping as `saveKm`). Keep the existing PUT `/api/profile` JSON: `weeklyKm`, long/rest/mix, `coachNotes`. Keep one **Save** on the notes form. Do not `location.reload()`. Do not send last-race fields. Do not omit `coachNotes`. After 200, keep syncing `notesInput` from `body.coachNotes` only — do not clear last-race or mix state.

#### 2. Source-read tests

**File**: `src/components/setup/SetupForm.test.ts`

**Intent**: Lock the empty-km notes path the same way this file already locks empty-km Save.

**Contract**: In `describe("SetupForm coach notes")`, assert `saveCoachNotes` maps empty km with `weeklyKm: trimmedKm === "" ? null : Number(trimmedKm)` (or the exact source the implementer lands), still includes `coachNotes: notesInput` and `method: "PUT"`, and does **not** contain `Save weekly km before saving coach notes`. Do not add RTL / user-event / fetch mocks.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/setup/SetupForm.test.ts`
- `npm test`
- Touched-file eslint: `npx eslint src/components/setup/SetupForm.tsx src/components/setup/SetupForm.test.ts`
- `npx astro check`

#### Manual Verification:

- S-146.1–4 in the running app: empty Weekly km, type notes, **Save**; no guard copy; notes stay; **No weekly km set yet**; mix / long / rest / last race unchanged; reload still has notes and null km; empty notes still clear to SQL NULL; one **Save**.

## Testing Strategy

### Unit Tests:

- Source-read: empty km mapping on `saveCoachNotes`, PUT + `coachNotes`, guard string absent.
- Existing API tests already cover PUT `weeklyKm: null` (row kept) and empty notes → SQL NULL. Do not add a new API file unless the form change forces one.

### Manual Testing Steps:

1. Profile with Weekly km empty and **No weekly km set yet** visible. Enter coach notes, click **Save**. Confirm no **Save weekly km before saving coach notes**. Notes remain; km empty; last race / mix / long / rest unchanged.
2. Reload: notes persisted, km still empty.
3. Clear notes, **Save**: notes empty after reload (SQL NULL).

## References

- Notes: `context/changes/profile-notes-save-with-null-km/change.md`
- Prior change: `context/archive/2026-09-05-profile-keep-row-on-clear-km/`
- API PUT: `src/pages/api/profile.ts`
- Schema: `src/lib/services/profile-races.ts` (`profileWriteSchema.weeklyKm` nullable)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Notes Save with null weekly km

#### Automated

- [x] 1.1 `npm test -- src/components/setup/SetupForm.test.ts` — 3cbfa5d
- [x] 1.2 `npm test` — 3cbfa5d
- [x] 1.3 Touched-file eslint: `npx eslint src/components/setup/SetupForm.tsx src/components/setup/SetupForm.test.ts` — 3cbfa5d
- [x] 1.4 `npx astro check` — 3cbfa5d

#### Manual

- [x] 1.5 S-146.1–4 in the running app: empty Weekly km, type notes, **Save**; no guard copy; notes stay; **No weekly km set yet**; mix / long / rest / last race unchanged; reload still has notes and null km; empty notes still clear to SQL NULL; one **Save**.
