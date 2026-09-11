---
change_id: collapsed-add-race
title: Collapse the add-race form behind a button
status: archived
created: 2026-09-01
updated: 2026-09-01
archived_at: 2026-09-01T13:23:01Z
---

## Notes

File: `src/components/setup/SetupForm.tsx`.

Today the empty Date / Priority / Name / Goal form is always open above Upcoming, so a one-race list sits under a unused form.

Do: default collapsed — **Add race** button + Upcoming visible. Click opens the same fields and submit as today. Cancel closes add and edit. Pencil still opens edit. Weekly km stays above the race block. Do not add Week/Profile tabs (dashboard-profile-tab). After that tab ships, this still applies inside Profile.
