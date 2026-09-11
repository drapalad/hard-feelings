---
change_id: dashboard-tab-preserve-search
title: Keep other query params when switching dashboard tabs
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T07:43:13Z
---

## Notes

LOCKED. Human 2026-09-02 (FU-068): other query params (e.g. a future `weekStart`) must survive a tab click.

On tab click, merge `tab` into the existing query string instead of replacing it with `pathname?tab=` only. Keep `history.replaceState` (no `pushState`). Preserve other search params and the hash. Still parse `?tab=week|profile`; missing or anything else → week. SSR `initialTab` stays in sync.

Do not restyle tabs, H1, or the card. Do not restore the welcome email. Do not invent `weekStart` in the URL in this change — only stop dropping whatever is already there.
