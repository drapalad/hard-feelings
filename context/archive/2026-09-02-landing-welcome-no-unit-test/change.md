---
change_id: landing-welcome-no-unit-test
title: Drop the Welcome source-read unit test
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T07:43:12Z
---

## Notes

LOCKED. Human 2026-09-02 (FU-048): the colocated `Welcome.test.ts` source-read test is not wanted.

Delete `src/components/Welcome.test.ts`. Do not add a replacement unit test. Feature-card chrome on Welcome stays as shipped; do not restyle cards, H1, CTAs, Topbar, or footer. Chrome checks stay grep/review, not CI.
