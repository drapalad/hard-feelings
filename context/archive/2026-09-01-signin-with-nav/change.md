---
change_id: signin-with-nav
title: Sign-in page with site topbar and solid card
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

File: `src/pages/auth/signin.astro`. Import existing `Topbar.astro`.

Today sign-in is only a glass card (`bg-white/10` + `backdrop-blur-xl`) on `bg-cosmic`, no site nav. Landing and privacy already have Topbar.

Do: Topbar above the card (signed-out: “Not signed in” + Sign in / Sign up). Card `bg-slate-950`, drop blur and `bg-white/10`. Keep H1, form fields, Privacy footer, `bg-cosmic`. Sign-up page out of scope unless copying the same two classes is trivial. Do not restyle Topbar itself.
