# Opportunity Map

## Context

- **Project / context**: HardFeelings — tarcie **zespołu przy rozwoju** (deploy, git, CI, unattended vs człowiek), nie luki w produkcie dla biegacza. Źródła: `context/deployment/deferred.md`, `deploy-plan.md`, `context/backlog.md`, `AGENTS.md`, README, `.github/workflows/ci.yml`, `/10x-unattended`.
- **Poza zakresem**: problemy w kodzie aplikacji (prefs vs `generatePlan`, pasek 5:00/km, pętla raportów Admin).
- **Data constraint**: niepewne — pierwszy wariant na mock / lokal / read-only (nazwy migracji, statusy DEP/FU, SHA); bez wierszy członków. Hosted schema listing = TBD.
- **Date**: 2026-09-08
- **Next (this session)**: nothing for now.

## Map

| Sygnał | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Worker z `github/master` żyje, hosted SQL czeka na ręczny `db push` | Lista DEP + plan „nie pushuj z change”; produkcja 500 do DEP; rollback Workera nie cofa SQL (~20× DEP-008–032) | Zestawienie plików `supabase/migrations/` + otwarte DEP + „Worker już na SHA” | Lokalny digest: migracja bez `Status: done` / nowszy plik niż ostatni Done | read-only nazwy + markdown DEP | Internal tool → później Review / CI gate |
| `git push origin` (uiol) ≠ deploy; tylko `github` odpala Workers Builds | Dual-remote (DEP-006 done); README / cheat sheet | Przypomnienie przy pushu / status dwóch remote | `git status -sb` + `git remote -v` + „ostatni SHA na github/master vs origin” | non-sensitive SHA | Wait / no build |
| Brak preview Workerów — PR / gałąź unattended nie ma URL-a jak prod | DEP-003/004 otwarte; weryfikacja lokalnym `wrangler`; CI bez deploy | Native Cloudflare preview na gałęzi (+ Access gdy dane członka) | Jedna gałąź → preview URL (SaaS), bez własnego panelu | preview + hosted DB = real data → Access najpierw | Wait / no build (najpierw DEP-003) |
| CI zielone ≠ ktoś kliknął jak na produkcji | GHA: lint / `npm test` / build; Playwright lokalnie, nie w CI; `HF_MIGRATION_PG` skippable | Link do prod / preview + „e2e lokalnie po merdżu” | Checklist po `github/master`: SHA, CI run, „czy Playwright odpalony” | non-sensitive | Wait / no build |

## Recommended First Candidate

```text
Candidate:
Schema lag digest (Worker vs hosted SQL)

Reads:
- pliki supabase/migrations/ (nazwy, kolejność)
- context/deployment/deferred.md (otwarte vs Done DEP-* z db push)
- opcjonalnie: SHA / czas ostatniego deployu na github/master (git log), bez dumpa tabel

Returns:
Krótki raport: które pliki SQL nie mają Done DEP; które DEP są open podczas gdy Worker już mógł wgrać kod, który tych kolumn oczekuje; jedno zdanie „okno 500 nadal możliwe: tak/nie”

Does not do:
Automatycznego supabase db push, dashboardu, zastępowania deferred.md, rollbacku SQL, podglądu wierszy członków

Data risk:
mock / lokal / read-only / non-sensitive (nazwy plików + markdown). Listing hosted schema = TBD (nadal nie wiersze).

Direction if it proves valuable:
Internal tool; jeśli checklista sama nie wystarcza — Review / CI gate (komentarz na PR: „ta zmiana dodaje SQL, DEP-NNN jeszcze open”)
```

## Why This Candidate

To jedyne tarcie, które **regularnie skleja dwa systemy** (Workers Builds i hosted Supabase), ma **ręczny koszt po prawie każdym slice’ie z migracją** i jest już udokumentowane jako osobny krok człowieka (~20 DEP). Reszta albo ma świadomą decyzję i docs (dual-remote), albo powinna iść w istniejący SaaS (Cloudflare preview = DEP-003).

Dual-remote i „CI ≠ klik” są prawdziwe, ale to pamięć + istniejące CLI/CI, nie brak sklejki.

## Next Direction If Valuable

**Internal tool** (cienki komplement wokół Supabase CLI + markdown DEP), nie feature produktu. Jeśli digest wejdzie w rytm merdża: ewentualnie **Review / CI gate** na PR z nowym plikiem w `supabase/migrations/`. Nie automatyzować `db push` z agenta — to świadoma bramka człowieka (AGENTS.md / test-plan §6.5).

Nie teraz: sesja zostawiła „nothing for now”. Powrót: `/10x-mom-test` na tym kandydacie, albo od razu `/10x-new` na wąski skrypt digestu, jeśli okno 500 nadal boli przy następnym slice’ie.

W pipeline jest recenzent diffu na pull request (job Review). To nie jest ten digest. Digest SQL zostaje na liście, gdy Worker i hosted baza znowu się rozjadą.
