# Generate next 14 days via coach chat — Plan Brief

> Full plan: `context/changes/generate-via-chat/plan.md`

## What & Why

The purple calendar button still starts a plan, but it talks to the coach instead of `generatePlan`. Click lays out or regenerates UTC today through today+13, keeping frozen dates, without the member typing that prompt. Empty-week chat is ungated so the first turn can create units.

## Starting Point

The button is **Generate plan** / **Regenerate week** and POSTs `/api/plan` `{ weekStart }`. Chat is disabled until that week has units (`PLAN_EMPTY`). The model may only mutate dates that already exist; `applyMutations` skips unknown dates; Accept `replaceWeek`s one Monday.

## Desired End State

Purple button labeled for the next 14 days. Click is a canned coach Send (shared busy). Composer works when the week is empty. After Accept, two week-rows can fill from chat. `generatePlan` / `POST /api/plan` stay in the repo unused from this UI. Accept/Reject stay.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Purple button vs hide | Keep the button; do not POST `/api/plan` | Locked human override | Plan |
| Click wiring | Dedicated `send(canned)` from `onGenerate` (user message visible in transcript) | Same busy/error path as Send; member does not type the prompt | Unattended |
| Canned prompt copy | Generate vs regenerate variants: lay out / regenerate next 14 days from today, keep frozen | Matches button label so the transcript is honest | Unattended |
| Chat `weekStart` for the turn | Current workspace `weekStart` (visible Coach chat) | Busy-on-both and `applyChatBody` require the open week’s transcript | Unattended |
| Propose unit set | `listWeek(weekStart)` ∪ `listRange(today, today+13)` | Current-week chat still sees that week; model sees existing horizon rows | Unattended |
| Sanitize keep rule | Keep if date is in `units` **or** in today…today+13; log still needs an existing unit | Locked create-in-range plus existing week mutations | Plan |
| `applyMutations` insert | Insert when type+km set; skip frozen; skip incomplete | Locked; incomplete rows are not valid `TrainingUnit`s | Plan |
| Volume gate | `validatePlan` per ISO week, concatenate hard/soft | A 14-day blob vs one `weeklyKm` would hard-fail volume | Unattended |
| Accept persist | Always persist the request week; keep-merge other Mondays that have in-horizon proposed dates | Ordinary chat Accept must still land; leftover-delete would wipe e.g. Monday when today is Wednesday | Unattended |
| Client Accept merge | Merge all returned unit dates, not only `mergeWeekSlice(..., weekStart)` | Otherwise week 2 stays stale until month reload | Unattended |
| Helper second line | `Ask what a day is for, or log a run.` | Locked first line; short second line; no bounds lecture | Unattended |
| Testing | Source-scan UI + service unit/memory tests; no Playwright | Test-plan §6; locked test files | Plan |

## Scope

**In scope:** Button copy; click → chat; ungate composer + drop `PLAN_EMPTY`; system prompt + sanitize create window; `applyMutations` insert; sendMessage unit load; per-week validate; Accept persist merge; client merge; listed tests.

**Out of scope:** Delete generate API; hardcoded 14-day fixtures; Profile / races / density / snapshot POST; mix prefs; auto-apply; Playwright.

## Architecture / Approach

Click calls existing `POST /api/chat/messages` with a canned user message. Propose/apply operate on week ∪ 14-day units. Sanitize allowlist = existing dates ∪ horizon. Accept writes each overlapping ISO week with an outside-horizon keep-merge. Calendar month state merges every returned date.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Mutations + prompt | Insert/sanitize/system prompt | Frozen skip vs today’s gate test |
| 2. sendMessage + Accept | No `PLAN_EMPTY`; persist two weeks safely | `replaceWeek` leftover delete; 14-day volume |
| 3. Button + composer | Labels, click, helper copy | Source-scan drift vs leftover POST `/api/plan` |

**Prerequisites:** Fala 1 toolbar + Save snapshot, List tab, races overlay already on this branch (`ad42ee5`).
**Estimated effort:** ~3 phases, one unattended run.

## Open Risks & Assumptions

- Without `OPENAI_API_KEY`, the stub will not invent a 14-day fill (locked: no fixtures); the turn still sends.
- Generate while viewing a non-current month still chats on that month’s `weekStart` while the horizon is UTC today (FU-117).
- Horizon at Accept is recomputed with `utcToday()`; a proposition left pending overnight could shift the keep-merge window.

## Success Criteria (Summary)

- Purple button labels the 14-day window and starts a canned coach turn, not `POST /api/plan`.
- Empty week: usable composer; no `PLAN_EMPTY`.
- Accept can land created units across the horizon without deleting dates outside it.
