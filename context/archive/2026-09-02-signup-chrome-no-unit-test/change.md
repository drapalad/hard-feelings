---
change_id: signup-chrome-no-unit-test
title: Drop the signup chrome source-read unit test
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T07:43:12Z
---

## Notes

LOCKED. Human 2026-09-02 (FU-058): the colocated `signup.test.ts` source-read test is not wanted.

Delete `src/pages/auth/signup.test.ts`. Do not add a replacement unit test. Sign-up Topbar chrome stays as shipped; do not restyle the card, fields, or Create account button. Chrome checks stay grep/review, not CI.
