---
change_id: dashboard-tab-url
title: Open Profile from the URL and drop the duplicate welcome email
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:11Z
---

## Notes

LOCKED. Files: `src/components/dashboard/DashboardTabs.tsx`, `src/components/dashboard/dashboard-tabs.ts` (parser / types), `src/pages/dashboard.astro` (pass `initialTab` from the query; delete the welcome line).

### Today

Week / Profile live only in React `useState` (default week). Clicking a tab does not change the URL; `/dashboard?tab=profile` still shows Week after hydrate. Under the Dashboard H1 there is `Welcome, {user.email}` — the same address is already in the topbar.

### Do

1. Parse `?tab=week|profile`; anything else or missing → week. Pass `initialTab` from `Astro.url.searchParams` into the island so SSR HTML matches the client (React 19 will not patch a hydrate mismatch).

2. On tab click: `history.replaceState` to the same pathname with `?tab=`. Do not `pushState`. No `popstate` listener required.

3. Remove the “Welcome, {email}” paragraph from `dashboard.astro`. Keep the Dashboard H1. Keep the email in the topbar.

### Do not

- Change SetupForm, PlanWorkspace, km/race validation, generate, or chat.
- Restyle the dashboard card, H1, or tabs (chrome already shipped).
- Change Topbar layout, wordmark, or remove the topbar email (declined).
- Other query params.

### Visible

`/dashboard?tab=profile` shows Weekly kilometres and the race list without clicking Profile. Refresh keeps the tab. There is no welcome email under the H1; the address remains in the topbar.

Do not run in parallel with other edits to `dashboard.astro` if any appear later in the same wave — this change owns that file for this slice.
