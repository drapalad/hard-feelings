---
change_id: coach-data-request-fail-closed
title: Fail Send when the extra coach completion throws
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

When the extra (second) coach completion throws after allowlisted extras were fetched, fail the Send the same way as a first-call LLM failure (COACH_UNAVAILABLE / red error). Do not keep or auto-apply the first propose. Chip stays empty. First-shot JSON can include mutations and dataRequest together — do not assume the calendar is untouched when the model asked for more data.

Promoted from FU-122. Human 2026-09-02: prefer the red error over keep-first.
