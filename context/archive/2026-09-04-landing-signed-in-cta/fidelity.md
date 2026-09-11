# Fidelity — landing-signed-in-cta

Źródło: ## Notes (id S-07.*) zaakceptowane na Bramce 1.
HEAD: f35fe73
Czytaj też `plan-brief.md` → Key Decisions (`Source: Unattended` / `CHANGED: S-…`).

Merged: `f35fe73` (`unattended/landing-signed-in-cta` → `master`)

| id | status | dowód (1 linia z git diff / plik) |
|----|--------|-----------------------------------|
| S-07.1 | implemented | `Welcome.astro` signed-in `<a href="/dashboard">Open dashboard</a>` |
| S-07.2 | implemented | hero Sign In / Sign Up only in the `user ? … : <>` else branch |
| S-07.3 | implemented | signed-out still `/auth/signin` + `/auth/signup` with the same class strings |
| S-07.4 | implemented | `git diff` does not touch `Topbar.astro` |
