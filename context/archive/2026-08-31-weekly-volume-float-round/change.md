---
change_id: weekly-volume-float-round
title: Round weekly km so a 50 km week does not warn on float dust
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Zaokrąglij km do 1 miejsca po przecinku przed compare i przed tekstem warningu w generatePlan (fill split) i validatePlan. Soft WEEKLY_VOLUME_EXCEEDED; hard ceiling 60 bez zmian. Tydzień 50 km nie może dostać `50.00000000000001 km is over the 50 km target`.
