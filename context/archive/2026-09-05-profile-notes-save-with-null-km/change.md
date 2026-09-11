---
change_id: profile-notes-save-with-null-km
title: Save coach notes when weekly km is empty
status: archived
created: 2026-09-05
updated: 2026-09-05
archived_at: 2026-09-05T16:10:00Z
---

## Notes

Human 2026-09-05 — take the FU-146 alternative. Coach notes Save must work when Weekly km is empty (`weeklyKm: null`). Source: FU-146.

Files: `src/components/setup/SetupForm.tsx` (and tests). PUT `/api/profile` already accepts `weeklyKm: null` plus `coachNotes`. No migration.

**Klik:** in-page (fetch PUT). Not document load.

- [ ] S-146.1 When Weekly km is empty, **Save** on coach notes still sends `PUT /api/profile` with `weeklyKm: null`, current long/rest/mix, and `coachNotes`. Do not show **Save weekly km before saving coach notes**.
- [ ] S-146.2 After that Save, without reload: notes stay as saved; km stays empty; **No weekly km set yet** still visible; last race / mix / long / rest unchanged.
- [ ] S-146.3 Reload / GET: `coachNotes` persisted; `weeklyKm` still `null`.
- [ ] S-146.4 Empty notes still save as SQL NULL (existing trim → null). One Save on the notes form; do not add a second button.

### Do not

Require weekly km to be set before notes Save. Restyle Profile. Change last-race PATCH.
