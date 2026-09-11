# Flag for admin stores technical propose and persist JSON — Implementation Plan

## Overview

On Flag, store a technical snapshot of the flagged assistant turn (mutations, validation, dataRequest / loaded range, persist `proposedCount` vs `appliedCount`) by appending JSON to `agent_reports.body` — option **(b)**, no migration. Capture the snapshot at Send because `chat_messages` do not hold propose JSON today. Admin Algorithm feedback shows that JSON in a `<pre>` under the prose.

## Current State Analysis

`buildGapReport` (`src/lib/services/agent-report.ts:38-50`) writes prose only: canned intro + `User:` + `Assistant:` from `chat_messages.content`. `insertAgentReport` writes `title` / `body` / `bound_codes` — `agent_reports` has no `payload jsonb` (`supabase/migrations/20260817120000_admin_algorithm_feedback.sql`). `AgentReport.body` is `string` (`src/types.ts:149-160`).

`reportAssistantGap` (`src/lib/services/chat.ts:457-501`) loads the flagged assistant row and previous user message, then `insertAgentReport(buildGapReport(…))`. It does not read mutations, validation, or persist results.

`sendMessage` applies mutations, may `persistProposedUnits` → `replaceWeek`, and returns `validation` / `units` on the HTTP response (`chat.ts:339-374`). `insertMessage` stores `content` only (`chat.ts:896-914`). The last-12 history sent to the model is `{ role, content }` from `loadMessages` (`chat.ts:300-302`).

`persistProposedUnits` (`chat.ts:648-664`) loops `mondaysToPersist`, `incomingForWeek`, `replaceWeek`, then `listWeek`. When `decision.ok` is false, persist is skipped (`appliedUnits` undefined). `replaceWeek` (`src/lib/services/plan.ts:279-309`) upserts incoming rows and **deletes leftover dates** in the week; empty incoming → empty `listWeek` after.

Admin Algorithm feedback renders `report.body` in a single `<p className="whitespace-pre-wrap">` (`src/components/admin/AdminReports.tsx:96`). No `<pre>`, no “Technical payload”. Flag chrome is **Flag for admin** / **Reported to admin** in `PlanChat.tsx` (not in this change’s file list).

Auto-capture `shouldCaptureHardBoundReport` / `buildHardBoundReport` (`kind: algorithm_proposal`) is a different path and stays. `completeSendTurn` already loads `adminCoachNotes` onto `firstRequest`; `openai-chat.ts` injects `Admin coach notes:` on every completion and `Member coach notes:` on first-pass when set. Do not drop either.

Wave-audit `research.md` `git_commit` is older than this HEAD (`admin-coach-notes` + `load-chart-tabs` already on the branch). Treat research as a hint; files above are verified on this worktree.

## Desired End State

A member Flags the latest assistant turn. The `kind: gap` row’s `body` still starts with the same user+assistant prose, then a technical JSON snapshot captured at that Send: `mutations`, `validation` (hard/soft), `dataRequest` / loaded range, and persist `{ proposedCount, appliedCount, weeksWritten }`. On `/admin` Algorithm feedback, prose stays in the existing paragraph; the JSON appears under a **Technical payload** label in a `<pre>`. `appliedCount: 0` with empty `weeksWritten` is visible when persist did not write (hard skip, or `replaceWeek` left the week empty). Flag copy and placement are unchanged. No `payload` column. Existing reports without the marker look as they do today (no empty `<pre>`).

### Key Discoveries:

- Messages do not store propose JSON. The snapshot must be captured in `sendMessage` and still be available on a later Flag request (Workers isolate is not a durable store).
- `AdminReports` is `client:load`. Do not import `agent-report.ts` (Supabase insert/list) into the island.
- `asChatMessage` / `loadMessages` feed PlanChat and the last-12 LLM history. If the snapshot is parked on `chat_messages.content`, those readers must see the reply only.
- `reportAssistantGap` already `maybeSingle`s the flagged row — parse the snapshot from **raw** `content` there; `ChatMessage.content` after strip is for the `Assistant:` prose line.
- Repo-wide `npm run lint` is already red at HEAD on untouched training-load / pace-estimate files. Phase gates use scoped tests, touched-file eslint, `npx astro check` — not repo-wide `npm run lint`.

## What We're NOT Doing

- Option (a): migration adding `payload jsonb` on `agent_reports`; any new `payload` column/table.
- Notifying the member on Reviewed.
- Dropping hard-bound auto-capture (`shouldCaptureHardBoundReport` / `buildHardBoundReport`).
- Changing the LLM picker or restyling the Chat model card notes UI (`AdminLlmSettings`).
- Shipping a hardcoded admin row.
- Changing **Flag for admin** / **Reported to admin** copy or placement (`PlanChat.tsx` stays).
- Touching `src/pages/admin.astro` (isAdmin 404 stays).
- Dropping `Admin coach notes:` or `Member coach notes:` inject.
- Playwright / e2e (test-plan §6.3).
- Fixing HEAD lint in `TrainingLoadChart.tsx` / `training-load.ts` / `training-load.test.ts` / `pace-estimate.test.ts`.

## Implementation Approach

Three phases: (1) snapshot type + append/split on `body` + `buildGapReport`; (2) capture at Send onto the assistant row, Flag reads it into `buildGapReport`; (3) Admin `<pre>` under prose.

## Critical Implementation Details

**Hold until Flag.** Persist the snapshot on the assistant `chat_messages.content` after a machine sentinel (`\n\n<!--hf-technical-payload-->\n` + `JSON.stringify(snapshot, null, 2)`). Do not use `--- technical payload ---` as the splitter — a coach reply could contain that phrase. Strip the suffix in `asChatMessage` so PlanChat and last-12 history stay reply-only. `reportAssistantGap` parses the snapshot from the raw flagged row (`data.content` before strip), then passes the snapshot as a separate argument to `buildGapReport` and the stripped `ChatMessage` for title / `Assistant:` prose. Do not use a process-local Map (lost across Worker isolates). Do not add a column.

**Stamp after persist.** Change `insertMessage` to `.insert(…).select("id")` and return the new id (same pattern as `createThread` at `chat.ts:162-166`; memory-supabase `stampRow` assigns UUID when `.select()` sets returning). After persist returns or is skipped, UPDATE that id’s `content` to reply + sentinel + JSON so `appliedCount` is known. Log-only and empty-mutation turns stamp too (`mutations: []`, `appliedCount: 0`, `weeksWritten: []`). Assistant insert may stay before persist (today’s order).

**Persist summary.** `proposedCount` = `proposed.mutations.length`. When persist is skipped (`decision.ok` false) or `listWeek` after `replaceWeek` is empty: `appliedCount: 0`, `weeksWritten: []`. Otherwise `appliedCount` = written unit count and `weeksWritten` = unique `utcMondayOf(date)` from those units, sorted. `validation` is `decision.validation` when mutations ran, else `{ hard: [], soft: [] }`. `dataRequest` is `loadedRange` (`null` when none).

**Missing snapshot.** Flag of a pre-change message (no sentinel) still inserts prose-only `kind: gap` and returns 200. Do not 500.

**Admin split.** Same sentinel in `agent_reports.body`. Island splits on the first marker; prose in the existing `<p>`; payload in `<pre>` only when the suffix parses as JSON. Do not import `src/lib/services/agent-report.ts` from the island.

**Hard-bound path.** Do not append this JSON to `buildHardBoundReport` bodies.

---

## Phase 1: Snapshot type and gap-report body append

### Overview

Define the snapshot DTO, teach `buildGapReport` to append pretty JSON after the existing prose, and export a splitter the tests (and later the island, by copying the marker) can lock.

### Changes Required:

#### 1. Snapshot type

**File**: `src/types.ts`

**Intent**: Shared shape for the Flag technical payload (capture, `body` JSON, admin `<pre>`).

**Contract**: Add `FlagTurnSnapshot` with `mutations: UnitMutation[]`, `validation: ValidateResult`, `dataRequest: LoadedRange | null`, and `persist: { proposedCount: number; appliedCount: number; weeksWritten: string[] }`. Do not add a `payload` field on `AgentReport`. `AgentReport.body` stays `string`.

#### 2. Append + split

**File**: `src/lib/services/agent-report.ts`

**Intent**: Option (b) — same JSON appended to `body`; existing prose unchanged; hard-bound builder untouched.

**Contract**:
- Machine marker exactly `<!--hf-technical-payload-->` on its own line after a blank line following the prose. Admin **label** stays `Technical payload` (Phase 3); do not use the label sentence as the splitter.
- `buildGapReport` gains optional `snapshot?: FlagTurnSnapshot`. Title and `User:` / `Assistant:` lines always use `ChatMessage.content` (stripped reply). When `snapshot` is present, `body` is that prose + `\n\n<!--hf-technical-payload-->\n` + `JSON.stringify(snapshot, null, 2)`. When absent, today’s prose-only body.
- Export `splitAgentReportBody(body: string): { prose: string; technical: string | null }` — first marker splits; suffix that fails `JSON.parse` → `technical: null` and full `body` as prose (do not eat the message).
- `buildHardBoundReport` / `insertAgentReport` column list unchanged (still no `payload`).

#### 3. Unit tests

**File**: `src/lib/services/agent-report.test.ts`

**Intent**: Prose preserved; snapshot round-trips; missing snapshot stays old shape (test-plan §6.1).

**Contract**: `buildGapReport` without snapshot: body contains `User:` / `Assistant:`, does not contain `<!--hf-technical-payload-->`. With snapshot: prose still present; parsed technical JSON has `mutations`, `validation.hard`/`soft`, `dataRequest`, `persist.appliedCount`. `splitAgentReportBody` on a hard-bound-style body (no marker) returns `technical: null`. `buildHardBoundReport` body still has no marker. Title must not include the sentinel or JSON.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/agent-report.test.ts`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 2: Capture at Send and attach on Flag

### Overview

Stamp the snapshot onto the assistant message at Send; Flag reads it into `buildGapReport`. Chat replies and LLM history stay snapshot-free.

### Changes Required:

#### 1. Encode / decode on chat messages

**File**: `src/lib/services/chat.ts`

**Intent**: Durable hold until Flag without a new column; member-visible content unchanged.

**Contract**:
- Same marker as Phase 1 (`<!--hf-technical-payload-->`). Encode = reply + `\n\n<!--hf-technical-payload-->\n` + pretty JSON. Decode = strip suffix for `ChatMessage.content`; parse snapshot from raw when present.
- `asChatMessage` sets `content` to the stripped reply (user rows unchanged).
- `insertMessage` returns the new row id via `.insert(…).select("id")` (void signature today — change it). After each `sendMessage` path that inserts an assistant row, UPDATE that id to encoded reply+snapshot. Include log-only and empty-mutation turns. Stamp **after** persist returns or is skipped so `appliedCount` is correct.
- Do not leave the sentinel in `listChat` / `loadMessages` output.
- Keep `getStoredCoachNotes` on `firstRequest` and do not touch `openai-chat.ts`.
- Keep `shouldCaptureHardBoundReport` / `buildHardBoundReport` / `insertAgentReport` on the hard path.

#### 2. Flag uses the snapshot

**File**: `src/lib/services/chat.ts` (`reportAssistantGap`)

**Intent**: Gap `body` includes the Send snapshot when the flagged row has one.

**Contract**: Parse snapshot from the flagged row’s raw `content`. Pass it to `buildGapReport`. `Assistant:` line uses stripped reply (never dump JSON into the prose). Missing/invalid snapshot → current prose-only insert. Latest-assistant / 404 rules unchanged.

#### 3. Send + Flag tests

**File**: `src/lib/services/chat.test.ts`

**Intent**: Capture, strip, and Flag round-trip (test-plan §6.2). Prove `appliedCount: 0` when persist does not write.

**Contract**:
- After a successful mutating Send, `listChat` / stored history `content` does **not** contain `<!--hf-technical-payload-->`. Raw `chat_messages.content` for that assistant row **does**.
- Flag that message: `agent_reports.body` contains the prose and `"appliedCount"`; JSON includes the mutation date and persist counts.
- Hard-blocked Send (existing huge-Friday case): Flag the assistant reply → `persist.appliedCount === 0` and `weeksWritten` is `[]`; `proposedCount >= 1`. Auto `algorithm_proposal` row still inserted (do not drop it).
- Existing “inserts a gap report for the latest assistant reply” (no sentinel on the seed row) still 200 with prose-only body (no marker required).
- Existing admin-notes extra-follow-up test still sees `adminCoachNotes` on both complete calls.

**File**: `src/pages/api/chat/report.test.ts`

**Intent**: HTTP Flag still 200; stored gap body can carry the marker when the message was stamped.

**Contract**: Existing 401 / 404 / latest-assistant cases stay. The happy-path insert still `kind: gap`. Optional: seed a stamped assistant content and assert `body` contains `<!--hf-technical-payload-->` and `appliedCount`.

**File**: `src/components/plan/PlanChat.test.ts`

**Intent**: S-10.6 — do not change Flag copy.

**Contract**: Existing assertions for `Flag for admin` and `Reported to admin` still pass (file is not modified unless a test is added that re-asserts those strings).

### Success Criteria:

#### Automated Verification:

- `npm test -- src/lib/services/chat.test.ts src/pages/api/chat/report.test.ts src/lib/services/agent-report.test.ts src/components/plan/PlanChat.test.ts src/lib/services/openai-chat.test.ts`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`

---

## Phase 3: Admin Algorithm feedback technical `<pre>`

### Overview

Show the appended JSON under the prose on `/admin` Algorithm feedback. Do not restyle the Chat model card.

### Changes Required:

#### 1. AdminReports list item

**File**: `src/components/admin/AdminReports.tsx`

**Intent**: S-10.3 — snapshot in a `<pre>` under the prose, labeled Technical payload.

**Contract**: Split `report.body` on the first `<!--hf-technical-payload-->` marker **inside this file** (do not import `agent-report.ts`). Existing `<p className="whitespace-pre-wrap">` renders prose only. When a technical suffix exists, render a label `Technical payload` and `<pre>` with that suffix (trimmed). Use `cn()` for any extra classes on `<pre>` (e.g. overflow/wrap). No `<pre>` when there is no marker. Title, kind/status, week, Reviewed button, and error chrome unchanged.

#### 2. Source-read lock

**File**: `src/components/admin/AdminReports.test.ts` (new)

**Intent**: CI-cheap lock without Playwright (same pattern as `PlanChat.test.ts` / `AdminLlmSettings.test.ts`).

**Contract**: `readFileSync` of sibling `AdminReports.tsx`. Assert visible label `Technical payload`, a `<pre`, machine marker `<!--hf-technical-payload-->`, and existing `whitespace-pre-wrap` on the prose paragraph. Assert the file does not import `@/lib/services/agent-report`.

### Success Criteria:

#### Automated Verification:

- `npm test -- src/components/admin/AdminReports.test.ts src/lib/services/agent-report.test.ts src/lib/services/chat.test.ts src/pages/api/chat/report.test.ts src/components/plan/PlanChat.test.ts src/lib/services/openai-chat.test.ts`
- `npm test`
- Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`)
- `npx astro check`
- `npm run build`

#### Manual Verification:

- Flag a coach turn that claimed a calendar write but persist did not apply; `/admin` Algorithm feedback shows Technical payload with `"appliedCount": 0`
- Flag copy on the chat transcript is still **Flag for admin** / **Reported to admin**
- Signed-out or non-admin GET `/admin` is still 404; Chat model card notes UI is unchanged

---

## Testing Strategy

### Unit Tests:

- `buildGapReport` with/without snapshot; `splitAgentReportBody`; hard-bound body has no marker
- AdminReports source-read: label, `<pre`, marker, no agent-report import
- PlanChat source-read: Flag copy unchanged

### Integration Tests:

- Send stamps raw assistant content; `listChat` is stripped
- Flag after mutating Send includes snapshot JSON on `agent_reports.body`
- Flag after hard-blocked Send: `appliedCount` 0, `weeksWritten` [], `algorithm_proposal` still captured
- Flag of unstamped (legacy) assistant: prose-only 200
- `POST /api/chat/report` 401/404 unchanged
- openai-chat Member + Admin coach notes inject tests still pass

### Manual Testing Steps:

1. Send a change, Flag the reply, open `/admin` Algorithm feedback: prose + Technical payload with mutations and persist counts
2. Force a persist-skip / empty write if possible; confirm `"appliedCount": 0` is obvious in the `<pre>`
3. Non-admin `/admin` still 404; Flag button copy unchanged

## Performance Considerations

One UPDATE of the assistant `chat_messages` row per Send. JSON size is bounded by the already-sanitized `mutations` array plus validation lists. Admin list already loads `body` (limit 100). No extra LLM tokens if `asChatMessage` strips before history.

## Migration Notes

None. Option (b) only — append to `body`. No hosted SQL. Worker rollback reverts the Worker; existing `body` text with a marker remains readable as prose+JSON.

## References

- Related research: `context/changes/flag-admin-technical/research.md`
- Notes: `context/changes/flag-admin-technical/change.md`
- S-06 capture: `src/lib/services/agent-report.ts`, `src/pages/api/chat/report.ts`
- Persist: `src/lib/services/chat.ts` `persistProposedUnits` / `src/lib/services/plan.ts` `replaceWeek`
- Test-plan §6.1 (unit), §6.2 (memory persist), §6.3 (no Playwright)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Snapshot type and gap-report body append

#### Automated

- [x] 1.1 `npm test -- src/lib/services/agent-report.test.ts` — b2a95f7
- [x] 1.2 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — b2a95f7
- [x] 1.3 `npx astro check` — b2a95f7

### Phase 2: Capture at Send and attach on Flag

#### Automated

- [x] 2.1 `npm test -- src/lib/services/chat.test.ts src/pages/api/chat/report.test.ts src/lib/services/agent-report.test.ts src/components/plan/PlanChat.test.ts src/lib/services/openai-chat.test.ts` — b221722
- [x] 2.2 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — b221722
- [x] 2.3 `npx astro check` — b221722

### Phase 3: Admin Algorithm feedback technical `<pre>`

#### Automated

- [x] 3.1 `npm test -- src/components/admin/AdminReports.test.ts src/lib/services/agent-report.test.ts src/lib/services/chat.test.ts src/pages/api/chat/report.test.ts src/components/plan/PlanChat.test.ts src/lib/services/openai-chat.test.ts` — bc05d69
- [x] 3.2 `npm test` — bc05d69
- [x] 3.3 Touched-file eslint green: `npx eslint` on every `src/**` file this phase modified (not repo-wide `npm run lint`) — bc05d69
- [x] 3.4 `npx astro check` — bc05d69
- [x] 3.5 `npm run build` — bc05d69

#### Manual

- [ ] 3.6 Flag a coach turn that claimed a calendar write but persist did not apply; `/admin` Algorithm feedback shows Technical payload with `"appliedCount": 0`
- [ ] 3.7 Flag copy on the chat transcript is still **Flag for admin** / **Reported to admin**
- [ ] 3.8 Signed-out or non-admin GET `/admin` is still 404; Chat model card notes UI is unchanged
