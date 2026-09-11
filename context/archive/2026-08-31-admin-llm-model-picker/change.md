---
change_id: admin-llm-model-picker
title: Admin project-wide LLM model picker
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Admin chooses the OpenAI model for the whole project (not per member / per thread).
Fallback: OPENAI_MODEL env, then gpt-4o-mini. The model does not write the plan and does not bypass validatePlan / Accept.
New Admin surface (S-06 is reports, not settings). Extending `/admin` (`src/pages/admin.astro`, already in PROTECTED_ROUTES) is fine if you keep reports and add a settings section — do not invent a public picker.
Close FU-011 as Status: done when the picker ships (move under ## Done with Done: 2026-08-31 and a one-line note).
