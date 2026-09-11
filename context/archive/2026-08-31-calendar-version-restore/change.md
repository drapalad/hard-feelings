---
change_id: calendar-version-restore
title: Week-history picker that survives generate and accept
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

LOCKED DECISIONS:
- Week-history picker (PRD FR-005: undo or version restore). Undo/restore must also work across Generate: restoring returns to the week as it was before generate, and Generate must not wipe the revision stack.
- Leave FU-002 open: manual save stays warnings-only, no 409 on hard bounds.

Sources: context/backlog.md → FU-001; PRD FR-005; slice S-04 context/archive/2026-08-14-calendar-manual-edit; roadmap S-04 notes (version picker still FU-001).
