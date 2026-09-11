---
project: "HardFeelings"
context_type: greenfield
created: 2026-07-20
updated: 2026-07-20
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 12
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 7
  phases_completed: [1, 2, 3, 4, 5, 6]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction + missing capability + data trapped + decision paralysis + coordination overhead"
    - topic: "insight"
      decision: "priority control + within-type workout variety + life-context channel; algorithm generates plan; coaching equally important but does not demote generation"
    - topic: "primary persona scope"
      decision: "amateur runners across many contexts with races on calendar"
    - topic: "auth strategy"
      decision: "login (multi-user); roles Member + Admin; Admin is also a Member"
    - topic: "mvp timeline"
      decision: "12-week MVP; user accepted sustained-effort cost (not scoped down)"
    - topic: "plan generation model"
      decision: "algorithmic generation (fast); algorithm improved via agent proposals in admin profile; frozen workouts can anchor generation; agent checks overall coherence"
    - topic: "validator UX"
      decision: "soft warning + member accept/reject/continue chat; hard bounds cannot be accepted"
  frs_drafted: 13
  quality_check_status: pending
---

# HardFeelings — shape notes

## Vision & Problem Statement

Amateur runners who want training under their own rules hit a wall with today's planning apps: they cannot set multi-level race priorities (one A-goal plus side events), cannot weave in school-specific or custom accents (e.g. Norwegian-style stimuli), and within a workout type (tempo / threshold / anaerobic / base / recovery) the sessions look alike. They also cannot consult the plan about what a unit is for, or tell it that the next three days will have poor sleep — or the opposite, that they can fully dedicate themselves to training — and get a plan they can still complete.

The insight: the gap is not "missing workout type labels" but controllable priorities + real variety inside types + a coaching channel that explains and adapts — while algorithmic plan generation stays first-class, not demoted behind chat. Status quo (rigid apps, or personal Markdown/skills workflows) either under-controls the athlete's intent or fails to scale continuous adaptation.

Pain categories captured: workflow friction, missing capability, data trapped elsewhere, decision paralysis, life×calendar×plan coordination overhead.

## User & Persona

**Primary persona:** Amateur runner with races on the calendar who wants workouts "under their own dictation" — specific accents/schools, different event priorities, and sessions they can realistically complete — and who reaches for the product when laying out a season or when life capacity changes (sleep, availability) and they need both explanation ("what is this unit for?") and adaptation.

### Secondary persona
Admin who reviews hidden agent reports about gaps in rules/algorithms/skills (from seed; not the MVP end-user). Admin is also a Member.

## Access Control

Multi-user login (account required). Roles:

| Role | Capabilities |
|------|----------------|
| Member | Own profile, race calendar, plan generate/adapt, calendar view/edit workouts, external workout-tracking sync or manual log, agent chat (changes gated by algorithmic validators) |
| Admin | Everything a Member has, plus hidden admin panel for agent gap reports and algorithm-improvement proposals (users are not notified) |

No guest role in MVP. Unauthenticated users cannot access gated product routes.

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

## Timeline acknowledgment

Acknowledged on 2026-07-20: 12-week MVP requires sustained dedication; user accepted.

## MVP first-session flow (locked)

1. Register / login
2. Complete profile (weekly km required; richer prefs nice-to-have)
3. Add races to calendar with priorities (A–D) and a goal that drive generation
4. Optionally connect an external workout-tracking service, or stay on manual logging (external sync is Secondary / nice-to-have)
5. Optionally freeze anchor workouts; click "generate plan" → algorithmic plan in calendar (fast); agent may check overall coherence
6. Open chat: explain unit / life context / change a day → see diff proposition with validator soft-warning if any → accept, reject, or continue chat (hard bounds cannot be accepted)
7. See updated week; optionally manually edit a workout (with undo/version restore)

## Business Logic

The product algorithmically builds an executable running plan from the member's race priorities (A–D), goals, declared weekly volume, and any frozen anchor workouts; the agent may propose changes or explain units, but only member accept/reject (with soft validator warnings) and non-acceptable hard algorithmic bounds decide what lands in the calendar — while agent gap reports in the admin profile feed ongoing algorithm improvement.

Inputs the rule consumes (user-facing): weekly km, race calendar with priorities and goals, optional frozen workouts, chat requests (explain unit / change a day / life context such as poor sleep), and logged completed workouts (manual or chat; external workout-tracking sync optional).

Output: a calendar of training units the member can complete relative to declared volume, plus chat propositions shown as diffs with soft warnings or hard-bound blocks.

How the member encounters it: generate plan (fast, algorithmic), optional freeze anchors, chat for explanation/adaptation, accept/reject/continue on propositions, manual edit with undo/version restore; Admin reviews hidden agent proposals that evolve the algorithm without notifying members.

## Non-Functional Requirements

- Plan generation produces a visible calendar result promptly for the member, or continuous visible progress if the operation takes longer than a couple of seconds.
- A chat proposition outside hard algorithmic bounds never lands in the plan even if the member tries to accept it.
- One member's training data (plan, logs, chat-driven adaptations) is not visible to other members.
- The web MVP remains usable on the latest two major versions of mainstream desktop browsers.

## Non-Goals

- No strength training or other sports disciplines in MVP — running only; expand later.
- No native mobile apps — web first.
- No social features or sharing plans between users.
- No advanced performance analytics beyond what adaptation of the plan requires.
- No trail-only or flat-only specialization — one universal running planner.
- No replacing algorithmic plan generation with a full LLM-written planner — chat proposes; algorithms generate and bound.
- No offline-first / offline PWA guarantee in MVP.

## Functional Requirements

### Account & profile
- FR-001: Member can register and log in. Priority: must-have
  > Socrates: Counter-argument considered: "auth delays dogfooding — local/dev without accounts would be enough." Resolution: kept; product is multi-user with Admin role, so accounts stay in MVP (seed accounts OK for early dogfooding).
- FR-002: Member can set weekly km volume that affects the plan. Priority: must-have
  > Socrates: Counter-argument considered: "weekly km is enough; other type prefs are MVP overkill." Resolution: FR narrowed to weekly km as must-have; richer prefs demoted.
- FR-012: Member can set additional profile preferences that affect the plan (workout-type prefs, other parameters). Priority: nice-to-have
  > Socrates: Split out from original FR-002 after C resolution.

### Race calendar
- FR-003: Member can add and remove races with a goal and multi-level priorities (e.g. A, B, C, D) that drive algorithmic plan generation. Priority: must-have
  > Socrates: Counter-argument considered: "priorities without algorithm effect are dead UI." Resolution: kept and strengthened — priorities must influence generation.

### Plan
- FR-004: Member can generate a running plan into the calendar via algorithms (generation is fast; the algorithm is continuously improved from agent proposals reviewed in the admin profile). Priority: must-have
  > Socrates: User resolution: generation is algorithmic and kept fast; complexity lives in an evolving algorithm fed by admin-facing agent proposals — not slow one-shot LLM plan writing. Also: frozen workouts can anchor generation (see FR-013).
- FR-013: Member can freeze specific workouts around which the algorithm generates the rest of the plan; the agent checks whether the overall plan still makes sense. Priority: must-have
  > Socrates: Captured from FR-004 challenge response (frozen anchors + whole-plan coherence check).
- FR-005: Member can view the plan in a calendar and manually edit a workout. Priority: must-have
  > Socrates: Counter-argument considered: "edit without undo/versioning causes plan chaos." Resolution: kept; undo or version restore is required alongside edit (capture as acceptance need for FR-005).

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

### Admin
- FR-011: Admin can review hidden agent gap reports and algorithm-improvement proposals (without notifying the member). Priority: must-have
  > Socrates: Counter-argument considered: "must-have earlier or the algorithm does not mature in 12 weeks." Resolution: raised from nice-to-have to must-have; tied to FR-004 algorithm evolution.

## User Stories

### US-01: First plan with chat-gated adaptation

- **Given** a logged-in Member with profile prefs and at least one A-priority race
- **When** they generate a plan, then ask chat to change a specific day (or report poor sleep)
- **Then** they see an updated calendar proposition (with warning from validator if present); member can either accept changes or reject, or continue discussion with chat to further modify

## Seed idea (verbatim from docs/opis_hardfeelings)

### Główny problem
Planowanie i bieżące dostosowywanie treningów biegowych (pod zawody, preferencje i realnie wykonane jednostki) jest rozproszone i trudne do utrzymania poza dedykowaną aplikacją — ręczne pliki/skille nie skalują się na wielu użytkowników ani na ciągłą adaptację planu.

### Najmniejszy zestaw funkcjonalności
- Konta użytkowników i profil (preferencje: m.in. objętość km/tydzień, typy treningów, waga i inne parametry wpływające na plan)
- Kalendarz zawodów (dodawanie/usuwanie wydarzeń, cel na zawody)
- Generowanie i adaptacja planu biegowego algorytmami (progresja, typy jednostek: easy/tempo/próg/interwały itd.) — wyzwalane z UI („generuj plan”) lub przez agenta AI na prośbę użytkownika
- Integracja ze Stravą oraz tryb bez Stravy (ręczne logowanie treningów lub przez chat z agentem)
- Podgląd planu w kalendarzu, ręczna edycja treningów
- Chat z agentem: dyskusja o treningu, korekty, dodawanie wydarzeń/preferencji; zmiany z chatu przechodzą przez walidatory algorytmiczne (rozsądne granice vs plan)
- Panel admina: ukryte zgłoszenia luk/uwag agenta do reguł/algorytmów/skilli (bez informowania użytkownika)

### Co NIE wchodzi w zakres MVP
- Treningi siłowe / inne dyscypliny (później)
- Specjalizacja wyłącznie trail lub wyłącznie płaskie — jeden uniwersalny planer biegowy
- Aplikacje natywne (na początek web)
- Współdzielenie planów między użytkownikami / social
- Zaawansowana analityka wydajnościowa poza tym, co potrzebne do adaptacji planu

### Kryteria sukcesu
- Użytkownicy ręcznie zmieniają ≤ 25% jednostek względem planu wygenerowanego algorytmem
- Modyfikacje zaproponowane przez AI w chacie w ≥ 80% przypadków przechodzą walidatory bez odrzucenia jako poza granicami

## Forward: external workout-tracking sync (tech-stack / implementation)

Product surface is “connect an external workout-tracking service” (FR-010, nice-to-have). Named first integration target: Strava — implement Strava sync first when wiring the optional sync path; other providers may follow later. Do not lock the PRD to a vendor name.

## Forward: lessons from plan-biegowy-md-beta (informational)

Prior personal workflow (Markdown plans + Cursor skills + external workout-tracking sync) hit recurring issues: fragile MD edits (encoding/CRLF), agent-driven plan updates that still produced errors, Windows/Python env traps, and no multi-user scale. Treat as status-quo cost signal for shaping — not as product requirements. First sync target when building remains Strava (see Forward above).
