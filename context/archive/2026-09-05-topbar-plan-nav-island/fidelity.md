# Fidelity — topbar-plan-nav-island

Źródło: ## Notes (id S-133.*) zaakceptowane na Bramce 1.
HEAD: f61d85b
Czytaj też `plan-brief.md` → Key Decisions (`Source: Unattended` / `CHANGED: S-…`).

Merged: `f61d85b` (`unattended/topbar-plan-nav-island` → `master`)

| id | status | dowód (1 linia z git diff / plik) |
|----|--------|-----------------------------------|
| S-133.1 | implemented | `Topbar.astro` `<PlanTabSelect client:load>` + `aria-label="Plan"` |
| S-133.2 | implemented | `applyPlanTabChange` → `replaceState` + `hf:dashboard-tab` on `/dashboard` |
| S-133.3 | implemented | off dashboard `location.assign("/dashboard?tab=…")` |
| S-133.4 | implemented | desktop `sm:flex` still `<a href="/dashboard?tab=…">` / current `<span>` |
| S-133.5 | implemented | Sign out still `POST /api/auth/signout`; email/Admin hunks unchanged |
