# Fidelity — profile-keep-row-on-clear-km

Źródło: ## Notes (id S-134.*) zaakceptowane na Bramce 1.
HEAD: 5ea731a
Czytaj też `plan-brief.md` → Key Decisions (`Source: Unattended` / `CHANGED: S-…`).

Merged: `5ea731a` (`unattended/profile-keep-row-on-clear-km` → `master`)

| id | status | dowód (1 linia z git diff / plik) |
|----|--------|-----------------------------------|
| S-134.1 | implemented | `SetupForm.tsx` `weeklyKm: trimmed === "" ? null` + `method: "PUT"` |
| S-134.2 | implemented | empty Save still PUT prefs; does not reset last race / notes / mix state |
| S-134.3 | implemented | `asProfileRow` accepts `weekly_km: null`; GET returns null km with other columns |
| S-134.4 | implemented | `profile.test.ts` PATCH last race after PUT `weeklyKm: null` |
| S-134.5 | implemented | no `export const DELETE` on `/api/profile`; SetupForm has no profile DELETE fetch |
