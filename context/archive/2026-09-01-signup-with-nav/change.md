---
change_id: signup-with-nav
title: Put the same topbar on sign-up as on sign-in
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:11Z
---

## Notes

LOCKED. File: `src/pages/auth/signup.astro` only.

### Today

Sign-up is a centered card plus footer, no topbar. Sign-in already has `Topbar` and a `p-4 sm:p-8` wrapper (`bg-cosmic flex min-h-screen flex-col`).

### Do

Import `Topbar`. Match the sign-in page chrome: outer `bg-cosmic flex min-h-screen flex-col p-4 sm:p-8`, `<Topbar />` above the card, inner flex without a second `p-4` on the card column.

### Do not

- Restyle the card, fields, or Create account button.
- Edit `signin.astro` or `Topbar.astro` (current-page Dashboard text is `dashboard-nav-current`).
- Change SignUpForm validation.

### Visible

`/auth/signup` shows “Not signed in / Sign in / Sign up” above the card, same as sign-in.
