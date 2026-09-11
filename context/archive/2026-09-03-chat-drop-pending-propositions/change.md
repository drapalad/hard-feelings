# chat-drop-pending-propositions

- **status:** archived
- **created:** 2026-09-03
- **updated:** 2026-09-05
- **archived_at:** 2026-09-05T15:50:12Z
- **title:** Remove leftover plan_propositions calendar Accept without dropping profile/freeze Accept

## Notes

Promoted from FU-125. Implemented by unattended 2026-09-05.

**Must keep:** `POST /api/chat/accept` / Dismiss for `chat_profile_freeze_pending` (card `Accept profile & freeze changes`). Ordinary km/type chat edits stay auto-apply.

**Must remove:** calendar pending in `plan_propositions` winning over profile/freeze; GET `/api/chat` returning `proposition`; `rejectProposition` / `POST /api/chat/reject`; `rejectPending` on Send / unit edit / undo / restore if it only exists to clear stale calendar propositions.

Optionally drop or archive the `plan_propositions` table (hosted apply = DEP).
