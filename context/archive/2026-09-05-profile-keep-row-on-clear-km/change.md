---
change_id: profile-keep-row-on-clear-km
title: Keep last race and notes when weekly km is cleared
status: archived
created: 2026-09-05
updated: 2026-09-05
archived_at: 2026-09-05T15:50:12Z
---

## Notes

Human 2026-09-04 — take the alternative; clearing km must not wipe last race / notes. Stop deleting `profiles` when weekly km is cleared. Source: FU-134.

Human 2026-09-05 — locks below. Migracja: `weekly_km` nullable (CHECK: NULL albo 0 < km ≤ 300). Hosted apply = DEP.

Files: `src/components/setup/SetupForm.tsx`, `src/lib/services/profile.ts`, `src/lib/services/profile-races.ts`, `src/pages/api/profile.ts`, `src/pages/api/profile.test.ts`, migration under `supabase/migrations/`.

**Klik:** in-page (fetch PUT). Not DELETE, not document load.

### Option

tak — puste Weekly km = PUT `weeklyKm: null`; wiersz zostaje.

- [ ] S-134.1 Empty Weekly km Save sends `PUT /api/profile` with `weeklyKm: null` plus the current long/rest/mix (and does not send DELETE). Zod accepts `null` here; 0 and negatives stay invalid.
- [ ] S-134.2 After that Save, without reload: km input is empty; the line **No weekly km set yet** is visible; last race fields, coach notes, long/rest checks, and mix fields stay filled as they were.
- [ ] S-134.3 Reload / GET: `weeklyKm` is `null`; `lastRaceDate` / `lastRaceKm` / `lastRaceTimeSec`, `coachNotes`, long/rest/mix are unchanged from before the clear.
- [ ] S-134.4 `PATCH` last race still works when km is null (row exists). Do not 404 just because km is empty.
- [ ] S-134.5 Remove the SetupForm `DELETE /api/profile` clear-km path. Remove API `DELETE` too if nothing else needs a full-row wipe (today only this form used it). Do not add a second Save.

### Do not

Clear last race, notes, or prefs when km is cleared. Use a sentinel km (0) instead of NULL. Restyle the Profile tab.
