---
change_id: testing-migration-data-safety
title: Migration data safety
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Migration data safety".
Risks covered: #4 (a schema/migration or similar DB change destroys or rewrites existing member rows).
Test types: integration (migrate-over-fixture).
Risk response: prove apply the new migration onto a DB that already has member rows; those rows still exist and remain readable by the owner; challenge "migration applied" means data preserved; avoid schema dump snapshot as the oracle.
