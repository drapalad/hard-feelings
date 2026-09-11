---
change_id: dashboard-chrome
title: Solid dashboard card and drop duplicate sign out
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

File: `src/pages/dashboard.astro` only.

Today the main card is `bg-white/10` + `backdrop-blur-xl`; H1 uses `bg-clip-text` gradient (`from-blue-200 to-purple-200`). A second Sign out form sits at the bottom of that card; Topbar already has Sign out.

Do: card `bg-slate-950`, keep `border-white/10`, drop blur and `bg-white/10`. H1 solid `text-white`. Remove the bottom Sign out form. Keep Topbar Sign out, SiteFooter, `bg-cosmic` on the page. Nested glass on setup/week/chat stays. Do not change Topbar layout, wordmark, or the email in the bar (that was declined). Same file as dashboard-profile-tab — sequence or merge carefully.
