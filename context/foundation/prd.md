---
project: "HardFeelings"
version: 1
status: reviewed
created: 2026-07-20
updated: 2026-09-10
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 12
  hard_deadline: null
  after_hours_only: true
---

# HardFeelings — PRD

Live contract for the shipped MVP. Stamp FRs here when behaviour lands.

## Vision & Problem Statement

Amateur runners who want training under their own rules hit a wall with today's planning apps: they cannot set multi-level race priorities (one A-goal plus side events), cannot weave in school-specific or custom accents (e.g. Norwegian-style stimuli), and within a workout type (tempo / threshold / anaerobic / base / recovery) the sessions look alike. They also cannot consult the plan about what a unit is for, or tell it that the next three days will have poor sleep — or the opposite, that they can fully dedicate themselves to training — and get a plan they can still complete.

The insight: the gap is not "missing workout type labels" but controllable priorities + real variety inside types + a coaching channel that explains and adapts — while algorithmic plan generation stays first-class, not demoted behind chat. Status quo (rigid apps, or personal Markdown/skills workflows) either under-controls the athlete's intent or fails to scale continuous adaptation.

Pain categories captured: workflow friction, missing capability, data trapped elsewhere, decision paralysis, life×calendar×plan coordination overhead.

## User & Persona

**Primary persona:** Amateur runner with races on the calendar who wants workouts "under their own dictation" — specific accents/schools, different event priorities, and sessions they can realistically complete — and who reaches for the product when laying out a season or when life capacity changes (sleep, availability) and they need both explanation ("what is this unit for?") and adaptation.

### Secondary persona
Admin who reviews hidden agent reports about gaps in rules/algorithms/skills (from seed; not the MVP end-user). Admin is also a Member.

## Success Criteria

### Primary
- First-session end-to-end flow works: login → weekly km profile → race calendar with priorities + goal → generate plan (algorithmic; optional frozen anchors) → calendar view → agent chat with diff proposition → accept / reject / continue (hard bounds non-acceptable) → optional manual edit with undo/version restore.
- Users manually change ≤ 25% of units relative to the algorithm-generated plan.
- ≥ 80% of AI chat modification proposals pass validators without being rejected as out of bounds (hard-bound non-acceptable cases count as rejects).

### Secondary
- External workout-tracking sync (nice-to-have; manual logging / chat logging is sufficient for primary path).

### Guardrails
- AI proposals outside hard algorithmic bounds never land in the plan (member cannot accept them).
- Soft validator warnings may accompany a proposition; member accepts, rejects, or continues chat.
- Training data privacy is preserved.
- Generated/adapted plan remains executable relative to the user's declared weekly volume.

## User Stories

### US-01: First plan with chat-gated adaptation

- **Given** a logged-in Member with profile prefs and at least one A-priority race
- **When** they generate a plan, then ask chat to change a specific day (or report poor sleep)
- **Then** they see an updated calendar proposition (with warning from validator if present); member can either accept changes or reject, or continue discussion with chat to further modify

## Functional Requirements

### Account & profile
- FR-001: Member can register and log in. Priority: must-have
  > Socrates: Counter-argument considered: "auth delays dogfooding — local/dev without accounts would be enough." Resolution: kept; product is multi-user with Admin role, so accounts stay in MVP (seed accounts OK for early dogfooding).
- FR-002: Member can set weekly km volume that affects the plan. Priority: must-have
  > Socrates: Counter-argument considered: "weekly km is enough; other type prefs are MVP overkill." Resolution: FR narrowed to weekly km as must-have; richer prefs demoted.
- FR-012: Member can set additional profile preferences that affect the plan (workout-type prefs, other parameters). Priority: nice-to-have
  > Socrates: Split out from original FR-002 after C resolution.
  > 2026-09-05: persist of long-run weekdays, rest weekdays, and Easy/Threshold/Speed mix shipped (`profile-plan-prefs`).
  > 2026-09-10: `generatePlan` honors those fields (`generate-honors-plan-prefs`): rest days stay empty, preferred long days emit `long`, mix steers types.

### Race calendar
- FR-003: Member can add and remove races with a goal and multi-level priorities (e.g. A, B, C, D) that drive algorithmic plan generation. Priority: must-have
  > Socrates: Counter-argument considered: "priorities without algorithm effect are dead UI." Resolution: kept and strengthened — priorities must influence generation.
  > 2026-09-10: `generatePlan` tapers toward A, leaves an in-week A day empty, pins in-week B to tempo and C to recovery; D does not pin type.

### Plan
- FR-004: Member can generate a running plan into the calendar via algorithms (generation is fast; the algorithm is continuously improved from agent proposals reviewed in the admin profile). Priority: must-have
  > Socrates: User resolution: generation is algorithmic and kept fast; complexity lives in an evolving algorithm fed by admin-facing agent proposals — not slow one-shot LLM plan writing. Also: frozen workouts can anchor generation (see FR-013).
- FR-013: Member can freeze specific workouts around which the algorithm generates the rest of the plan; the agent checks whether the overall plan still makes sense. Priority: must-have
  > Socrates: Captured from FR-004 challenge response (frozen anchors + whole-plan coherence check).
- FR-005: Member can view the plan in a calendar and manually edit a workout. Priority: must-have
  > Socrates: Counter-argument considered: "edit without undo/versioning causes plan chaos." Resolution: kept; undo or version restore is required alongside edit (capture as acceptance need for FR-005).
- FR-016: Member can edit a workout as a nested structured session (repeats and intensity targets), not only a flat list of stages plus Make AI. Priority: nice-to-have
  > Socrates: Parked from UI packs 2026-09-03 (P-12: do not grow the day panel into a full workout builder) and 2026-09-04 INDEX (“pełny builder sesji poza etapami”). Flat Seg 1…N + Make AI shipped.

### Agent chat & validators
- FR-006: Member can ask chat to modify a specific training day and see a clear diff/proposition before accepting. Priority: must-have
  > Socrates: Counter-argument considered: "without a diff before accept, the member does not know what they approve." Resolution: kept; diff/proposition preview is mandatory.
- FR-007: Member can chat with the agent to ask what a unit is for or report life context (e.g. poor sleep). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-008: Member can review a chat-proposed calendar change with validator output — soft warnings allow accept, reject, or continue chat; proposals outside hard algorithmic bounds cannot be accepted. Priority: must-have
  > Socrates: Counter-argument considered: hard-block vs warn+accept. Resolution: rewritten to match US-01 — soft warning + member decision; hard bounds non-acceptable.

### Workout logging
- FR-009: Member can log completed workouts manually (or via chat). Priority: must-have
  > Socrates: No counter-argument; it stands as written.
- FR-010: Member can connect an external workout-tracking service to sync workouts. Priority: nice-to-have
  > Socrates: No counter-argument; it stands as written (nice-to-have, outside Primary path).

### Training load
- FR-015: Member can see Banister-style chronic and acute training load (CTL and ATL, and form as their difference) derived from logged and planned work. Priority: nice-to-have
  > Socrates: Parked from UI packs 2026-09-03/04 (full Banister CTL/ATL; “osobny 10x”). Distinct from the shipped Easy/Threshold/Speed daily-load chart with decay 0.85.

### Admin
- FR-011: Admin can review hidden agent gap reports and algorithm-improvement proposals (without notifying the member). Priority: must-have
  > Socrates: Counter-argument considered: "must-have earlier or the algorithm does not mature in 12 weeks." Resolution: raised from nice-to-have to must-have; tied to FR-004 algorithm evolution.

## Non-Functional Requirements

- Plan generation produces a visible calendar result promptly for the member, or continuous visible progress if the operation takes longer than a couple of seconds.
- A chat proposition outside hard algorithmic bounds never lands in the plan even if the member tries to accept it.
- One member's training data (plan, logs, chat-driven adaptations) is not visible to other members.
- The web MVP remains usable on the latest two major versions of mainstream desktop browsers.

## Business Logic

The product algorithmically builds an executable running plan from the member's race priorities (A–D), goals, declared weekly volume, and any frozen anchor workouts; the agent may propose changes or explain units, but only member accept/reject (with soft validator warnings) and non-acceptable hard algorithmic bounds decide what lands in the calendar — while agent gap reports in the admin profile feed ongoing algorithm improvement.

Inputs the rule consumes (user-facing): weekly km, long/rest weekdays, Easy/Threshold/Speed mix, race calendar with priorities and goals, optional frozen workouts, chat requests (explain unit / change a day / life context such as poor sleep), and logged completed workouts (manual or chat; external workout-tracking sync optional).

Output: a calendar of training units the member can complete relative to declared volume, plus chat propositions shown as diffs with soft warnings or hard-bound blocks.

How the member encounters it: generate plan (fast, algorithmic), optional freeze anchors, chat for explanation/adaptation, accept/reject/continue on propositions, manual edit with undo/version restore; Admin reviews hidden agent proposals that evolve the algorithm without notifying members.

## Access Control

Multi-user login (account required). Roles:

| Role | Capabilities |
|------|----------------|
| Member | Own profile, race calendar, plan generate/adapt, calendar view/edit workouts, external workout-tracking sync or manual log, agent chat (changes gated by algorithmic validators) |
| Admin | Everything a Member has, plus hidden admin panel for agent gap reports and algorithm-improvement proposals (users are not notified) |

No guest role in MVP. Unauthenticated users cannot access gated product routes.

## Non-Goals

- No strength training or other sports disciplines in MVP — running only; expand later.
- No native mobile apps — web first.
- No social features or sharing plans between users.
- No Banister CTL/ATL (or other advanced performance analytics) in MVP — post-MVP FR-015; adaptation may keep using the shipped daily-load decay chart.
- No full structured workout builder in MVP — flat stages + Make AI only; post-MVP FR-016.
- No trail-only or flat-only specialization — one universal running planner.
- No replacing algorithmic plan generation with a full LLM-written planner — chat proposes; algorithms generate and bound.
- No offline-first / offline PWA guarantee in MVP.

## Open Questions

(None captured from shape-notes at generation time.)
