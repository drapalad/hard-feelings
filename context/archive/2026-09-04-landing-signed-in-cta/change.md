---
change_id: landing-signed-in-cta
title: Signed-in landing hero opens the dashboard
status: archived
created: 2026-09-04
updated: 2026-09-05
archived_at: 2026-09-05T15:28:34Z
---

## Notes

Files: `src/components/Welcome.astro`.
Depends on: none.

### Sequencing

Not in parallel with `topbar-plan-nav` if both touch signed-in chrome in the same PR; this change must not restyle Topbar (S-07.4). After `topbar-plan-nav`, the topbar will not show the word Dashboard — the landing CTA label **Open dashboard** stays.

### Option

tak — signed-in hero **Open dashboard** → `/dashboard`; signed-out keeps Sign In / Sign Up.

### Today

Landing hero always renders Sign In → `/auth/signin` and Sign Up → `/auth/signup`. Topbar already branches on `Astro.locals.user` (email, Dashboard, Sign out). Welcome never reads `user`.

### Requirements

- [ ] S-07.1 When `Astro.locals.user` is set, the landing hero primary CTA is **Open dashboard** and links to `/dashboard`.
- [ ] S-07.2 When signed in, do not render hero Sign In or Sign Up.
- [ ] S-07.3 When signed out, keep the current hero Sign In and Sign Up buttons (same hrefs and styles).
- [ ] S-07.4 Do not restyle Topbar; it already shows Dashboard + Sign out when signed in.

### Do not

Change auth pages, middleware, or footer.

### Visible

Signed-in `/` hero has Open dashboard only; no Sign In/Up in the hero.
