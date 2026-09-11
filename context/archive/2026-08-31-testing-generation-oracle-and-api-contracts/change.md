---
change_id: testing-generation-oracle-and-api-contracts
title: Generation oracle and API contracts
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Generation oracle and API contracts".
Risks covered: #3 (generate success but week not executable vs declared weekly km), #5 (server persists plan/log mutation from untrusted client input).
Test types: unit + integration/contract.
Risk response: #3 prove after generate total week volume is coherent with declared weekly km using an independent oracle (not generator output); challenge HTTP 200 + rows means executable; avoid snapshot of generated units as expected km. #5 prove invalid or forged mutation is rejected and persisted row does not take a client-supplied owner; challenge client-side schema equals server contract; avoid mirroring the handler’s parse in the test.
