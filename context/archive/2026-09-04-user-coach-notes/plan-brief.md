# Member coach notes on Profile — Plan Brief

> Full plan: `context/changes/user-coach-notes/plan.md`
> Research: `context/changes/user-coach-notes/research.md`

## What & Why

Members have no durable place to tell the coach constraints (schedule quirks, injuries, preferences). Persist free-text Coach notes on `profiles`, edit them on Profile, and inject `Member coach notes: <text>` into every first-pass `systemPrompt` when non-empty (S-01.1–S-01.5), option (a) only.

## Starting Point

`profiles` has weekly km, prefs, mix, and last-race fields. PUT upserts prefs only; PATCH is last-race. First-pass `systemPrompt` ships Profile JSON + load, no member free-text line. SetupForm has no Coach notes textarea. Research `git_commit` predates last-race; this plan is grounded on current HEAD.

## Desired End State

On Profile, a Coach notes textarea Saves and reloads with the text. Completions receive a dedicated `Member coach notes:` line when the column is non-empty, and omit it when empty. Last-race persist stays intact.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| ------------------------------ | ----------------- | ----------------- | ---------------- |
| Type home | `coachNotes` on `ProfileView` only, not `Profile` / `ProfilePatch` | Chat freeze upserts a prefs-only `Profile`; last-race used the same split | Plan |
| Save shape | Own section + own Save; PUT prefs + `coachNotes`; weekly-km Save omits the key (zod must not default omitted → `null`) | Notes lock PUT + a section Save; omit-to-preserve matches last-race PUT | Unattended |
| Empty column | Store SQL NULL (GET `null`, UI `""`) | Notes allow null or empty string; null matches last-race unset | Unattended |
| Over-length | Server clamp (`slice(0, 2000)`), not 400 | Notes say clamp; extra keys still strip | Plan |
| Prompt inject | Dedicated line in `systemPrompt`; extra follow-up included; keep field on Profile JSON | S-01.4 forbids burying *only* in JSON; both completions share `systemPrompt` | Plan |
| SSR seed | Pass `coachNotes` through `dashboard.astro` → `DashboardTabs` → `SetupForm` | First paint without a post-mount GET; same wiring as last-race | Unattended |
| Lint gate | Touched-file eslint, not repo-wide `npm run lint` | HEAD is already red on untouched training-load / pace-estimate files | Unattended |

## Scope

**In scope:** Migration `20260904120000_profile_coach_notes.sql`; `ProfileView.coachNotes`; optional `coachNotes` on `profileWriteSchema`; conditional `upsertProfile` write; PUT/GET contracts; Coach notes UI + SSR; `systemPrompt` inject; migration-safety list; DEP-025 for hosted apply.

**Out of scope:** option (b); admin-global / `project_settings` notes; race/mix/last-race changes; notes on `Profile`/`ProfilePatch`; new RLS; hosted `db push`; Playwright; DELETE-on-empty-km; HEAD lint in training-load files.

## Architecture / Approach

SSR `getProfile` seeds the textarea. Coach notes Save PUTs current prefs plus `coachNotes`. Weekly-km Save omits `coachNotes` so the column survives. `upsertProfile` writes `coach_notes` only when the key is present. `systemPrompt` adds `Member coach notes:` when trimmed text is non-empty.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --------- | ------------------------- | ------------------------- |
| 1. Migration, types, service | Column + `ProfileView` + schema clamp + conditional upsert; GET/PUT JSON gains `coachNotes: null` | Filename sorts before last-race; freeze PUT wiping notes; existing `toEqual` fixtures |
| 2. PUT contracts | Write / empty / clamp / omit-to-preserve / owner strip | Omitting the key vs writing null; last-race still preserved |
| 3. UI + prompt | Textarea Save, SSR seed, `Member coach notes:` inject | Seed-in-effect flash; burying notes only in Profile JSON |

**Prerequisites:** none (Depends on: none). Do not land in parallel with `admin-coach-notes` or other Notes-listed collisions (`openai-chat.ts` / `chat.ts` / `SetupForm` / `profile.ts`).
**Estimated effort:** ~1 session, 3 phases

## Open Risks & Assumptions

- Hosted schema stays behind until DEP-025; production Coach notes Save will 500 until applied.
- Empty weekly km DELETE still drops notes with the row (FU-134).
- Empty storage as NULL rather than `""` is FU-136.

## Success Criteria (Summary)

- Coach notes round-trip on GET after PUT and survive a prefs-only PUT
- Over-length input is stored at 2000 characters, not 400
- First-pass system message contains `Member coach notes:` iff notes are non-empty
