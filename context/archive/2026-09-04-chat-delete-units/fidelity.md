# Fidelity — chat-delete-units

Merged: `1eecda3` (`unattended/chat-delete-units` → `master`)

| id | verdict |
| --- | --- |
| S-03.1 | implemented |
| S-03.2 | implemented |
| S-03.3 | implemented |
| S-03.4 | implemented |
| S-03.5 | implemented |
| S-03.6 | implemented |

Day-panel Delete on frozen units uses `skipFrozen: false` — **FU-144**.

Proof (`git diff 63a783d..1eecda3`): `+  delete?: true;` in `src/types.ts`.
