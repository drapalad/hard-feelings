---
change_id: testing-critical-path-ownership-and-bounds
title: Critical-path ownership and bounds
status: archived
created: 2026-08-24
updated: 2026-08-31
archived_at: 2026-08-31T14:11:06Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Critical-path ownership and bounds".
Risks covered: #1 logged-in Member B can read or change Member A’s plan or workout logs; #2 a chat/LLM calendar change lands even though it violates hard algorithmic bounds; #6 unauthenticated caller reaches gated plan, chat, or log routes. Test types planned: integration.
Risk response intent:
- #1: prove B’s authenticated request for A’s plan/logs is denied and does not return or mutate A’s rows.
- #2: prove an out-of-bounds proposition cannot be accepted and the calendar is unchanged.
- #6: prove a logged-out request to gated plan/chat/log routes does not return member data.
After creating the folder, follow the downstream continuation rule.
