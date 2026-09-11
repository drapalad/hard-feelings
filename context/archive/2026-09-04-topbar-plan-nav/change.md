---
change_id: topbar-plan-nav
title: Calendar List Profile replace Dashboard in the topbar
status: archived
created: 2026-09-04
updated: 2026-09-04
archived_at: 2026-09-04T22:35:20Z
---

## Notes

Files: `src/components/Topbar.astro`, `src/components/dashboard/DashboardTabs.tsx`, `src/components/Topbar.test.ts`.
Depends on: none.

### Sequencing

Not in parallel with `landing-signed-in-cta` if both restyle signed-in chrome in one PR. This change owns Topbar; landing must not restyle it (S-07.4).

### Option

(a) replace Dashboard with Calendar / List / Profile; remove the in-page Dashboard tablist; keep `DashboardTabs` panels driven by the URL tab.
Do not ship (b) keep both navs.

### Today

Signed-in Topbar is email + Dashboard (+ optional Admin) + Sign out. Calendar / List / Profile live in an in-page Dashboard tablist; `?tab=` already selects the panel.

### Requirements

- [ ] S-11.1 Replace the Dashboard item with Calendar, List, and Profile links to `/dashboard?tab=calendar|list|profile` on the same row and in the same style as Admin.
- [ ] S-11.2 Mark the current dashboard tab from `Astro.url` with `aria-current="page"` (current tab is not a link); other plan items stay purple anchors.
- [ ] S-11.3 Below the `sm` breakpoint (390): show a native `<select>` (or details) instead of the three links; changing it navigates to that `?tab=`.
- [ ] S-11.4 Option (a): remove the in-page Dashboard tablist; keep `DashboardTabs` panels driven by the URL tab. Option (b): keep both navs — do not ship (b) unless chosen.
- [ ] S-11.5 Do not show the word Dashboard in the signed-in topbar.

### Do not

Change Sign out, email, Admin gating, auth pages, landing CTAs, or `?tab=` semantics (`week` → calendar).

### Visible

Topbar has Calendar / List / Profile (dropdown on mobile), no Dashboard label, and no second tab row.
