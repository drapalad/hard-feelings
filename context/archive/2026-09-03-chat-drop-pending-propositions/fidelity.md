# Fidelity — chat-drop-pending-propositions

Źródło: ## Notes (keep / remove). Plan-brief: DROP `plan_propositions` + DEP-030 (`Source: Unattended`).
HEAD: 97ff08e
Czytaj też `plan-brief.md` → Key Decisions (`Source: Unattended` / `CHANGED: S-…`).

Merged: `97ff08e` (`unattended/chat-drop-pending-propositions` → `master`)

| id | status | dowód (1 linia z git diff / plik) |
|----|--------|-----------------------------------|
| Keep Accept/Dismiss profile-freeze | implemented | `POST /api/chat/accept.ts` remains; `loadPendingProfileFreeze` still used |
| Keep km/type auto-apply | implemented | Send path unchanged aside from dropping `rejectPending` |
| Ignore calendar `plan_propositions` | implemented | Accept no longer loads calendar pending; table dropped in p3 |
| GET `/api/chat` has no `proposition` | implemented | `threads.test.ts` `not.toHaveProperty("proposition")` |
| Remove `POST /api/chat/reject` | implemented | `src/pages/api/chat/reject.ts` deleted |
| DROP table + hosted DEP | implemented | `20260905160000_drop_plan_propositions.sql`; **DEP-030** open |

Konflikt merge: `deferred.md` zachowuje DEP-029 i DEP-030; harness migracji ma obie daty `2026090512*` i `2026090516*`.
