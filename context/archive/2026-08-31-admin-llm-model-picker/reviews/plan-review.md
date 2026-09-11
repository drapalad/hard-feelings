<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Admin project-wide LLM model picker

- **Plan**: `context/changes/admin-llm-model-picker/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-31
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 existing paths ✓, 4/4 symbols ✓ (`completeOpenAiPropose`, `createMemorySupabase`, `unauthorized`/`notFound`, `OPENAI_MODEL` empty ternary in `messages.ts:29`), brief↔plan ✓. `docs/reference/contract-surfaces.md` absent (skip). New files in the plan are correctly not on disk yet.

Riskiest claims checked in-repo: chat uses member JWT (`messages.ts` → `createClient`); no service-role client (`src/lib/supabase.ts`); admin JSON is 401 then 404 (`reports.ts`); `MEMORY_TABLES` seed test asserts `user_id` on every table (`memory-supabase.test.ts:37-41`); `PROTECTED_ROUTES` is `/dashboard` + `/admin` and `startsWith` does not match `/api/admin`.

## Findings

### F1 — Phase 2 admin round-trip had no persist mock

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Non-admin 404
- **Detail**: No `*.test.ts` currently mocks `@/lib/supabase`. Product-gates never reach `createClient` (401 first). An admin GET/PATCH test that called the real `createClient` would build an SSR client against mocked `SUPABASE_*` instead of memory-supabase, so the round-trip could not persist.
- **Fix**: Specify `vi.mock("@/lib/supabase")` returning memory-supabase, and stub `cookies` on the APIContext.
- **Decision**: FIXED — Phase 2 settings-test contract now requires `vi.mock("@/lib/supabase")` + `cookies` stub; member 404 does not require a successful `createClient`.

### F2 — Admin SSR did not name the env import

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Admin page
- **Detail**: The island props include `resolvedModel` / `envFallback`, but the page contract only said `getStoredOpenAiModel` + `resolveOpenAiModel`. `admin.astro` does not import `astro:env/server` today; without naming `OPENAI_MODEL`, SSR could show stored-only and drift from GET `/api/admin/settings`.
- **Fix**: Import `OPENAI_MODEL` in `admin.astro` and pass the same three fields as the GET payload.
- **Decision**: FIXED — Phase 3 page contract now imports `OPENAI_MODEL` and passes `openaiModel` / `resolvedModel` / `envFallback`. Phase 2 also allows that import on the page (not only the API route).

### F3 — Phase 1 would mint a second hosted-SQL task

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Deploy backlog
- **Detail**: Unattended planning already opened DEP-016. The phase still said “Append DEP-016”, which on a literal read would add DEP-017 for the same apply.
- **Fix**: Treat DEP-016 as already opened; do not mint another id.
- **Decision**: FIXED — Phase 1 contract now says keep DEP-016, do not mint DEP-017.

## Triage

Fixed: F1, F2, F3 (3). Skipped: none. Verdict after fixes: SOUND.
