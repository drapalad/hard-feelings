---
change_id: admin-coach-notes
title: Admin coach notes injected into every member chat completion
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:21Z
---

## Notes

Files: `src/pages/admin.astro`, `src/components/admin/AdminLlmSettings.tsx`, `src/pages/api/admin/settings.ts`, `src/lib/services/llm-settings.ts`, `src/lib/services/openai-chat.ts`, `src/lib/services/chat.ts`.
Depends on: none.

### Sequencing

Not in parallel with `user-coach-notes`, `iso-week-bleed-volume`, `coach-races-context-accept`, `flag-admin-technical` (`openai-chat.ts` / `chat.ts`). Not in parallel with `flag-admin-technical` if both touch `src/pages/admin.astro`.

### Option

(a) `project_settings.coach_notes text` + admin textarea + inject on every member completion (first-pass and extra follow-up).
Do not ship (b) env `COACH_ADMIN_NOTES`.

### Today

`project_settings` has id, openai_model, updated_at, updated_by. PATCH `/api/admin/settings` writes only `openaiModel`. `systemPrompt` in openai-chat has horizon + Profile JSON + currentLoad + optional extra; no operator free-text. Both first-pass and extra follow-up call the same `complete` → `systemPrompt`.

### Requirements

- [ ] S-02.1 On the Admin Chat model card, add a **Coach notes (all members)** textarea and Save (same visual family as OpenAI model). Members never see or edit this field.
- [ ] S-02.2 Persist `coachNotes` on `PATCH /api/admin/settings` (extend the zod body); server-clamp to 2000 characters; empty stores as null/empty string. GET settings returns `coachNotes`.
- [ ] S-02.3 Load `coachNotes` with the admin page into AdminLlmSettings; default empty when the column is null.
- [ ] S-02.4 On every member chat completion (first-pass and extra follow-up), inject `Admin coach notes: <text>` into `systemPrompt` in openai-chat when non-empty; omit the line when empty. Do not inject only on first-pass.
- [ ] S-02.5 Option (a) is the column + admin UI + inject. Do not ship (b) env-only `COACH_ADMIN_NOTES` unless chosen.

### Do not

Add `profiles.coach_notes`; change the model picker; drop isAdmin gating on `/admin`; migrate a live database from a mock.

### Supabase

Migration `20260904120100_project_coach_notes.sql` — `ALTER TABLE project_settings ADD COLUMN coach_notes text`; existing policies (`project_settings_select_authenticated`, `project_settings_insert_admin`, `project_settings_update_admin`) cover the new column; do not add RLS. Decision-pack Admin UI was mocked (hardcoded textarea, no write; `/admin` unlocked only for the screenshot) — implement the real column and keep the isAdmin 404, not a stub.

### Visible

Admin shows a Coach notes textarea with persisted global text; every member chat completion receives that text as `Admin coach notes:`.
