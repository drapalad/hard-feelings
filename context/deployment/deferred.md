---
project: hard-feelings
created: 2026-08-06
updated: 2026-09-07
status: open
---

# HardFeelings — Deploy task backlog

Living list of deploy/infra follow-ups. Append new tasks anytime; pick one up in a free moment. Not a runbook — first ship lives in `deploy-plan.md` (`status: shipped`).

Production today: `https://hard-feelings.ikul.workers.dev`  
Auto-deploy: push/merge to GitHub `master` → Cloudflare Workers Builds.

## How to use

1. **Do work** — set `Status: done`, tick the checkbox, leave a one-line note if useful.
2. **Add work** — copy the template below, bump the next free `DEP-NNN` id, fill **Source** (where the ask came from: plan section, PRD, chat, incident, etc.).
3. Keep **open** tasks at the top of each section; move **done** under `## Done` (or leave in place with `Status: done`).

### Task template (copy)

```markdown
### DEP-NNN — Short title
- [ ] **Status:** open
- **Source:** path/or/url — optional quote or section
- **Added:** YYYY-MM-DD
- **Notes:** optional context / acceptance
```

---

## Open

### DEP-034 — `SENTRY_ENABLED=false` on preview / pre-prod Workers
- [ ] **Status:** open
- **Source:** chat — Sentry local off-switch; reuse for pre-prod when DEP-003/004 exists
- **Added:** 2026-09-07
- **Notes:** Ingest is off when `SENTRY_ENABLED` is `false`/`0`/`off`/`no`, even if `SENTRY_DSN` is set. Unset keeps production ingest on. Set the flag on preview/pre-prod when those Workers exist; do not set it on production.

### DEP-003 — Non-production branch previews (+ Access if needed)
- [ ] **Status:** open
- **Source:** `context/deployment/deploy-plan.md` — Deferred / Phase E; `context/foundation/infrastructure.md` — Operational Story (Preview deploys)
- **Added:** 2026-08-06
- **Notes:** Turn on Workers Builds for non-production branches (`wrangler versions upload`). Add Cloudflare Access if previews can show member training data. S-01 now persists member profile/races so preview Access is in play. 2026-08-31: not needed while the only public Worker is `master` → `*.workers.dev` and work is verified locally; keep until we want clickable PR URLs. Not the same as DEP-004 staging.

### DEP-004 — Multi-env / `CLOUDFLARE_ENV`
- [ ] **Status:** open
- **Source:** `context/deployment/deploy-plan.md` — Deferred; `context/foundation/infrastructure.md` — Unknown Unknowns (per-environment deploys)
- **Added:** 2026-08-06
- **Notes:** Separate staging vs production Workers, secrets, and Supabase projects as needed. Build with `CLOUDFLARE_ENV=<name>` (Astro 6), not deploy-time `--env` alone. 2026-08-31: not needed yet; keep until a separate staging exists. Dual-remote (DEP-006) stays until then: origin for development, GitHub for deploy.

---

## Done

### DEP-033 — Put `SENTRY_DSN` on the production Worker
- [x] **Status:** done
- **Source:** M3L5 OPT / `context/changes/sentry-workers` — Worker wrap is in repo; ingest needs the secret
- **Added:** 2026-09-07
- **Done:** 2026-09-07
- **Notes:** Human — local `.dev.vars` and production `wrangler secret put SENTRY_DSN` (separate projects). Ingest confirmed 2026-09-07: smoke issues `hf-sentry-smoke-local-*` / `hf-sentry-smoke-preview-*` in the local Sentry project. Do not commit the DSN.

### DEP-032 — Apply agent_reports_delete_admin migration to hosted Supabase
- [x] **Status:** done
- **Source:** chat — admin Algorithm feedback delete control needs RLS DELETE
- **Added:** 2026-09-05
- **Done:** 2026-09-05
- **Notes:** Human 2026-09-05 — applied `20260905210000_agent_reports_delete_admin.sql` (`agent_reports_delete_admin` DELETE policy) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-031 — Apply calendar_creates pending column to hosted Supabase
- [x] **Status:** done
- **Source:** chat — extra-range creates outside the 14-day auto-apply window go through Accept
- **Added:** 2026-09-05
- **Done:** 2026-09-05
- **Notes:** Human 2026-09-05 — applied `20260905200000_chat_profile_freeze_pending_calendar_creates.sql` (`calendar_creates jsonb` on `chat_profile_freeze_pending`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-030 — Apply drop_plan_propositions migration to hosted Supabase
- [x] **Status:** done
- **Source:** Unattended / `context/archive/2026-09-03-chat-drop-pending-propositions/plan.md` — Phase 3
- **Added:** 2026-09-05
- **Done:** 2026-09-05
- **Notes:** Human 2026-09-05 — applied `20260905160000_drop_plan_propositions.sql` (`DROP TABLE IF EXISTS plan_propositions CASCADE`) to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-029 — Apply profile_weekly_km_nullable migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/archive/2026-09-05-profile-keep-row-on-clear-km/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-05
- **Done:** 2026-09-05
- **Notes:** Human 2026-09-05 — applied `20260905120000_profile_weekly_km_nullable.sql` (`weekly_km` nullable; CHECK NULL or (0 < km ≤ 300)) to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-028 — Apply chat_profile_freeze_pending races_patch migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/coach-races-context-accept/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Notes:** Human 2026-09-04 — applied `20260904210000_chat_profile_freeze_pending_races_patch.sql` (`races_patch jsonb` on `chat_profile_freeze_pending`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-027 — Apply unit_stages migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/workout-stages-make-ai/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Notes:** Human 2026-09-04 — applied `20260904121000_unit_stages.sql` (`stages jsonb` on `training_units`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-026 — Apply project_coach_notes migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/admin-coach-notes/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Notes:** Human 2026-09-04 — applied `20260904120100_project_coach_notes.sql` (`coach_notes text` on `project_settings`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-025 — Apply profile_coach_notes migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/user-coach-notes/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Notes:** Human 2026-09-04 — applied `20260904120000_profile_coach_notes.sql` (`coach_notes text` on `profiles`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-024 — Apply profile_last_race migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/persist-race-result/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-04
- **Done:** 2026-09-04
- **Notes:** Human 2026-09-04 — applied `20260904180000_profile_last_race.sql` (`last_race_date`, `last_race_km`, `last_race_time_sec` on `profiles`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-023 — Apply chat_threads migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/chat-threading/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Notes:** Human 2026-09-03 — applied `20260903130000_chat_threads.sql` (`chat_threads` + `chat_messages.thread_id` backfill) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-022 — Apply chat_profile_freeze_pending migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/chat-mutations-range-accept-admin/plan.md` — Phase 4 / Migration Notes
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Notes:** Human 2026-09-03 — applied `20260903123000_chat_profile_freeze_pending.sql` to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-021 — Apply log_pace_hr migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/log-pace-hr/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-03
- **Done:** 2026-09-03
- **Notes:** Human 2026-09-03 — applied `20260903140000_log_pace_hr.sql` (`avg_pace_sec_per_km` + `avg_hr` on `workout_logs`) to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-020 — Apply profile_plan_prefs migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/profile-plan-prefs/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-09-02
- **Done:** 2026-09-02
- **Notes:** Human 2026-09-02 — applied `20260902140000_profile_plan_prefs.sql` to hosted `hard-feelings`. Worker rollback does not undo this SQL.

### DEP-016 — Apply project_llm_settings migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/admin-llm-model-picker/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-31
- **Done:** 2026-08-31
- **Notes:** Applied `20260831194000_project_llm_settings.sql` (`project_settings` singleton + RLS) to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-011 — Privacy notice + cookie transparency (EU/PL)
- [x] **Status:** done
- **Source:** chat 2026-08-13 — session cookies exist; no consent UI or privacy/cookie page
- **Added:** 2026-08-13
- **Done:** 2026-08-31
- **Notes:** `/privacy` covers Supabase SSR session cookies (purpose, retention, legal basis) and is linked from landing and dashboard. No CMP; copy is not legal advice.

### DEP-006 — Decide role of self-hosted `git.uiol.pl` vs GitHub
- [x] **Status:** done
- **Source:** `context/deployment/deploy-plan.md` — Phase D5 / Deferred; current remotes (`origin` = uiol, `github` = GitHub.com)
- **Added:** 2026-08-06
- **Done:** 2026-08-31
- **Notes:** Keep dual-remote. `origin` (git.uiol.pl) for development pushes; `github` only to trigger Workers Builds. Revisit if/when DEP-004 staging exists.

### DEP-001 — Custom domain + DNS
- [x] **Status:** done
- **Source:** `context/deployment/deploy-plan.md` — Deferred; also `context/foundation/infrastructure.md` — Operational Story / Approval
- **Added:** 2026-08-06
- **Done:** 2026-08-31
- **Notes:** Production hostname is the Cloudflare-provided `https://hard-feelings.ikul.workers.dev`. No custom domain. Site URL / Redirect URLs already matched this origin in the v1 deploy-plan.

### DEP-002 — Workers Paid + CPU limit (when AI chat ships)
- [x] **Status:** done
- **Source:** `context/foundation/infrastructure.md` — Recommendation + Risk Register (free-tier 10ms CPU); `context/deployment/deploy-plan.md` — Deferred
- **Added:** 2026-08-06
- **Done:** 2026-08-31
- **Notes:** Production chat with live OpenAI works on Workers Free. LLM wait is wall-clock, not CPU. No Paid and no `cpu_ms` in `wrangler.jsonc`. Reopen if SSR/chat starts exceeding the 10ms CPU limit.

### DEP-007 — (Optional) GHA `SUPABASE_*` build secrets
- [x] **Status:** done
- **Source:** `context/deployment/deploy-plan.md` — Phase D6; `.github/workflows/ci.yml`
- **Added:** 2026-08-06
- **Done:** 2026-08-31
- **Notes:** CI already has secrets / does not need a new `gh secret set`. Last `github/master` Actions run (2026-08-25, “After hosted migrations and OpenAI secret”, [32827746916](https://github.com/drapalad/hard-feelings/actions/runs/32827746916)) is green including `npm run build`, which injects `SUPABASE_URL` / `SUPABASE_KEY`. Not a substitute for Worker runtime secrets.

### DEP-005 — Update `tech-stack.md` deployment hint
- [x] **Status:** done
- **Source:** `context/foundation/tech-stack.md` — `hints.deployment_target: cloudflare-pages`; flagged in `context/foundation/infrastructure.md` — Risk Register / Unknown Unknowns; `context/deployment/deploy-plan.md` — Assessment
- **Added:** 2026-08-06
- **Done:** 2026-08-27
- **Notes:** Frontmatter is `cloudflare-workers`; Why-this-stack now says Workers Builds on merge to `master`, not Pages / GHA deploy.

### DEP-014 — Put OPENAI_API_KEY on the production Worker
- [x] **Status:** done
- **Source:** `context/changes/llm-chat-proposer/plan.md` — Phase 3 / Migration Notes
- **Added:** 2026-08-16
- **Done:** 2026-08-25
- **Notes:** `OPENAI_API_KEY` and `OPENAI_MODEL` (`gpt-5.6-luna`) set via `wrangler secret put` on Worker `hard-feelings`. Production chat confirmed model-written. Worker rollback does not unset secrets.

### DEP-015 — Apply admin_algorithm_feedback migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/admin-algorithm-feedback/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-17
- **Done:** 2026-08-25
- **Notes:** Schema applied via `db push`. Admin granted on hosted to the same email as local `user_roles` (`dawsqeq@gmail.com`, hosted id `b6e49dbe-7e40-41be-816a-09d4b5981c19`). Snippet UUID stays local-only.

### DEP-013 — Apply workout_logs migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/workout-logging/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-15
- **Done:** 2026-08-25
- **Notes:** Applied `20260815160000_workout_logs.sql` to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-012 — Apply plan_revisions migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/calendar-manual-edit/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-14
- **Done:** 2026-08-25
- **Notes:** Applied `20260814140000_plan_revisions.sql` to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-010 — Apply chat_gated_adaptation migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/chat-gated-plan-adaptation/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-13
- **Done:** 2026-08-25
- **Notes:** Applied `20260813160000_chat_gated_adaptation.sql` (`chat_messages` + `plan_propositions` + RLS) to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-009 — Apply training_units migration to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/algorithmic-plan-generation/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-13
- **Done:** 2026-08-25
- **Notes:** Applied `20260813130000_training_units.sql` to hosted `hard-feelings` via `supabase db push`. Worker rollback does not undo this SQL.

### DEP-008 — Apply product migrations to hosted Supabase
- [x] **Status:** done
- **Source:** `context/changes/profile-and-race-calendar/plan.md` — Phase 1 / Migration Notes
- **Added:** 2026-08-13
- **Done:** 2026-08-13
- **Notes:** Applied `profiles` + `races` (and RLS) to the hosted project behind production `SUPABASE_URL`. Worker rollback does not undo this SQL.

---

## Ops cheat sheet (not tasks)

- Rollback: `npx wrangler deployments list` → `npx wrangler rollback [VERSION_ID]` (does not undo Supabase Auth / users).
- Day-2 deploy: `git push github master` — Cloudflare watches GitHub only. Push `origin` (git.uiol.pl) for development; that does not trigger Workers Builds.
