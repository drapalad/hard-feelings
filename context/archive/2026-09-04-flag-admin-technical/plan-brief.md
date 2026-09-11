# Flag for admin stores technical propose and persist JSON — Plan Brief

> Full plan: `context/changes/flag-admin-technical/plan.md`
> Research: `context/changes/flag-admin-technical/research.md`

## What & Why

When a member Flags a coach reply, Admin today sees user+assistant prose only. The interesting failure — “coach said it worked, calendar did not” — lives in mutations, validation, dataRequest, and persist `appliedCount`, which are computed at Send and never stored. This slice appends that snapshot to `agent_reports.body` (option **(b)**, no migration) and shows it in a `<pre>` on Algorithm feedback.

## Starting Point

`buildGapReport` concatenates `User:` / `Assistant:` from `chat_messages.content`. Send persists via `replaceWeek` but Flag does not read that result. `agent_reports` has no `payload` column. Admin renders `body` as one pre-wrap paragraph.

## Desired End State

Flagged turns on `/admin` show mutations, validation, dataRequest, and persist counts under **Technical payload**. `"appliedCount": 0` with empty `weeksWritten` is obvious. Flag chrome and hard-bound auto-capture stay. No `payload jsonb`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage | Option (b): append JSON to `agent_reports.body`; no migration | Notes lock (b) and forbid `payload jsonb` | Notes |
| Capture timing | Snapshot at Send, not reconstructed at Flag | Messages do not hold propose JSON; persist result exists only on the Send path | Notes / Research |
| Hold until Flag | Stamp snapshot on assistant `chat_messages.content` behind `<!--hf-technical-payload-->`; strip in `asChatMessage` | Workers isolates drop an in-memory Map; a new column is option (a); HTML comment avoids splitting on coach prose | Unattended |
| Persist zeros | `appliedCount: 0`, `weeksWritten: []` when persist is skipped or `listWeek` after `replaceWeek` is empty | Diagnoses “said it worked, calendar did not”; matches Notes S-10.4 | Plan |
| `proposedCount` | `proposed.mutations.length` | Snapshot is the propose JSON; unit count after persist is `appliedCount` | Unattended |
| Missing snapshot | Flag still 200, prose-only body | Legacy messages and parse failures must not block Flag | Unattended |
| Admin UI | Split on marker in `AdminReports`; `<pre>` only when suffix exists; no import of `agent-report.ts` | Island is `client:load`; existing reports must not grow an empty `<pre>` | Unattended |
| Out of scope | No member notify; keep hard-bound capture, LLM picker, isAdmin 404, Flag copy, both coach-notes injects | Notes + HEAD you must not regress | Notes |

## Scope

**In scope:** `FlagTurnSnapshot` type; `buildGapReport` append; Send stamp + Flag read; Admin **Technical payload** `<pre>`; tests on the listed files / colocated tests.

**Out of scope:** `payload jsonb`; PlanChat copy changes; `admin.astro`; AdminLlmSettings restyle; Playwright; HEAD lint in training-load / pace-estimate.

## Architecture / Approach

Send computes the snapshot after persist (or skip), writes reply + `<!--hf-technical-payload-->` + JSON onto the assistant row (`insertMessage` returns id via `.select("id")`), and strips the suffix for ChatMessage/history. Flag parses the raw row into `buildGapReport`, which appends the same marker+JSON onto `agent_reports.body`. Admin splits `body` for prose vs `<pre>` (visible label **Technical payload**).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Type + body append | `buildGapReport` option (b) format | Marker collision with existing prose |
| 2. Send stamp + Flag | Durable snapshot; `appliedCount: 0` case | Leaking JSON into LLM history / chat UI |
| 3. Admin `<pre>` | Visible technical payload | Importing server `agent-report.ts` into the island |

**Prerequisites:** Branch already includes `admin-coach-notes` + `load-chart-tabs`. Keep both coach-notes injects.
**Estimated effort:** ~1 session, 3 phases.

## Open Risks & Assumptions

- Stamping on `content` is a storage hack until a later `payload` column (explicitly not this slice). Human sanity-check: FU-140.
- `replaceWeek` with empty incoming deletes leftover dates; `appliedCount` uses post-write `listWeek` length, not upsert row count.

## Success Criteria (Summary)

- Flag stores mutations + validation + dataRequest + persist counts on the gap `body`
- `/admin` shows that JSON under Technical payload; `appliedCount: 0` is readable
- Flag copy, isAdmin 404, hard-bound capture, and both coach-notes injects unchanged
