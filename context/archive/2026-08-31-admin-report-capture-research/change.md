---
change_id: admin-report-capture-research
title: When agent_reports rows are captured, and whether to change that
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Pytanie: kiedy dziś powstaje wiersz agent_reports, czego NIE łapiemy, i czy to zmienić. Nie implementuj.
Zakotwicz: shouldCaptureHardBoundReport w src/lib/services/agent-report.ts; insert w sendMessage po insertPending; tylko mutations + validatePlan.hard.length > 0.
Poza zakresem (dziś nie tworzą findingów): soft warnings, explain/log, unmapped help, LLM-unavailable, generate failures, Reject.
Powiązane, węższe: FU-012 (unmapped jako kind=gap) — nie zamykaj go tu.

Sources: context/backlog.md → FU-014, FU-012; slice S-06 context/archive/2026-08-17-admin-algorithm-feedback; PRD FR-011.

Uniqueness: must not exist in `context/changes/` or `context/archive/`. In-flight: `astro-disable-dev-toolbar`, `weekly-volume-float-round`, `bootstrap-verification`.
