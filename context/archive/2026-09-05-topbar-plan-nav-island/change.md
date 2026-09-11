---
change_id: topbar-plan-nav-island
title: Switch mobile plan nav to a Topbar island without a full reload
status: archived
created: 2026-09-05
updated: 2026-09-05
archived_at: 2026-09-05T15:28:34Z
---

## Notes

Human 2026-09-04 — take the island alternative. Topbar `client:load` island that `replaceState`s `?tab=` (no full reload). Source: FU-133.

Files: `src/components/Topbar.astro` (island), dashboard tab panel so it follows `?tab=` without reload (`src/components/dashboard/DashboardTabs.tsx` and/or `src/pages/dashboard.astro`). Do not restyle Topbar chrome (email, Admin, Sign out). Landing `Welcome.astro` is out of scope.

**Klik:** replaceState — only the mobile Plan `<select>` while pathname is `/dashboard`. Not document load, not GET form submit.

- [ ] S-133.1 Mobile Plan control stays a `<select aria-label="Plan">` with options **Calendar**, **List**, **Profile** (same labels). It is a `client:load` island.
- [ ] S-133.2 On `/dashboard`, changing that select `replaceState`s `?tab=` (keep other query params). No full reload. The visible panel (calendar / list / profile) follows the new tab.
- [ ] S-133.3 Off `/dashboard` (e.g. `/`), changing Plan still goes to `/dashboard?tab=…` (assign/GET is OK — there is no dashboard panel to swap in-place).
- [ ] S-133.4 Desktop (`sm:flex`) Calendar / List / Profile stay the same `<a href="/dashboard?tab=…">` / current-page `<span>`. **Klik:** document load. Do not convert them to the island.
- [ ] S-133.5 Sign out stays POST `/api/auth/signout`. Email and Admin link unchanged.
