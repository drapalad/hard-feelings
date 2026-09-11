---
change_id: landing-feature-solid
title: Make landing feature cards solid like the dashboard card
status: archived
created: 2026-09-01
updated: 2026-09-02
archived_at: 2026-09-02T07:43:10Z
---

## Notes

LOCKED. File: `src/components/Welcome.astro` — class names on the three feature cards only.

### Today

Cards are `rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl`. Hero H1 is already solid white (quiet landing shipped). Dashboard/auth cards use solid `bg-slate-950`.

### Do

Drop `backdrop-blur-xl`. Set background to `bg-slate-950`. Keep `border border-white/10`, icons, titles, and body copy.

### Do not

- Change H1, tagline, Sign In / Sign Up CTAs, Topbar, or footer.
- Restyle auth or dashboard cards.
- Bring back stars, orbs, or gradient H1.

### Visible

The three cards under the hero look solid (slate), not frosted glass, consistent with the dashboard card.
