---
change_id: dashboard-profile-tab
title: Hide athlete setup behind a Profile tab
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

Today `/dashboard` stacks SetupForm (weekly km + race calendar) above PlanWorkspace (week + chat), so the plan sits below the fold. Add a client island with tabs **Week** (default) and **Profile**. Week renders PlanWorkspace; Profile renders SetupForm. Files: `src/pages/dashboard.astro`, new wrapper under `src/components/` (e.g. dashboard tabs). Do not restyle the glass card or gradient H1 (dashboard-chrome). Do not change chat. After this ships, the collapsed add-race form (collapsed-add-race) lives on Profile.
