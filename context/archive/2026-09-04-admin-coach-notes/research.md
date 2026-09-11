---
date: 2026-09-04T16:05:00+02:00
researcher: wave-audit
git_commit: 760e00179b4676413204b47e76f7a7b25770bdd0
branch: master
repository: hard-feelings
topic: "admin-coach-notes: files named in Notes"
tags: [research, wave-audit]
status: complete
last_updated: 2026-09-04
last_updated_by: wave-audit
---

# Research: admin-coach-notes

## Research Question
What exists at HEAD for the files listed in Notes?

## Summary

- `project_settings` columns are `id`, `openai_model`, `updated_at`, `updated_by` (`supabase/migrations/20260831194000_project_llm_settings.sql:4-13`). No `coach_notes`. RLS: `project_settings_select_authenticated`, `insert_admin`, `update_admin` (`:17-46`).
- Admin page 404s when `!Astro.locals.isAdmin` (`src/pages/admin.astro:14-16`). Chat-model card mounts `AdminLlmSettings` with openaiModel / resolvedModel / envFallback only (`:54-59`, `src/components/admin/AdminLlmSettings.tsx:6-10`).
- `PATCH /api/admin/settings` body is `{ openaiModel }` (`src/pages/api/admin/settings.ts:16-18`, `:52-69`). GET payload is openaiModel / resolvedModel / envFallback (`:24-30`). Non-admin → `notFound()` (`:37-38`).
- `llm-settings.ts` reads/writes `openai_model` only (`src/lib/services/llm-settings.ts:7-12`, `:41`, `:61`).
- `systemPrompt` has horizon, Profile JSON, currentLoad, optional extra; no operator free-text (`src/lib/services/openai-chat.ts:310-348`). Extra follow-up reuses `complete` with `extra` (`src/lib/services/chat.ts:564-565`).

## Code References

- `supabase/migrations/20260831194000_project_llm_settings.sql:4-46` - table + RLS
- `src/pages/admin.astro:14-59` - isAdmin 404 + Chat model island
- `src/components/admin/AdminLlmSettings.tsx:6-21` - props / SettingsPayload
- `src/components/admin/AdminLlmSettings.tsx:98` - PATCH body openaiModel
- `src/pages/api/admin/settings.ts:16-73` - GET/PATCH
- `src/lib/services/llm-settings.ts:7-23` - model id schema + resolve
- `src/lib/services/openai-chat.ts:310-348` - systemPrompt
- `src/lib/services/chat.ts:534-581` - completeSendTurn first-pass + extra
- `src/pages/api/admin/settings.test.ts:40-53` - 404 for non-admin GET/PATCH

## Architecture Insights

Admin settings are a singleton row `id = 'default'`. Members already SELECT `project_settings` (authenticated policy); injecting notes into the LLM does not require members to see the admin textarea. Both first-pass and dataRequest follow-up go through the same `systemPrompt`.

## Open Questions

- Test harness / migrate path for `project_settings.coach_notes` (filename list + migrate-over-fixture; see `migration-safety.test.ts:12-24`).
- Whether GET settings for the admin island should keep returning only model fields plus notes, or a wider payload — `isSettingsPayload` in AdminLlmSettings currently requires `resolvedModel` (`:46-53`).
- Hosted RLS vs migration comments; not re-verified live.
- `chat.ts` also used by five other wave ids — merge order, not a missing caller map.
