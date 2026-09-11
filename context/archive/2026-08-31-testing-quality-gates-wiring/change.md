---
change_id: testing-quality-gates-wiring
title: Quality-gates wiring
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Quality-gates wiring".
Risks covered: cross-cutting (§3 and §5) — CI must fail if Phase 1–3 suites fail; Playwright on accept-in-UI only if research shows HTTP tests miss a real Accept-in-UI failure.
Test types: CI gates; Playwright only if still needed.
Risk response: fail CI if ownership, accept persist-skip, generate oracle, API contracts, or migration-safety harness fail; challenge “add e2e because it feels safer”; do not enable HF_MIGRATION_PG in CI; do not invent a second workflow if one job already runs npm test.
