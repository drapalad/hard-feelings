---
project: HardFeelings
version: 1
status: shipped
created: 2026-08-10
updated: 2026-09-10
prd_version: 1
main_goal: speed
top_blocker: capacity
---

# Roadmap: HardFeelings

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Amateur runners cannot set multi-level race priorities, get real variety inside workout types, or tell a plan that life capacity changed — and still finish an executable week. HardFeelings keeps algorithmic plan generation first-class while adding a coaching channel that explains units and proposes adaptations; member accept/reject (with soft warnings) and hard algorithmic bounds decide what lands in the calendar.

## North star

**S-03: user can accept or reject a chat-proposed calendar change (with soft warnings; hard bounds non-acceptable) after an algorithmic plan exists** — this is the validation milestone (the earliest shippable proof that the Primary Success Criterion’s first-session loop works: generate → chat diff → accept/reject).

> North star here means the smallest end-to-end slice whose successful delivery would prove the core hypothesis — the claim that algorithmic generation plus member-gated chat adaptation is the product — placed as early as Prerequisites allow because everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | plan-gen-bounds-contract | (foundation) generation entrypoint + hard-bound validator surface exist for plan mutations | — | NFR hard-bounds, FR-004, FR-008 | done |
| S-01 | profile-and-race-calendar | sign in, set weekly km, and manage races with goals and A–D priorities | — | US-01, FR-001, FR-002, FR-003 | done |
| S-02 | algorithmic-plan-generation | generate an algorithmic plan into the calendar (optional freeze anchors) and view it | F-01, S-01 | US-01, FR-004, FR-013, FR-005 | done |
| S-03 | chat-gated-plan-adaptation | ask chat to explain a unit / report life context / change a day, review a diff with validators, accept / reject / continue | S-02 | US-01, FR-006, FR-007, FR-008 | done |
| S-04 | calendar-manual-edit | manually edit a workout with undo or version restore | S-02 | FR-005 | done |
| S-05 | workout-logging | log completed workouts manually (or via chat) | S-02 | FR-009 | done |
| S-06 | admin-algorithm-feedback | Admin can review hidden agent gap reports and algorithm-improvement proposals | S-03 | FR-011 | done |
| S-07 | llm-chat-proposer | get chat explanations and adaptation diffs from a real LLM, still accept / reject / continue under hard bounds | S-03 | US-01, FR-006, FR-007, FR-008 | done |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Athlete setup | `S-01` | Parallel with F-01; feeds generation. Speed path: ship inputs without waiting on backend contract polish. |
| B | Generation & gated chat | `F-01` → `S-02` → `S-03` → (`S-07` ∥ `S-06`) | Critical path to the north star; stub chat in S-03, fetch LLM in S-07; Admin last under speed. |
| C | Plan maintenance | `S-04` / `S-05` | Parallel after `S-02`; joins Stream B at `S-02`. Capacity lever: fan out here while chat ships. |

## Baseline

What's in the codebase as of `2026-08-27` (MVP slices F-01 and S-01–S-07 shipped). Change folders are still under `context/changes/` (`impl_reviewed`); they have not been `/10x-archive`d.

- **Frontend:** present — Astro 6 SSR + React 19 islands, Tailwind 4, shadcn; member workspace on `/dashboard`, Admin on `/admin`
- **Backend / API:** present — Astro SSR API routes under `src/pages/api/` (auth, profile, races, plan, chat, admin reports)
- **Data:** present — product migrations in `supabase/migrations/` (profiles, races, training units, chat, revisions, logs, admin reports) with RLS; applied on hosted Supabase
- **Auth:** present — Supabase Auth via `@supabase/ssr`; page gates in `PROTECTED_ROUTES`; JSON APIs return 401 in-handler
- **Deploy / infra:** present — production Worker `https://hard-feelings.ikul.workers.dev`; GHA CI lint/test/build; deploy via Workers Builds on GitHub `master`
- **Observability:** present — Sentry wraps the Cloudflare Worker (`sentry.server.config.ts`, `console.warn`/`console.error`); DSN is an optional Worker secret (empty = no-op)

## Foundations

### F-01: Plan generation and hard-bound validator contract

- **Outcome:** (foundation) a shared algorithmic generation entrypoint and a hard-bound validator surface exist so plan mutations can be proposed and rejected before they land.
- **Change ID:** plan-gen-bounds-contract
- **PRD refs:** NFR (chat proposition outside hard algorithmic bounds never lands), FR-004, FR-008
- **Unlocks:** S-02, S-03; verification path for hard-bound non-acceptability
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first on the north-star path so generate and chat do not invent divergent bound rules; keep it a contract/scaffold — full algorithm quality still lands in S-02/S-06.
- **Status:** done

## Slices

### S-01: Profile and race calendar

- **Outcome:** user can sign in, set weekly km volume that affects the plan, and add/remove races with a goal and multi-level priorities (A–D).
- **Change ID:** profile-and-race-calendar
- **PRD refs:** US-01, FR-001, FR-002, FR-003
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Auth is already present — this slice adds the first member-owned training inputs (and the minimal persistence/RLS they need). Without it, generation has nothing to consume.
- **Status:** done

### S-02: Algorithmic plan generation

- **Outcome:** user can optionally freeze anchor workouts, generate a running plan into the calendar via algorithms, and view the resulting plan.
- **Change ID:** algorithmic-plan-generation
- **PRD refs:** US-01, FR-004, FR-013, FR-005
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How sophisticated must the first shippable algorithm be vs a deterministic MVP stub that still respects volume and priorities? — Owner: user. Block: no.
- **Risk:** On the critical path to the north star; under speed, prefer an executable generator that respects priorities/volume/anchors over a polished training science surface (Admin feedback in S-06 improves it later).
- **Status:** done

### S-03: Chat-gated plan adaptation

- **Outcome:** user can ask chat what a unit is for, report life context (e.g. poor sleep), or request a day change; see a clear diff/proposition with soft validator warnings; accept, reject, or continue chat — while hard-bound proposals cannot be accepted.
- **Change ID:** chat-gated-plan-adaptation
- **PRD refs:** US-01, FR-006, FR-007, FR-008
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - LLM/provider wiring deferred to S-07 (S-03 shipped a deterministic `proposeAdaptation` stub; S-07 replaced it when keyed). — Owner: user. Block: no.
- **Risk:** This is the north star — sequence immediately after a visible generated plan; do not defer behind manual edit, logging, or Admin. A fetch LLM is a follow-on slice, not a blocker for the accept/reject loop.
- **Status:** done

### S-04: Calendar manual edit

- **Outcome:** user can manually edit a workout in the calendar with undo or version restore.
- **Change ID:** calendar-manual-edit
- **PRD refs:** FR-005
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Required by FR-005 acceptance (edit without restore causes plan chaos) but not on the north-star critical path — safe to fan out under capacity constraints.
- **Status:** done

### S-05: Workout logging

- **Outcome:** user can log completed workouts manually (or via chat).
- **Change ID:** workout-logging
- **PRD refs:** FR-009
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Manual logging is the primary path (external sync is parked); sequence after a plan exists, parallel with chat/edit under capacity.
- **Status:** done

### S-06: Admin algorithm feedback

- **Outcome:** Admin can review hidden agent gap reports and algorithm-improvement proposals without notifying the member.
- **Change ID:** admin-algorithm-feedback
- **PRD refs:** FR-011
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - What minimum report shape is enough for the first Admin review loop? — Owner: user. Block: no.
- **Risk:** Must-have for algorithm evolution over 12 weeks, but under speed it follows the member chat path so dogfooding signal exists before Admin tooling.
- **Status:** done

### S-07: LLM chat proposer

- **Outcome:** user can ask chat to explain a unit, report life context, or request a day change and receive a model-written reply plus a gated calendar diff — accept / reject / continue still apply; hard-bound proposals still cannot be accepted.
- **Change ID:** llm-chat-proposer
- **PRD refs:** US-01, FR-006, FR-007, FR-008
- **Prerequisites:** S-03
- **Parallel with:** S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - Which LLM/provider wiring is acceptable for the first fetch-based chat path (OpenAI / Anthropic / Workers AI / other)? — Owner: user. Block: no (lock during `/10x-plan`).
- **Risk:** Replaces the S-03 `proposeAdaptation` stub behind the existing interface; do not let the model write the plan or bypass `validatePlan` / accept (PRD non-goal: no LLM planner). DEP-002 (Workers Paid CPU) stays open independently of the fetch path shipping.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | plan-gen-bounds-contract | Plan generation + hard-bound validator contract | no (shipped) | `impl_reviewed` 2026-08-13 |
| S-01 | profile-and-race-calendar | Profile weekly km + race calendar with priorities | no (shipped) | `impl_reviewed` 2026-08-13 |
| S-02 | algorithmic-plan-generation | Algorithmic plan generation with freeze anchors | no (shipped) | `impl_reviewed` 2026-08-13 |
| S-03 | chat-gated-plan-adaptation | Chat-gated plan adaptation (diff + validators) | no (shipped) | North star; `impl_reviewed` 2026-08-13 |
| S-04 | calendar-manual-edit | Manual workout edit with undo/version restore | no (shipped) | `impl_reviewed` 2026-08-15; version picker still FU-001 |
| S-05 | workout-logging | Manual / chat workout logging | no (shipped) | `impl_reviewed` 2026-08-16 |
| S-06 | admin-algorithm-feedback | Admin hidden agent gap / algorithm proposals | no (shipped) | `impl_reviewed` 2026-08-17 |
| S-07 | llm-chat-proposer | Fetch LLM behind proposeAdaptation (gated chat) | no (shipped) | `impl_reviewed` 2026-08-17; OpenAI fetch when keyed |
| — | generate-honors-plan-prefs | Algorithmic week honors long/rest/mix prefs and A–D | no (shipped) | `generatePlan` consumes profile prefs; A tapers, B/C pin in-week, D does not |
| — | banister-ctl-atl | Banister CTL/ATL (and form) from logs + plan | no (parked FR-015) | not daily-load decay 0.85 |
| — | workout-session-builder | Nested structured session editor | no (parked FR-016) | not flat stages + Make AI |

## Open Roadmap Questions

(None — PRD Open Questions was empty; framing interview did not surface cross-cutting unknowns.)

## Parked

- **External workout-tracking sync (FR-010)** — Why parked: PRD nice-to-have / Secondary Success Criterion; manual or chat logging is sufficient for the primary path. Suggested change-id when picked: `strava-workout-sync` (named first integration in shape-notes).
- **Additional profile preferences beyond weekly km (FR-012)** — Persist shipped 2026-09-02 (`profile-plan-prefs`). Generate honors prefs shipped 2026-09-10 (`generate-honors-plan-prefs`).
- **Banister CTL/ATL (FR-015)** — Why parked: UI packs 2026-09-03/04 (“pełny Banister CTL/ATL”, osobny 10x); PRD nice-to-have. Not the shipped daily-load chart (`decay 0.85` per Easy/Threshold/Speed bucket). Suggested change-id: `banister-ctl-atl`.
- **Full structured workout builder (FR-016)** — Why parked: UI packs 2026-09-03 P-12 and 2026-09-04 INDEX (“pełny builder sesji poza etapami”); PRD nice-to-have. Flat Seg 1…N + Make AI already shipped. Suggested change-id: `workout-session-builder`.
- **Strength training / other sports** — Why parked: PRD §Non-Goals.
- **Native mobile apps** — Why parked: PRD §Non-Goals (web first).
- **Social features / sharing plans** — Why parked: PRD §Non-Goals.
- **Trail-only or flat-only specialization** — Why parked: PRD §Non-Goals.
- **Full LLM-written planner replacing algorithms** — Why parked: PRD §Non-Goals (chat proposes; algorithms generate and bound).
- **Offline-first / offline PWA** — Why parked: PRD §Non-Goals.

## Done

Shipped in-repo (`status: impl_reviewed` on the change folder). Folders have not been moved to `context/archive/` yet.

| Change ID | Shipped | Notes |
|---|---|---|
| plan-gen-bounds-contract | 2026-08-13 | F-01 |
| profile-and-race-calendar | 2026-08-13 | S-01 |
| algorithmic-plan-generation | 2026-08-13 | S-02 |
| chat-gated-plan-adaptation | 2026-08-13 | S-03 (north star) |
| calendar-manual-edit | 2026-08-15 | S-04 |
| workout-logging | 2026-08-16 | S-05 |
| llm-chat-proposer | 2026-08-17 | S-07 |
| admin-algorithm-feedback | 2026-08-17 | S-06 |
| testing-critical-path-ownership-and-bounds | 2026-08-24 | Test-plan Phase 1 (not a product slice) |
| generate-honors-plan-prefs | 2026-09-10 | FR-012 remainder; archived → `context/archive/2026-09-10-generate-honors-plan-prefs/` |

- **F-01: (foundation) a shared algorithmic generation entrypoint and a hard-bound validator surface exist so plan mutations can be proposed and rejected before they land.** — Archived 2026-08-31 → `context/archive/2026-08-13-plan-gen-bounds-contract/`. Lesson: —.
- **S-01: user can sign in, set weekly km volume that affects the plan, and add/remove races with a goal and multi-level priorities (A–D).** — Archived 2026-08-31 → `context/archive/2026-08-13-profile-and-race-calendar/`. Lesson: —.
- **S-02: user can optionally freeze anchor workouts, generate a running plan into the calendar via algorithms, and view the resulting plan.** — Archived 2026-08-31 → `context/archive/2026-08-13-algorithmic-plan-generation/`. Lesson: —.
- **S-03: user can ask chat what a unit is for, report life context (e.g. poor sleep), or request a day change; see a clear diff/proposition with soft validator warnings; accept, reject, or continue chat — while hard-bound proposals cannot be accepted.** — Archived 2026-08-31 → `context/archive/2026-08-13-chat-gated-plan-adaptation/`. Lesson: —.
- **S-04: user can manually edit a workout in the calendar with undo or version restore.** — Archived 2026-08-31 → `context/archive/2026-08-14-calendar-manual-edit/`. Lesson: —.
- **S-05: user can log completed workouts manually (or via chat).** — Archived 2026-08-31 → `context/archive/2026-08-15-workout-logging/`. Lesson: —.
- **S-07: user can ask chat to explain a unit, report life context, or request a day change and receive a model-written reply plus a gated calendar diff — accept / reject / continue still apply; hard-bound proposals still cannot be accepted.** — Archived 2026-08-31 → `context/archive/2026-08-16-llm-chat-proposer/`. Lesson: —.
- **S-06: Admin can review hidden agent gap reports and algorithm-improvement proposals without notifying the member.** — Archived 2026-08-31 → `context/archive/2026-08-17-admin-algorithm-feedback/`. Lesson: —.
