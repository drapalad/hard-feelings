---
change_id: privacy-cookie-notice
title: Publish a short privacy and cookie notice
status: archived
created: 2026-08-31
updated: 2026-09-01
archived_at: 2026-09-01T07:06:59Z
---

## Notes

Short page/notice: session cookies from Supabase SSR (purpose, retention, legal basis). No analytics → no full CMP.
Do not add a tracker. Do not pretend the copy is legal advice.
Close DEP-011 as Status: done with Done: 2026-08-31 and a one-line note when the notice is on disk.

Sources:
- `context/deployment/deferred.md` → DEP-011
- `src/lib/supabase.ts` (createServerClient + cookie getAll/setAll; no analytics)
- PRD NFR privacy
- Production today is `https://hard-feelings.ikul.workers.dev` (DEP-001 custom domain is a later queue item — write the notice so it still makes sense on workers.dev)
