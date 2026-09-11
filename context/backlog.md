---
project: hard-feelings
created: 2026-08-14
updated: 2026-09-05
status: open
---

# HardFeelings — Follow-up backlog

Living list of follow-ups that need a human look but were **not** done by the run that found them. Append anytime; pick one up in a free moment. Each item is `FU-NNN`.

This file exists so an unattended run (`/10x-unattended`, `/10x-goal-implement`) never has to choose between stalling on a question and losing it. The run decides, ships, and records the decision here — the human reviews later. Items outlive the change that produced them: change folders move to `context/archive/` and go read-only, this file does not.

## Where an item belongs

One item, one home. Route by kind, not by who found it:

| Kind of work | Home |
| --- | --- |
| Deploy, infra, hosted-Supabase SQL, Cloudflare | `context/deployment/deferred.md` (`DEP-NNN`) — required by `AGENTS.md` |
| Product decision, code follow-up, deferred review finding, open question, halted run | this file (`FU-NNN`) |
| A recurring rule that should shape future planning and reviews | `context/foundation/lessons.md` (via `/10x-lesson`) |
| A whole user-visible capability | `context/foundation/roadmap.md` as a slice, not a backlog item |

A deferred finding that needs a hosted-DB step is a `DEP`, not an `FU`. A deferred finding that needs code is an `FU`, not a `DEP`.

## How to use

1. **Do work** — set `Status: done`, tick the checkbox, leave a one-line note.
2. **Add work** — copy the template below, bump the next free `FU-NNN` id, fill **Source** (where the ask came from: change-id, review finding, plan section, chat) and **Next step**.
3. **Promote** — when an item deserves its own change, run `/10x-new <change-id>`, record that change-id in **Notes**, and set the item `Status: done`. It is now tracked by the change.
4. Keep **open** items at the top; move **done** under `## Done` (or leave in place with `Status: done`).

**Next step** is what makes an item actionable later — it names the move that closes the item, so a future session can pick it up without rereading the run that created it.

### Item template (copy)

```markdown
### FU-NNN — Short title
- [ ] **Status:** open
- **Kind:** decision | finding | question | run-stop
- **Source:** change-id / path / review finding id — optional quote or pointer
- **Added:** YYYY-MM-DD
- **Next step:** what would close this (`/10x-new <id>`, one-line fix, a human answer, apply `DEP-NNN`)
- **Notes:** optional context / acceptance
```

**Kind** values:

- `decision` — an agent picked one of several defensible readings and shipped it. Worth a human sanity-check; not a bug. **Next step** should name the alternative (`/10x-new <id>` to take the other reading, or confirm and close).
- `finding` — a review finding consciously left unfixed (`Decision: DEFERRED — FU-NNN` in the review report).
- `question` — nothing on disk could answer it; the run **assumed the most natural reading and shipped it**. Stronger than `decision`: a guess. **Next step** should name how a later session closes it (`confirm and set Status: done`, or `/10x-new <id>` to reverse). If both `question` and `decision` apply, use `question`.
- `run-stop` — an unattended run halted here. Carries the STOP block's Expected / Found / Why and its exact `Resume:` command.

---

## Open

### FU-132 — Stage-bar minute width should use profile pace estimates
- [ ] **Status:** open
- **Kind:** decision
- **Source:** workout-stages-chart / FU-128 human 2026-09-03
- **Added:** 2026-09-03
- **Next step:** when profile stores per-intensity pace estimates, replace `MIN_PER_KM` in `src/components/plan/workout-stages.ts` with those values (easy vs work as appropriate)
- **Notes:** Human 2026-09-03 — keep today's 5:00 /km conversion as the hook. Do not switch to equal-width bars. `race-pace-estimates` is still client-only / not persisted. Human 2026-09-05 — keep waiting.

## Done

### FU-146 — Coach notes Save still requires weekly km after km is cleared
- [x] **Status:** done
- **Kind:** decision
- **Source:** profile-keep-row-on-clear-km / plan-brief Key Decisions — Coach notes Save when km empty
- **Added:** 2026-09-05
- **Done:** 2026-09-05
- **Next step:** `/10x-new profile-notes-save-with-null-km`
- **Notes:** Human 2026-09-05 — take the alternative. Promoted to `context/changes/profile-notes-save-with-null-km/` (status: new). Notes Save must PUT with `weeklyKm: null` when km is empty.

### FU-126 — Interval `N × dist` stays one work stage
- [x] **Status:** done
- **Kind:** question
- **Source:** workout-stages-chart / plan-brief Key Decisions — Interval expansion
- **Added:** 2026-09-03
- **Done:** 2026-09-05
- **Next step:** none — superseded by persisted `unit.stages` (`workout-stages-make-ai`)
- **Notes:** Human 2026-09-05 — obsolete. Read-only/edit bar uses saved stages when present; how many work/recovery Segs is an editor/Make-AI choice, not a Structure-parser question. Text regex remains only as fallback when `stages` is empty (legacy days).

### FU-134 — Empty weekly km DELETE still drops last race
- [x] **Status:** done
- **Kind:** decision
- **Source:** persist-race-result / plan-brief Key Decisions — PUT vs existing DELETE
- **Added:** 2026-09-04
- **Done:** 2026-09-05
- **Next step:** `/10x-new profile-keep-row-on-clear-km`
- **Notes:** Human 2026-09-04 — take the alternative. Promoted 2026-09-05 to `context/changes/profile-keep-row-on-clear-km/` (status: new). Unattended shipped DELETE-the-row because `weekly_km` is NOT NULL.

### FU-133 — Topbar plan nav via GET select vs a React island
- [x] **Status:** done
- **Kind:** decision
- **Source:** topbar-plan-nav / plan-brief Key Decisions — Mobile control
- **Added:** 2026-09-04
- **Done:** 2026-09-05
- **Next step:** `/10x-new topbar-plan-nav-island`
- **Notes:** Human 2026-09-04 — take the island alternative. Promoted 2026-09-05 to `context/changes/topbar-plan-nav-island/` (status: new). Unattended shipped native GET `<select>` + full page load.

### FU-142 — Seed day-edit Segs from regex parse vs empty until Make AI
- [x] **Status:** done
- **Kind:** decision
- **Source:** workout-stages-make-ai / plan-brief Key Decisions — Empty editor
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm empty-until-Make-AI/Add (planned), or `/10x-new workout-stages-seed-from-structure` to pre-fill Segs from `parseWorkoutStages` when `unit.stages` is null
- **Notes:** Human 2026-09-04 — keep empty Segs until Make AI or Add segment.

### FU-141 — Stage chart in the edit form vs read-only panel only
- [x] **Status:** done
- **Kind:** decision
- **Source:** workout-stages-make-ai / plan-brief Key Decisions — Chart during edit
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm chart in edit form from editor stages (planned), or `/10x-new workout-stages-chart-readonly` to recolor only after Save in the read-only panel
- **Notes:** Human 2026-09-04 — keep the stage bar in the edit form.

### FU-143 — Keep rolling currentLoad beside isoWeeks vs replace it
- [x] **Status:** done
- **Kind:** decision
- **Source:** iso-week-bleed-volume / plan-brief Key Decisions — Rolling `currentLoad`
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm keep today−6…today `currentLoad` beside `isoWeeks[]` (planned), or `/10x-new iso-week-drop-rolling-load` to stop sending `currentLoad` once ISO weeks are in the first-pass prompt
- **Notes:** Human 2026-09-04 — keep both `isoWeeks[]` and rolling `currentLoad` in the Coach chat first-pass prompt.

### FU-140 — Hold Flag snapshot on chat_messages.content vs in-memory Map
- [x] **Status:** done
- **Kind:** decision
- **Source:** flag-admin-technical / plan-brief Key Decisions — Hold until Flag
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm content-sentinel + strip on `asChatMessage` (planned), or `/10x-new flag-admin-memory-snapshot` to keep a process-local Map keyed by message id (lost across Worker isolates)
- **Notes:** Human 2026-09-04 — keep JSON parked behind `<!--hf-technical-payload-->` on the assistant row.

### FU-145 — Review card heading when pending is races-only
- [x] **Status:** done
- **Kind:** decision
- **Source:** coach-races-context-accept / plan-brief Key Decisions — Review card heading
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm keep heading `Accept profile & freeze changes` with race lines on the same card (planned), or `/10x-new coach-races-review-heading` to retitle when `races` is present (e.g. include “race”)
- **Notes:** Human 2026-09-04 — keep the shipped heading.

### FU-144 — Calendar Delete workout on a frozen unit
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat-delete-units / plan-brief Key Decisions — Frozen calendar delete
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm `skipFrozen: false` on day-panel delete (planned), or `/10x-new calendar-delete-skip-frozen` to refuse Delete on frozen days like chat
- **Notes:** Human 2026-09-04 — calendar may Delete frozen units (matches Save).

### FU-139 — Store empty admin coach notes as SQL NULL
- [x] **Status:** done
- **Kind:** decision
- **Source:** admin-coach-notes / plan-brief Key Decisions — Empty column
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm NULL (planned), or `/10x-new project-coach-notes-empty-string` to store `""` instead of NULL
- **Notes:** Human 2026-09-04 — keep SQL NULL. Id was FU-137 in the admin-coach-notes worktree; renumbered on merge so it does not collide with load-chart-tabs FU-137.

### FU-138 — One Save vs a dedicated Save notes button
- [x] **Status:** done
- **Kind:** decision
- **Source:** admin-coach-notes / plan-brief Key Decisions — Save UX
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm one **Save model** PATCH of `openaiModel` + `coachNotes` (planned), or `/10x-new admin-coach-notes-split-save` to add a second Save that PATCHes notes only
- **Notes:** Human 2026-09-04 — keep one Save for model + notes.

### FU-137 — Daily load tab copy without decay 0.85
- [x] **Status:** done
- **Kind:** decision
- **Source:** load-chart-tabs / plan-brief Key Decisions — Tab labels
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm `daily load (decay 0.85)` (planned), or `/10x-new load-chart-tab-short-label` to use the Notes example `daily load` without the decay fragment
- **Notes:** Human 2026-09-04 — keep `daily load (decay 0.85)`.

### FU-136 — Store empty coach notes as SQL NULL
- [x] **Status:** done
- **Kind:** decision
- **Source:** user-coach-notes / plan-brief Key Decisions — Empty column
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm NULL (planned), or `/10x-new profile-coach-notes-empty-string` to store `""` instead of NULL
- **Notes:** Human 2026-09-04 — keep SQL NULL.

### FU-135 — Omit `last_race_name` on `profiles`
- [x] **Status:** done
- **Kind:** decision
- **Source:** persist-race-result / plan-brief Key Decisions — `last_race_name`
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Next step:** confirm omit (planned), or `/10x-new persist-race-result-name` to add nullable `last_race_name` and an optional name field on Estimated paces
- **Notes:** Human 2026-09-04 — omit `last_race_name`. Id was FU-133 in the persist worktree; renumbered on merge so it does not collide with topbar-plan-nav FU-133.

### FU-131 — Compact in-column thread list vs a dedicated sidebar column
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat-threading / plan-brief Key Decisions — List chrome
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Next step:** confirm compact collapsible list under Coach chat (planned), or `/10x-new chat-thread-sidebar-column` to add a dedicated sidebar column
- **Notes:** Human 2026-09-03 — keep the compact collapsible list in the chat column.

### FU-130 — Month navigation keeps the active thread
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat-threading / plan-brief Key Decisions — Month navigation
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Next step:** confirm keep-active-thread on month change (planned), or `/10x-new chat-thread-follow-week` to auto-select the thread whose backfill week matches the visible Monday
- **Notes:** Human 2026-09-03 — month chevrons must not swap the conversation. Pending/accept stay week-scoped.

### FU-129 — Threads are user-scoped; `planId` is not a real FK
- [x] **Status:** done
- **Kind:** question
- **Source:** chat-threading / plan-brief Key Decisions — Owner key / `GET …?planId=`
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Next step:** confirm `user_id` ownership and session-scoped `GET /api/chat/threads` (planned), or introduce a `plans` table and `plan_id` FK in a later change
- **Notes:** Human 2026-09-03 — one user, one plan, many chat threads all about that plan. Optional `planId` query stays ignored.

### FU-128 — Time-to-width conversion at 5:00 /km
- [x] **Status:** done
- **Kind:** question
- **Source:** workout-stages-chart / plan-brief Key Decisions — Mixed units width
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Next step:** confirm 5:00 /km for minute clauses (planned), or `/10x-new workout-stages-equal-width` to give every clause equal weight
- **Notes:** Human 2026-09-03 — keep 5:00 /km as the conversion hook until profile pace estimates exist; follow-up is FU-132. Do not switch to equal-width bars.

### FU-127 — Stage bar alongside structure text (not instead of)
- [x] **Status:** done
- **Kind:** decision
- **Source:** workout-stages-chart / plan-brief Key Decisions — Placement
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Next step:** confirm keep the structure sentence under the bar (planned), or `/10x-new workout-stages-replace-text` to hide the sentence in read-only view
- **Notes:** Human 2026-09-03 — keep the structure sentence under the bar.

### FU-125 — Drop leftover pending-proposition layer (Accept API + rejectPending)
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat 2026-09-02 after chat-auto-apply — `rejectPending` / `POST /api/chat/accept`
- **Added:** 2026-09-02
- **Done:** 2026-09-03
- **Next step:** `/10x-new chat-drop-pending-propositions`
- **Notes:** Human 2026-09-03 — promoted to `context/changes/chat-drop-pending-propositions/` (plan only). Keep profile/freeze Accept; drop leftover `plan_propositions` calendar layer. Leftover propositions still win over profile/freeze pending until that change ships.

### FU-124 — Two range GETs at cap 56 vs raise-and-union
- [x] **Status:** done
- **Kind:** decision
- **Source:** training-load-chart / plan-brief Key Decisions — Fetch
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm month GET + 8-week GET merged by date with `MAX_PLAN_GET_RANGE_DAYS = 56` (planned), or `/10x-new training-load-union-get` to raise the cap (~70+) and issue one union GET when the visible month is near today
- **Notes:** Human 2026-09-02 — keep two GETs; the browsed month can be far from today so a single union GET is not enough. Unattended 2026-09-02 — locked Notes require an 8-week GET and cap “at least 56”. Current-month grid ∪ chart window is ~70 days, so one union GET cannot stay at 56.

### FU-123 — Load chart window follows UTC today, not the visible month
- [x] **Status:** done
- **Kind:** question
- **Source:** training-load-chart / plan-brief Key Decisions — Window
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm eight weeks from `utcMondayOf(utcToday())` (planned), or `/10x-new training-load-follow-visible-month` to slide the window with `visibleMonth`
- **Notes:** Human 2026-09-02 — keep today-relative window for now. Unattended 2026-09-02 — locked Notes require five past Mondays + current + two future but do not name the origin.

### FU-122 — Second coach completion throw keeps the first reply
- [x] **Status:** done
- **Kind:** question
- **Source:** coach-data-request / plan-brief Key Decisions — Second `complete` throws
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** `/10x-new coach-data-request-fail-closed` — fail Send like a first-call LLM error (`COACH_UNAVAILABLE` / red), do not keep or auto-apply the first propose
- **Notes:** Human 2026-09-02 — prefer red error over keep-first. Tracked by `coach-data-request-fail-closed`. Unattended 2026-09-02 — keep-first was the shipped reading.

### FU-121 — Send stays HTTP 200 when hard blocks (not 409)
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat-auto-apply / plan-brief Key Decisions — HTTP when hard blocks Send
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm 200 + `validation.hard` on `POST /api/chat/messages` (planned), or `/10x-new chat-auto-apply-hard-409` to return 409 like Accept
- **Notes:** Human 2026-09-02 — keep 200 + red list. Unattended 2026-09-02 — Send is still a successful chat turn (assistant reply stored). Accept keeps 409.

### FU-120 — Skip pending proposition rows on Send (apply and hard)
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat-auto-apply / plan-brief Key Decisions — Pending proposition on Send
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm `rejectPending` and no `insertPending` (planned), or `/10x-new chat-auto-apply-pending-audit` to insert `status: "accepted"` on apply and/or keep `pending` on hard for audit
- **Notes:** Human 2026-09-02 — keep `rejectPending` and no `insertPending`. Unattended 2026-09-02 — locked Notes say do not leave status pending when applying. Whole pending layer is FU-125.

### FU-119 — applyMutations skips frozen for chat; calendar edits still patch frozen
- [x] **Status:** done
- **Kind:** decision
- **Source:** generate-via-chat / Phase 1 — applyMutations skip frozen vs applyUnitEdit
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm chat skips frozen and day-panel Save still patches frozen via `skipFrozen: false`, or `/10x-new calendar-edit-skip-frozen` to refuse calendar edits on frozen days too
- **Notes:** Human 2026-09-02 — freeze blocks the coach, not the day-panel Save. Unattended 2026-09-02 — `applyUnitEdit` passes `{ skipFrozen: false }`.

### FU-118 — Accept persist uses accept-time UTC today for the keep-merge
- [x] **Status:** done
- **Kind:** decision
- **Source:** generate-via-chat / plan-brief Open Risks — Horizon at Accept
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm recompute `utcToday()` at Accept (planned), or `/10x-new generate-via-chat-store-horizon` to persist `createFrom`/`createTo` on the pending proposition
- **Notes:** Human 2026-09-02 — keep live `utcToday()` at persist; Accept UI is gone, keep-merge still used on Send. Unattended 2026-09-02 — no schema change in this slice.

### FU-117 — Generate chat stays on the visible weekStart
- [x] **Status:** done
- **Kind:** decision
- **Source:** generate-via-chat / plan-brief Key Decisions — Chat `weekStart` for the turn
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm send on the open Coach chat’s `weekStart` (planned), or `/10x-new generate-chat-snap-to-today` to switch `weekStart` / visible month to `utcMondayOf(utcToday())` when the purple button is clicked
- **Notes:** Human 2026-09-02 — canned generate stays on the visible week’s chat panel. Unattended 2026-09-02 — horizon is still UTC today…+13.

### FU-116 — Omit Rest on race-only calendar cells
- [x] **Status:** done
- **Kind:** decision
- **Source:** races-on-calendar / plan-brief Key Decisions — Cell Rest vs race
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm omit Rest on race-only in-month cells (planned), or `/10x-new calendar-race-keep-rest-label` to show Rest plus the Flag marker on those cells
- **Notes:** Human 2026-09-02 — omit Rest on race-only cells. Unattended 2026-09-02 — day panel still says rest when there is no unit.

### FU-115 — Save snapshot outline vs purple
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-month-polish / plan-brief Key Decisions — Save snapshot chrome
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm outline/`sm` Save snapshot beside purple generate (planned), or `/10x-new calendar-snapshot-purple-cta` to style Save snapshot as a second purple button
- **Notes:** Human 2026-09-02 — keep outline Save snapshot; generate stays purple. Unattended 2026-09-02 — locked Notes call it the primary **history** CTA.

### FU-114 — Dirty state via GET `latestSnapshotUnits`
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-month-polish / plan-brief Key Decisions — Dirty after reload
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm GET `/api/plan` `latestSnapshotUnits` (planned), or `/10x-new calendar-snapshot-client-dirty` to track dirty only in the session without that GET field
- **Notes:** Human 2026-09-02 — keep dirty-after-reload via GET field. Unattended 2026-09-02 — GET summaries alone cannot compare after F5.

### FU-104 — One combined Save vs Save schedule + Save mix
- [x] **Status:** done
- **Kind:** decision
- **Source:** profile-plan-prefs / plan-brief Key Decisions — Save UX
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm one Save on the weekly-km form (planned), or `/10x-new profile-plan-prefs-split-save` to add separate Save schedule / Save mix buttons that each PUT
- **Notes:** Human 2026-09-02 — one Save. Unattended 2026-09-02 — one PUT matches the single `profiles` row.

### FU-095 — List loads via GET from/to vs month payload
- [x] **Status:** done
- **Kind:** decision
- **Source:** dashboard-list-chrome / plan-brief Key Decisions — List data load
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm client GET `/api/plan?from=&to=` for the list window (planned), or `/10x-new dashboard-list-from-month` to filter the month units already on `PlanWorkspace` (or SSR `listRange` in `dashboard.astro`)
- **Notes:** Human 2026-09-02 — keep dedicated GET. Unattended 2026-09-02 — month grid can end before today+21; fetch-when-active avoids a stale list.

### FU-094 — List window 21 days vs 14
- [x] **Status:** done
- **Kind:** decision
- **Source:** dashboard-list-chrome / plan-brief Key Decisions — List window length
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm 21 inclusive UTC days (planned), or `/10x-new dashboard-list-14-day-window` to use 14
- **Notes:** Human 2026-09-02 — keep 21 days. Unattended 2026-09-02 — locked Notes allowed 14–21; 21 covers ~three weeks on a phone list.

### FU-093 — Keep day panel open after successful save
- [x] **Status:** done
- **Kind:** question
- **Source:** calendar-day-panel / plan-brief Key Decisions — After successful save
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm keep-open (planned), or `/10x-new calendar-day-panel-close-on-save` to dismiss the panel after Save / Save log / Freeze / Unlog
- **Notes:** Human 2026-09-02 — keep panel open after save. Unattended 2026-09-02 — nothing on disk said whether the panel stays open. Keep-open lets the member chain log/freeze; Close, Escape, and same-day click still dismiss. Closing on save is the other reading.

### FU-092 — Day selection uses aria-pressed, not aria-current
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-day-panel / plan-brief Key Decisions — Selection a11y
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm `aria-pressed` on the in-month day button (planned), or `/10x-new calendar-day-panel-aria-current` to mark the selected day with `aria-current="date"`
- **Notes:** Human 2026-09-02 — keep `aria-pressed`. Unattended 2026-09-02 — locked Notes allowed `aria-pressed` or `aria-current`. Today already uses `aria-current="date"` on the month-nav control, so the selected cell uses `aria-pressed`.

### FU-091 — Always-visible log km field vs Log-click-to-reveal
- [x] **Status:** done
- **Kind:** question
- **Source:** calendar-day-panel / plan-brief Key Decisions — Log field visibility
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm always-visible km + Save log on the planned-unit panel (planned), or `/10x-new calendar-day-panel-log-reveal` to hide the field until a Log control is clicked
- **Notes:** Human 2026-09-02 — keep always-visible km + Save log. Unattended 2026-09-02 — locked Notes say do not POST on the first click and describe a km field + Save log. Always showing the field in the panel is the natural reading (room in the panel; “first click” referred to the old icon POST). Revealing the field only after a Log click is the other reading of “first click.”


### FU-090 — CI lock that Welcome.test.ts stays absent
- [x] **Status:** done
- **Kind:** decision
- **Source:** landing-welcome-no-unit-test / plan-brief Key Decisions — CI absence lock
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm implementer-only `test ! -e` (planned), or `/10x-new landing-welcome-test-absence-gate` to assert in `quality-gates.test.ts` that `src/components/Welcome.test.ts` does not exist
- **Notes:** Human 2026-09-02 — deletion is enough; do not add a CI absence lock. Unattended 2026-09-02 — locked Notes forbid a replacement unit test and keep chrome off CI. A quality-gates absence lock would stop the file coming back but is itself a new CI assertion. Implementer Automated 1.1 / 1.6 cover this run only.

### FU-089 — Merge week slice vs refetch month after generate
- [x] **Status:** done
- **Kind:** decision
- **Source:** month-calendar / plan-brief Key Decisions — Week mutations
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm `mergeWeekSlice` after generate/accept/restore (planned), or `/10x-new month-calendar-refetch-month` to GET the visible month again after those POSTs
- **Notes:** Human 2026-09-02 — keep `mergeWeekSlice` (shipped). Unattended 2026-09-02 — generate/accept/restore return one week. Merging that week into month state avoids a second round-trip; refetching the month after every generate is the other defensible reading.

### FU-088 — Range GET vs repeated weekStart fetches
- [x] **Status:** done
- **Kind:** decision
- **Source:** month-calendar / plan-brief Key Decisions — Month data load
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** confirm GET `/api/plan?from=&to=` (planned), or `/10x-new month-calendar-week-gets` to call existing `?weekStart=` once per Monday in the grid
- **Notes:** Human 2026-09-02 — keep GET `/api/plan?from=&to=` (shipped). Unattended 2026-09-02 — locked notes allowed either. Range GET is one round-trip and matches `listWeek`’s `.in("date", dates)` (memory persist has no `gte`/`lte`). Repeated week GETs would avoid a new query contract.

### FU-068 — Tab click replaces the whole query with `?tab=` only
- [x] **Status:** done
- **Kind:** decision
- **Source:** dashboard-tab-url / plan-brief Key Decisions — Query on click
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** `/10x-plan dashboard-tab-preserve-search` (promoted; do not re-open this FU)
- **Notes:** Human 2026-09-02 — preserve other query params; tracked by `dashboard-tab-preserve-search`. Unattended 2026-09-02 — `replaceState` writes `pathname?tab=<id>` and drops other params/hash. Notes said “same pathname with `?tab=`” and “do not invent other query params”; preserving unrelated params was the other defensible reading.

### FU-058 — Source Vitest for signup chrome vs grep-only
- [x] **Status:** done
- **Kind:** decision
- **Source:** signup-with-nav / plan-brief Key Decisions — Testing
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** `/10x-plan signup-chrome-no-unit-test` (promoted; do not re-open this FU)
- **Notes:** Human 2026-09-02 — drop the colocated test; tracked by `signup-chrome-no-unit-test`. Sibling `signin-with-nav` shipped with no new tests (chrome source-gated). This run added a `readFileSync` lock because the orchestrator allowed UI tests and `PlanChat.test.ts` already uses that pattern. Not Playwright (test-plan §6.3).

### FU-048 — Source-read Welcome test vs grep-only chrome gates
- [x] **Status:** done
- **Kind:** decision
- **Source:** landing-feature-solid / plan-brief Key Decisions — Testing
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Next step:** `/10x-plan landing-welcome-no-unit-test` (promoted; do not re-open this FU)
- **Notes:** Human 2026-09-02 — drop the colocated test; tracked by `landing-welcome-no-unit-test`. Unattended 2026-09-02 — shipped a PlanChat-style source-read test because the class tokens are CI-assertable and the invocation allowed UI tests. Sibling chrome changes used grep-only.


### FU-037 — Keep PlanWorkspace mounted when Profile is selected
- [x] **Status:** done
- **Kind:** decision
- **Source:** dashboard-profile-tab / plan-brief Key Decisions — Inactive panel
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm hide-with-`hidden` (shipped) or `/10x-new dashboard-unmount-idle-tab` to unmount the inactive panel
- **Notes:** Human 2026-09-01 — keep mounted (`hidden`). Shipped so in-session chat/week state survives tab switches. Unmounting would reset `PlanWorkspace`.

### FU-036 — Sign-in Topbar full-width vs card-width
- [x] **Status:** done
- **Kind:** decision
- **Source:** signin-with-nav / plan-brief Key Decisions — Topbar placement
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm full-width Topbar with `p-4 sm:p-8` (shipped), or `/10x-new signin-topbar-card-column` to stack the bar inside the `max-w-sm` card column
- **Notes:** Human 2026-09-01 — keep full-width Topbar with `p-4 sm:p-8`.

### FU-035 — Unlog icon glyph (Undo2 vs Check)
- [x] **Status:** done
- **Kind:** decision
- **Source:** plan-calendar-ui / plan-brief Key Decisions — Unlog glyph
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm Lucide `Undo2` for Unlog (shipped) or `/10x-new plan-calendar-unlog-check` to use `Check` for both Log and Unlog
- **Notes:** Human 2026-09-01 — keep Lucide `Undo2` for Unlog.

### FU-034 — Hide structure and logged line below sm
- [x] **Status:** done
- **Kind:** decision
- **Source:** plan-calendar-ui / plan-brief Key Decisions — Structure / logged on xs
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm `hidden sm:block` (shipped) or `/10x-new plan-calendar-mobile-structure` to wrap structure/logged onto a second mobile line
- **Notes:** Human 2026-09-01 — keep `hidden sm:block` on structure/logged.

### FU-033 — UTC-today border vs frozen purple
- [x] **Status:** done
- **Kind:** decision
- **Source:** plan-calendar-ui / plan-brief Key Decisions — Today
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm today `border-white/60` winning via `twMerge` (shipped) or `/10x-new plan-calendar-today-frozen-ring` to keep frozen purple border and put today on a ring/outline
- **Notes:** Human 2026-09-01 — keep today `border-white/60` over frozen purple. Frozen stays visible via snowflake.

### FU-032 — Drop overlay-only stacking on Welcome
- [x] **Status:** done
- **Kind:** decision
- **Source:** landing-quiet / plan-brief Key Decisions — Overlay-only stacking
- **Added:** 2026-09-01
- **Done:** 2026-09-01
- **Next step:** confirm drop of `overflow-hidden` and `relative z-10` (shipped), or `/10x-new landing-quiet-keep-stacking` to restore those classes without bringing orbs/stars back
- **Notes:** Human 2026-09-01 — keep stacking classes dropped with the orbs/stars.

### FU-030 — Footer on landing + dashboard, not auth/Layout
- [x] **Status:** done
- **Kind:** decision
- **Source:** privacy-cookie-notice / plan-brief Key Decisions — Footer placement
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Next step:** confirm keep `SiteFooter` on `/` and `/dashboard` only, or `/10x-new privacy-notice-auth-footer` to also link from auth pages (and/or Layout if cosmic wrapping is solved)
- **Notes:** Human 2026-08-31 — link from every place. `SiteFooter` also on `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, and `/admin`.

### FU-031 — Controller named as this website / HardFeelings
- [x] **Status:** done
- **Kind:** question
- **Source:** privacy-cookie-notice / plan-brief Key Decisions — Controller identity
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Next step:** confirm the shipped controller wording, or replace with a real operator name/email in a later copy edit
- **Notes:** Confirmed shipped 2026-08-31 — controller stays “HardFeelings / this website”; no invented legal entity or contact.

### FU-022 — Free-text OpenAI model id vs a closed allowlist
- [x] **Status:** done
- **Kind:** decision
- **Source:** admin-llm-model-picker / plan-brief Key Decisions — Model id
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Next step:** confirm free-text + datalist (shipped) or `/10x-new admin-llm-model-allowlist` to reject ids outside a fixed catalog
- **Notes:** Confirmed shipped 2026-08-31 — free-text model id (`[A-Za-z0-9._:-]{1,64}`) plus datalist suggestions.

### FU-011 — Admin picker for the project LLM model
- [x] **Status:** done
- **Kind:** decision
- **Source:** chat 2026-08-17 — human after S-07 local test; currently `OPENAI_MODEL` in `.dev.vars` (e.g. `gpt-5.6-luna`)
- **Added:** 2026-08-17
- **Done:** 2026-08-31
- **Next step:** `/10x-new admin-llm-model-picker` — Admin chooses the OpenAI model for the whole project; keep `OPENAI_MODEL` / `gpt-4o-mini` as fallback until that ships
- **Notes:** Shipped 2026-08-31 — `/admin` Chat model picker is project-wide; fallback is `OPENAI_MODEL` then `gpt-4o-mini`.

### FU-014 — Research when Admin findings are created
- [x] **Status:** done
- **Kind:** question
- **Source:** chat 2026-08-17 — human after S-06 local Admin test (`admin-algorithm-feedback`)
- **Added:** 2026-08-17
- **Done:** 2026-08-31
- **Next step:** `/10x-new admin-report-capture-research` then `/10x-research` — document the current capture rule, what is *not* captured, and whether to change it; do not implement in that change unless asked
- **Notes:** Research delivered 2026-08-31 in `admin-report-capture-research` — keep hard-bound-only (`mutations` AND `validatePlan.hard`); do not widen or tighten. Generate-failure capture would be a later change-id, not FU-012.

### FU-012 — Capture unmapped chat intents as gap reports
- [x] **Status:** done
- **Kind:** decision
- **Source:** admin-algorithm-feedback / plan-brief Key Decisions — Unmapped intents
- **Added:** 2026-08-17
- **Done:** 2026-08-31
- **Next step:** confirm hard-bound-only capture (shipped) or `/10x-new admin-unmapped-intent-gaps` to persist `kind=gap` for help-fallback / LLM-unavailable turns
- **Notes:** Confirmed shipped 2026-08-31 — hard-bound-only (`kind=algorithm_proposal`). Research recommended keep; unmapped/`kind=gap` not taken (would flood the 100-row Admin list).

### FU-013 — Member chat transcript on Admin reports
- [x] **Status:** done
- **Kind:** question
- **Source:** admin-algorithm-feedback / plan-brief Key Decisions — PII / transcript
- **Added:** 2026-08-17
- **Done:** 2026-08-31
- **Next step:** confirm bound-codes + canned hint only (shipped) or `/10x-new admin-report-chat-excerpt` to store a truncated user message on `agent_reports`
- **Notes:** Confirmed shipped 2026-08-31 — `source_user_id` + week + bound-codes + canned `BOUND_HINTS`; no member chat body on `agent_reports`.

### FU-021 — Fold Undo into the version picker
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-version-restore / plan-brief Key Decisions — Undo vs picker
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Next step:** confirm keep Undo-as-pop-latest (shipped) or `/10x-new calendar-undo-in-picker` to remove the Undo button and restore only via the picker
- **Notes:** Closed 2026-08-31 in `calendar-undo-in-picker` — picker-only; Undo last edit removed from the calendar. `POST /api/plan/undo` kept for tests.

### FU-020 — Discard later snapshots when restoring an older one
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-version-restore / plan-brief Key Decisions — Restore non-latest
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Next step:** confirm checkout-keep-later (shipped) or `/10x-new calendar-restore-linear` to delete snapshots newer than the restored one (linear undo-from-middle)
- **Notes:** Confirmed shipped 2026-08-31 — restore is checkout-keep-later; later `plan_revisions` rows stay pickable.

### FU-001 — Undo stack vs version-history picker
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-manual-edit / plan-brief Key Decisions — Recovery UX; human 2026-08-15 after 4.5–4.8
- **Added:** 2026-08-14
- **Done:** 2026-08-31
- **Next step:** `/10x-new calendar-version-restore` — picker historii tygodnia; Undo/restore ma też działać przez Generate (wraca do stanu sprzed generacji), nie gasić stosu
- **Notes:** Closed 2026-08-31 in `calendar-version-restore` — generate and Accept snapshot the live week onto `plan_revisions` (no `clearRevisions`); calendar week-history picker restores by id; Undo last still pops the latest snapshot. FU-002 was confirmed separately (warnings-only manual save).

### FU-007 — LLM provider: OpenAI fetch vs Workers AI
- [x] **Status:** done
- **Kind:** decision
- **Source:** llm-chat-proposer / plan-brief Key Decisions — Provider
- **Added:** 2026-08-16
- **Next step:** confirm OpenAI Chat Completions via `fetch` + `gpt-4o-mini` (shipped) or `/10x-new workers-ai-chat-proposer` to bind Workers AI instead
- **Notes:** Confirmed shipped 2026-08-31 — OpenAI Chat Completions via `fetch` + `gpt-4o-mini` (`OPENAI_MODEL` override). Workers AI / Anthropic not taken; DEP-002 stays independent (Paid ≠ provider swap).

### FU-008 — Missing OPENAI_API_KEY uses the S-03 stub
- [x] **Status:** done
- **Kind:** decision
- **Source:** llm-chat-proposer / plan-brief Key Decisions — Missing key
- **Added:** 2026-08-16
- **Next step:** confirm stub fallback (shipped) or `/10x-new chat-llm-fail-closed` to 503 when the key is unset
- **Notes:** Confirmed shipped 2026-08-31 — stub fallback when the key is unset so CI and local-without-secret still chat. Production has the Worker secret (DEP-014).

### FU-009 — Last 12 chat turns sent to the model
- [x] **Status:** done
- **Kind:** decision
- **Source:** llm-chat-proposer / plan-brief Key Decisions — History
- **Added:** 2026-08-16
- **Next step:** confirm last-12 (shipped) or `/10x-new chat-llm-stateless` to send only the current message
- **Notes:** Confirmed shipped 2026-08-31 — last-12 `{ role, content }` so continue-chat is not stateless. Cost-bounded, not a quality SLA.

### FU-010 — Model owns all chat intents when the key is set
- [x] **Status:** done
- **Kind:** decision
- **Source:** llm-chat-proposer / plan-brief Key Decisions — Intents when keyed
- **Added:** 2026-08-16
- **Next step:** confirm LLM-for-all when keyed (shipped) or `/10x-new chat-llm-hybrid-intents` to keep deterministic explain/log and only send life/day-change to the model
- **Notes:** Confirmed shipped 2026-08-31 — model owns explain/life/change/log when keyed; stub only if `complete` is omitted. Sanitize still enforces log XOR mutations.

### FU-003 — Off-plan / empty-day workout diary
- [x] **Status:** done
- **Kind:** decision
- **Source:** workout-logging / plan-brief Key Decisions — Scope
- **Added:** 2026-08-15
- **Next step:** confirm planned-days-only (shipped) or `/10x-new off-plan-workout-log` to allow logging dates with no `training_units` row
- **Notes:** Confirmed shipped 2026-08-31 — log existing planned days only. Off-plan diary stays out of MVP.

### FU-004 — Actual km vs completed-only flag
- [x] **Status:** done
- **Kind:** question
- **Source:** workout-logging / plan-brief Key Decisions — Payload
- **Added:** 2026-08-15
- **Next step:** confirm snapshot + optional km (shipped) or `/10x-new workout-log-boolean` to store completed-at only
- **Notes:** Confirmed shipped 2026-08-31 — snapshot planned type+km; optional km override from chat. FR-009 does not require a boolean-only log.

### FU-005 — Chat log trigger words (no bare “did”)
- [x] **Status:** done
- **Kind:** question
- **Source:** workout-logging / plan-brief Key Decisions — Phrases
- **Added:** 2026-08-15
- **Next step:** confirm `completed|logged|log|done` or `/10x-new workout-log-chat-phrases` to add/remove triggers (especially bare “did”)
- **Notes:** Confirmed shipped 2026-08-31 — `completed|logged|log|done` + date. Bare “did” stays out so “I did a long on Wednesday” can remain a type-change.

### FU-006 — Logs survive generate / Accept / Undo
- [x] **Status:** done
- **Kind:** decision
- **Source:** workout-logging / plan-brief Key Decisions — Plan ops
- **Added:** 2026-08-15
- **Next step:** confirm logs-as-history (shipped) or `/10x-new workout-log-reset-on-generate` to delete week logs when the prescription is replaced
- **Notes:** Confirmed shipped 2026-08-31 — logs are what the member did; generate/Accept/Undo do not delete them.

### FU-002 — Manual edits persist through hard bounds
- [x] **Status:** done
- **Kind:** decision
- **Source:** calendar-manual-edit / plan-brief Key Decisions — Hard bounds
- **Added:** 2026-08-14
- **Next step:** confirm warnings-only (shipped) or `/10x-new calendar-edit-hard-gate` to 409 manual saves when `validatePlan.hard.length > 0`
- **Notes:** Confirmed shipped 2026-08-31 — manual save writes anyway and surfaces hard+soft as calendar warnings. Chat Accept still 409s on hard bounds (FR-008 vs FR-005).

### FU-016 — Landing still ships 10x starter feature cards
- [x] **Status:** done
- **Kind:** finding
- **Source:** local browse 2026-08-27 — `src/components/Welcome.astro`
- **Added:** 2026-08-28
- **Done:** 2026-08-31
- **Next step:** `/10x-new landing-product-copy` (or a small edit) — replace the three starter cards (Authentication Ready / Modern Stack “Astro 5” / Developer Experience) with HardFeelings product copy
- **Notes:** Closed 2026-08-31 — Welcome cards now describe A–D priorities + weekly km, algorithmic generation, and chat diffs with accept/reject under hard bounds.

### FU-015 — Weekly volume warning prints a float artifact
- [x] **Status:** done
- **Kind:** finding
- **Source:** local browse 2026-08-27 — generate a 50 km week; `generatePlan` + `validatePlan`
- **Added:** 2026-08-28
- **Next step:** round km before compare/display in `generatePlan` (fill split) and `validatePlan` messages — e.g. 1 decimal, so 50 km/week does not warn `50.00000000000001 km is over the 50 km target`
- **Notes:** Closed 2026-08-31 — `roundKm` (1 decimal) on generate fill split (last empty day takes remainder) and on `validatePlan` volume compare/messages. Soft WEEKLY_VOLUME_EXCEEDED; hard ceiling still weeklyKm * 1.2.

### FU-017 — Astro Dev toolbar overlays every local page
- [x] **Status:** done
- **Kind:** finding
- **Source:** local browse 2026-08-27 — `/` and `/dashboard` under `astro dev`
- **Added:** 2026-08-28
- **Next step:** set `devToolbar.enabled: false` in `astro.config.mjs` if the overlay is unused, or leave it (production has no toolbar)
- **Notes:** Closed 2026-08-31 — `devToolbar.enabled: false` in `astro.config.mjs`. Overlay was local-dev only; production builds already had no toolbar.
