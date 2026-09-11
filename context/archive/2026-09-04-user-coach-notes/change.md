---
change_id: user-coach-notes
title: Member coach notes on Profile injected into every first-pass
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:20Z
---

## Notes

Files: `src/types.ts`, `src/lib/services/profile.ts`, `src/lib/services/profile-races.ts`, `src/pages/api/profile.ts`, `src/components/setup/SetupForm.tsx`, `src/lib/services/openai-chat.ts`, `src/lib/services/chat.ts`.
Depends on: none.

### Sequencing

Not in parallel with `admin-coach-notes`, `iso-week-bleed-volume`, `coach-races-context-accept`, `flag-admin-technical`, `chat-delete-units` (`openai-chat.ts` / `chat.ts`). Not in parallel with `persist-race-result` (`SetupForm.tsx`, `profile.ts`).

### Option

(a) `profiles.coach_notes text` + Profile textarea + inject on every first-pass (max ~2k, server clamp).
Do not ship (b) local-only textarea.

### Today

`profiles` has weekly_km, long/rest weekdays, mix_*. `Profile` has no notes field. `PUT /api/profile` upserts those prefs only. First-pass `systemPrompt` ships Profile JSON + load; no member free-text constraints.

### Requirements

- [ ] S-01.1 On the Profile tab, add a **Coach notes** section with a textarea and Save (same visual family as Weekly kilometres).
- [ ] S-01.2 Persist `coachNotes` on `PUT /api/profile` (extend `profileWriteSchema`); server-clamp to 2000 characters; empty stores as null/empty string.
- [ ] S-01.3 Load `coachNotes` with GET profile into SetupForm; default empty when the column is null.
- [ ] S-01.4 On every first-pass completion, inject `Member coach notes: <text>` into `systemPrompt` in openai-chat when non-empty; omit the line when empty. Do not bury notes only inside Profile JSON.
- [ ] S-01.5 Option (a) is the column + inject. Do not ship (b) local-only unless chosen.

### Do not

Add admin-global notes; change race/mix fields; migrate a live database from a mock. Do not add `project_settings.coach_notes` here.

### Supabase

Migration `20260904120000_profile_coach_notes.sql` — `ALTER TABLE profiles ADD COLUMN coach_notes text`; existing own-row policies (`profiles_select_own` / `insert_own` / `update_own` / `delete_own`) cover the new column; do not add RLS. Decision-pack Profile UI was mocked (hardcoded textarea, no write) — implement the real column, not a stub.

### Visible

Profile shows a Coach notes textarea with persisted member text; first-pass completions receive that text as `Member coach notes:`.
