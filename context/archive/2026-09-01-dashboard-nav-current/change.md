---
change_id: dashboard-nav-current
title: Show Dashboard as current-page text in the topbar
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:11Z
---

## Notes

LOCKED. File: `src/components/Topbar.astro` only.

### Today

When signed in, the topbar always renders “Dashboard” as `<a href="/dashboard">` with `text-purple-300`, including on `/dashboard` itself. Email is on the left; Sign out on the right.

A previous change that would have replaced the email with a wordmark was declined. Keep the email.

### Do

If `Astro.url.pathname` is `/dashboard` or `/dashboard/`, render “Dashboard” as plain text (`span`, `text-white`, `aria-current="page"`), not a link. On every other path, keep the existing purple link. Sign out and email unchanged.

### Do not

- Remove the email from the topbar.
- Add a product wordmark or a HardFeelings link to `/`.
- Change Sign out, Admin, the Dashboard H1, tabs, or welcome (welcome is owned by `dashboard-tab-url`).

### Visible

On `/dashboard`, “Dashboard” in the bar is white current-page text; Sign out stays a purple control; the email is still visible. On `/` or `/auth/signin`, Dashboard remains a link.
