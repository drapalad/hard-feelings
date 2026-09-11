# Admin project-wide LLM model picker Implementation Plan

## Overview

Let an Admin pick the OpenAI Chat Completions model used for every member's coaching chat, persist it as a project-wide setting, and keep `OPENAI_MODEL` then `gpt-4o-mini` as fallback. Reports on `/admin` stay. The model still cannot write the calendar or skip Accept / `validatePlan.hard`.

## Current State Analysis

S-07 (`llm-chat-proposer`) already calls OpenAI Chat Completions via `fetch`. `src/pages/api/chat/messages.ts` resolves the model as `OPENAI_MODEL === undefined || OPENAI_MODEL === "" ? "gpt-4o-mini" : OPENAI_MODEL` and passes it into `completeOpenAiPropose`. Production already has `OPENAI_API_KEY` and `OPENAI_MODEL` (`gpt-5.6-luna`) on the Worker (DEP-014). There is no Admin settings surface: `/admin` is the S-06 reports queue (`AdminReports`), gated by `locals.isAdmin` / `user_roles`. JSON admin APIs return `401` unsigned and `404 NOT_FOUND` for signed-in non-admins (not `403`). Cookie SSR `createClient` is anon+JWT; there is no service-role client, so chat (member JWT) can only read a setting if RLS allows authenticated `SELECT`.

`completeOpenAiPropose` already takes `options.model` and puts it on the request body. Accept / `gateAccept` / `validatePlan` do not read the model name. FU-011 is the backlog item this change closes. Hosted SQL is never applied from a code commit — a new table needs an open DEP.

The memory persist harness (`src/lib/test/memory-supabase.ts`) lists member-owned tables in `MEMORY_TABLES`. Its seed test currently asserts every seeded table row contains `user_id`. A singleton settings table does not have `user_id` — that assertion must be narrowed, not blindly reused.

## Desired End State

An Admin opens `/admin`, sees a Chat model section above the existing reports list, types (or picks a suggestion for) an OpenAI model id, and saves. The next `POST /api/chat/messages` that has `OPENAI_API_KEY` sends that id in the Completions `model` field for every member. Clearing the saved value restores env then `gpt-4o-mini`. A Member cannot change the setting (JSON `404`, no UI). Chat Accept still 409s on hard bounds; generate still writes the plan. FU-011 is done. Hosted apply is recorded as DEP-016, not executed here.

### Key Discoveries:

- Chat uses the member JWT (`src/pages/api/chat/messages.ts` → `createClient`). Without a service role, `project_settings` **SELECT** must be allowed for `auth.uid() IS NOT NULL` or the override is invisible to chat.
- Admin JSON authz pattern: `401` then `404`, never `FORBIDDEN` (`src/pages/api/admin/reports.ts`).
- Empty `OPENAI_MODEL` must keep defaulting to `gpt-4o-mini` (S-07 impl-review F1). Same empty-string rule applies to a stored override.
- Production already runs `gpt-5.6-luna` via env — a hardcoded gpt-4o-only allowlist would block the model they use today.
- `MEMORY_TABLES` seed test loops every table and expects `user_id` (`src/lib/test/memory-supabase.test.ts`). Settings rows break that loop unless the test is updated.
- Do not put `/api/admin` on `PROTECTED_ROUTES` — HTML redirect would break `fetch`.

## What We're NOT Doing

- Per-member or per-thread models.
- Binding Workers AI or switching off OpenAI `fetch` (FU-007 stays confirmed).
- Letting the selected model persist calendar units or skip Accept / `validatePlan.hard`.
- A public / dashboard picker.
- Live OpenAI `/v1/models` catalog or a probe request on save.
- A service-role Supabase client.
- Hosted `db push` / applying SQL to production (DEP-016 only).
- Playwright / jsdom / `page.waitForTimeout`.
- Closing unrelated FU/DEP (privacy page, test-plan phase 2/3, DEP-002, etc.).
- Archiving this change or touching `context/foundation/roadmap.md`.

## Implementation Approach

Singleton `project_settings` row (`id = 'default'`) holds a nullable `openai_model`. Admin GET/PATCH `/api/admin/settings` with zod. Chat resolves `stored → OPENAI_MODEL → gpt-4o-mini` and injects that string into the existing `complete` callback. `/admin` keeps reports and adds a small React island for the picker. Missing table (hosted SQL not applied yet) fails open to env fallback so chat does not 500.

## Critical Implementation Details

**Resolution order is stored override, then env, then `gpt-4o-mini`.** Treat `null`, missing row, and `""` / whitespace-only stored values as unset. Treat `undefined` and `""` env the same way S-07 already does.

**Chat must not 500 if the settings table is missing.** Wrap the settings read in try/catch (same fail-open idea as `isAdminUser` / agent-report insert). Missing hosted SQL until DEP-016 is applied is the expected production window.

**Do not thread the model into Accept, generate, or `validatePlan`.** `messages.ts` is the only call site that chooses `options.model`.

**Member-owned memory tables vs settings.** Add `project_settings` to `MEMORY_TABLES`, but stop asserting `user_id` on every table in the seed test.

---

## Phase 1: Schema, harness, and resolve/persist service

### Overview

Add the singleton settings table (RLS + DEP-016), teach the memory harness about it, and lock resolve/get/set in Vitest before HTTP or UI.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/YYYYMMDDHHmmss_project_llm_settings.sql` (new; timestamp at implement time)

**Intent**: Persist one project-wide OpenAI model override, isolated from Worker rollback.

**Contract**:

- Table `project_settings`: `id text PRIMARY KEY`; `openai_model text`; `updated_at timestamptz NOT NULL DEFAULT now()`; `updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL`.
- `CONSTRAINT project_settings_singleton CHECK (id = 'default')`.
- `CONSTRAINT project_settings_openai_model_check CHECK (openai_model IS NULL OR (char_length(btrim(openai_model)) BETWEEN 1 AND 64))`.
- `ENABLE ROW LEVEL SECURITY`. Granular policies, no combined ALL:
  - **SELECT**: `USING (auth.uid() IS NOT NULL)` — chat (member JWT) must read the override.
  - **INSERT** / **UPDATE**: Admin `EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')` on `WITH CHECK` (and `USING` for UPDATE).
  - No DELETE policy — clear the override by setting `openai_model` to NULL.
- Comment that Worker rollback does not undo this SQL and that this slice writes only `id = 'default'`.

#### 2. Deploy backlog

**File**: `context/deployment/deferred.md`

**Intent**: Hosted apply is operator work, not this commit.

**Contract**: **DEP-016** is already open from planning (apply `*_project_llm_settings.sql` to hosted `hard-feelings`; Worker rollback does not undo SQL). Do **not** mint DEP-017 for the same apply. Leave DEP-001–DEP-015 statuses unchanged. Do not run hosted `db push`. If the item is missing, recreate DEP-016 with that Source — do not skip the hosted-apply record.

#### 3. Memory persist harness

**Files**: `src/lib/test/memory-supabase.ts`, `src/lib/test/memory-supabase.test.ts`

**Intent**: Settings reads/writes in Vitest use the same in-memory client as other services.

**Contract**: Add `"project_settings"` to `MEMORY_TABLES` and `emptyStore`. Seed test must still cover member-owned tables with `user_id`; do **not** require `user_id` on `project_settings`. Add a focused upsert/select case for `id = 'default'`. Unknown-table fail-open behavior stays (a missing name still returns empty / `maybeSingle` null).

#### 4. Resolve + persist service

**Files**: `src/lib/services/llm-settings.ts` (new), `src/lib/services/llm-settings.test.ts` (new)

**Intent**: One env-free module owns fallback order and DB access so `messages.ts` does not inline a second ternary.

**Contract**:

- Export `DEFAULT_OPENAI_MODEL = "gpt-4o-mini"`.
- Export `openaiModelIdSchema` — trimmed string, length 1–64, charset `^[a-zA-Z0-9._:-]+$` (covers `gpt-4o-mini` and production `gpt-5.6-luna`).
- Export `resolveOpenAiModel(stored, envModel): string` — stored non-empty trimmed wins; else non-empty env; else default. Empty string is unset.
- Export `getStoredOpenAiModel(client): Promise<string | null>` — `from("project_settings").select("openai_model").eq("id", "default").maybeSingle()`. Null/missing/blank → `null`. On thrown/query error → `null` (fail-open).
- Export `setStoredOpenAiModel(client, openaiModel: string | null, updatedBy: string): Promise<void>` — upsert `{ id: "default", openai_model, updated_by }` with `onConflict: "id"`. `null` stores SQL null (clear override). Non-null values must already match `openaiModelIdSchema` (caller validates).
- Export `loadOpenAiModel(client, envModel): Promise<string>` as `resolveOpenAiModel(await getStoredOpenAiModel(client), envModel)`.
- Do not import `astro:env`. Tests use `createMemorySupabase`.

### Success Criteria:

#### Automated Verification:

- `supabase/migrations/` contains a `*_project_llm_settings.sql` with the singleton table, checks, RLS SELECT-authenticated + Admin INSERT/UPDATE, no DELETE policy, no member writes
- `context/deployment/deferred.md` has open DEP-016 for this migration; earlier DEP statuses unchanged
- `MEMORY_TABLES` includes `project_settings`; seed test does not require `user_id` on that table
- Vitest: `resolveOpenAiModel` covers stored-wins, env-wins, both-empty → `gpt-4o-mini`, stored `""` / whitespace → env
- Vitest: `getStoredOpenAiModel` / `setStoredOpenAiModel` round-trip on memory-supabase; clear-to-null; get returns null on empty store
- `npm test` passes

---

## Phase 2: Admin JSON API and chat wiring

### Overview

Admin-only GET/PATCH for the setting. Chat Completions uses `loadOpenAiModel`. Logged-out 401 on the new routes. Members cannot write.

### Changes Required:

#### 1. Admin settings API

**Files**: `src/pages/api/admin/settings.ts` (new), `src/pages/api/admin/settings.test.ts` (new)

**Intent**: The only write path for the project model; same hidden-admin contract as reports.

**Contract**:

- `export const prerender = false`.
- **GET**: `401` if no user; `404 NOT_FOUND` if `!locals.isAdmin`; `503 UNAVAILABLE` if no supabase; else `200 { openaiModel, resolvedModel, envFallback }` where `openaiModel` is the stored override or `null`, `resolvedModel` is `loadOpenAiModel(...)`, `envFallback` is non-empty `OPENAI_MODEL` or `null`.
- **PATCH**: same 401/404/503. Body zod: `{ openaiModel: openaiModelIdSchema.nullable() }` (JSON `null` or a valid id; reject `""` as `400 VALIDATION_ERROR` — clients send `null` to clear). Persist via `setStoredOpenAiModel`. Return the same GET-shaped payload after write.
- Import `OPENAI_MODEL` from `astro:env/server` in this route, `messages.ts`, and `admin.astro` (SSR resolved label). Do not put `/api/admin/settings` on `PROTECTED_ROUTES`.

#### 2. Product 401 gates

**File**: `src/pages/api/product-gates.test.ts`

**Intent**: Logged-out GET/PATCH settings are JSON 401 like other product APIs.

**Contract**: Add both methods to `GATES`. Keep the existing `astro:env/server` mock (`OPENAI_MODEL: ""`). Assert no `Location`, no member payloads.

#### 3. Non-admin 404

**File**: `src/pages/api/admin/settings.test.ts`

**Intent**: A signed-in Member cannot read or write the picker API.

**Contract**: Handler-level Vitest with `vi.mock("astro:env/server")` (same four keys as `product-gates.test.ts`). No existing test mocks persist: `vi.mock("@/lib/supabase", () => ({ createClient: () => memoryClient }))` so GET/PATCH after the admin gate hit memory-supabase, not a real SSR client. Stub `cookies` on the APIContext (product-gates omits it because 401 is first). `locals.user` set, `locals.isAdmin: false` → GET and PATCH return `404 { error: { code: "NOT_FOUND", message: "Not found" } }` without requiring a successful `createClient`. Admin path: `isAdmin: true`, PATCH a valid id, GET returns it as `openaiModel` and `resolvedModel`.

#### 4. Chat route uses the resolver

**File**: `src/pages/api/chat/messages.ts`

**Intent**: The Completions `model` field follows the Admin override without changing propose/accept behavior.

**Contract**: After `createClient` succeeds, `const model = await loadOpenAiModel(supabase, OPENAI_MODEL)` (fail-open already inside get). Pass that `model` into `completeOpenAiPropose` exactly as today. Do not call `setStoredOpenAiModel` from chat. Do not change `sendMessage`, Accept, or stub-when-key-missing.

### Success Criteria:

#### Automated Verification:

- `npm test` — product-gates include GET/PATCH `/api/admin/settings` 401; settings tests cover member 404 and admin round-trip
- `src/pages/api/chat/messages.ts` calls `loadOpenAiModel` (no leftover `OPENAI_MODEL === undefined || OPENAI_MODEL === "" ? "gpt-4o-mini"` ternary)
- Accept persist-skip tests in `src/lib/services/accept-proposition.test.ts` still pass unchanged (hard proposed week does not land)
- `npm run lint` passes

---

## Phase 3: Admin UI and close FU-011

### Overview

Settings section on `/admin` next to reports. Members still 404 on the page. Close FU-011. Document the picker.

### Changes Required:

#### 1. Settings island

**File**: `src/components/admin/AdminLlmSettings.tsx` (new)

**Intent**: Interactive save of the project model; reports stay a separate island.

**Contract**: React island (`client:load`). Props: `{ openaiModel: string | null; resolvedModel: string; envFallback: string | null }`. Labeled text input (`getByLabel`-friendly `htmlFor` / `id` = `openai-model`) with a `<datalist>` of suggestions `gpt-4o-mini`, `gpt-4o`, `gpt-5.6-luna`. Save button PATCHes `{ openaiModel }` or `{ openaiModel: null }` when the field is blank. Merge classes with `cn()`. Show current `resolvedModel` and whether it comes from the saved value vs env vs default. Reuse `ServerError` + `Button` like `AdminReports`. No dashboard / public usage.

#### 2. Admin page

**File**: `src/pages/admin.astro`

**Intent**: Keep algorithm reports; add the settings section for Admins only.

**Contract**: Existing 404 HTML for `!showPanel` unchanged. When Admin, import `OPENAI_MODEL` from `astro:env/server`, SSR-load via `getStoredOpenAiModel` + `resolveOpenAiModel(stored, OPENAI_MODEL)` (fail-open to env/default if the table is missing), and pass `openaiModel`, `resolvedModel`, and `envFallback` into the island. Render a heading such as "Chat model" and `<AdminLlmSettings client:load ... />` **above** the existing "Algorithm feedback" / `AdminReports` block. Do not remove reports.

#### 3. Copy and backlog

**Files**: `README.md`, `context/backlog.md`

**Intent**: Operators know `/admin` also sets the model; FU-011 is closed because the picker shipped.

**Contract**:

- README: `/admin` row mentions reports **and** the project Chat model picker; note that `OPENAI_MODEL` is fallback until an Admin saves an override (and after they clear it).
- FU-011: move under `## Done`, `- [x] **Status:** done`, **Done:** 2026-08-31, one-line note that the `/admin` picker is project-wide with env / `gpt-4o-mini` fallback. Leave FU-022 open.

### Success Criteria:

#### Automated Verification:

- `src/pages/admin.astro` still 404s non-admins and still mounts `AdminReports`
- `AdminLlmSettings` is mounted only on the Admin branch of `admin.astro`
- FU-011 is `Status: done` under `## Done` with Done: 2026-08-31
- `npm test` passes
- `npm run lint` passes
- `npm run build` passes (needs `SUPABASE_*` in env like CI)

#### Manual Verification:

- As Admin, open `/admin`, save a model id, reload: the field still shows it and "resolved" matches
- As Admin, clear the field and save: resolved falls back to `OPENAI_MODEL` or `gpt-4o-mini`
- As a non-admin signed-in Member, `/admin` is Not found and there is no Topbar Admin link; dashboard chat has no model picker
- With `OPENAI_API_KEY` set, send a chat message after saving a model: Completions still returns a propose payload; Accept of a hard-bound diff still cannot land the week

---

## Testing Strategy

### Unit Tests:

- `resolveOpenAiModel` fallback matrix (stored / env / default / blanks)
- `openaiModelIdSchema` accepts `gpt-4o-mini` and `gpt-5.6-luna`; rejects empty, spaces, over-64, illegal charset
- `getStoredOpenAiModel` / `setStoredOpenAiModel` on memory-supabase (including clear-to-null)

### Integration Tests:

- Memory harness: `project_settings` upsert by `id`
- Handler: GET/PATCH `/api/admin/settings` 401 logged-out; 404 non-admin; admin round-trip
- Existing Accept persist-skip remains green (Risk #2 unchanged)

### Manual Testing Steps:

1. Sign in as Admin → `/admin` → Chat model section + reports list both visible
2. Save `gpt-4o-mini`, reload, confirm resolved; clear and confirm env/default
3. Sign in as a Member → `/admin` is Not found; dashboard has no model control
4. Chat a day-change with a key set; Accept still blocked when `validatePlan.hard` is non-empty

## Performance Considerations

One extra `maybeSingle` read per chat send. No catalog fetch, no cache layer.

## Migration Notes

Local: `npx supabase db reset` (or apply the new file) before the picker can persist. Production chat keeps env/`gpt-4o-mini` until DEP-016 is applied; the UI save will fail with `DB_ERROR` until then — fail-open on **read** so members still chat. Worker rollback does not undo the SQL. Do not run hosted `db push` in this change.

## References

- FU-011: `context/backlog.md`
- S-07 archived: `context/archive/2026-08-16-llm-chat-proposer/`
- S-06 archived: `context/archive/2026-08-17-admin-algorithm-feedback/`
- Chat model call site: `src/pages/api/chat/messages.ts`
- Completions client: `src/lib/services/openai-chat.ts`
- Admin authz: `src/pages/api/admin/reports.ts`, `src/pages/admin.astro`
- Persist harness: `src/lib/test/memory-supabase.ts`
- Test cookbook: `context/foundation/test-plan.md` §6.2 / §6.4

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema, harness, and resolve/persist service

#### Automated

- [x] 1.1 Migration `*_project_llm_settings.sql` has singleton table, checks, RLS SELECT-authenticated + Admin INSERT/UPDATE, no DELETE policy, no member writes — a10fd8f
- [x] 1.2 DEP-016 is open for hosted apply; earlier DEP statuses unchanged — a10fd8f
- [x] 1.3 MEMORY_TABLES includes project_settings; seed test does not require user_id on that table — a10fd8f
- [x] 1.4 Vitest resolveOpenAiModel covers stored-wins, env-wins, both-empty → gpt-4o-mini, stored blank → env — a10fd8f
- [x] 1.5 Vitest get/set round-trip on memory-supabase; clear-to-null; get returns null on empty store — a10fd8f
- [x] 1.6 npm test passes — a10fd8f

### Phase 2: Admin JSON API and chat wiring

#### Automated

- [x] 2.1 npm test — product-gates include GET/PATCH /api/admin/settings 401; settings tests cover member 404 and admin round-trip — 1d2b82d
- [x] 2.2 messages.ts calls loadOpenAiModel (no leftover OPENAI_MODEL empty ternary) — 1d2b82d
- [x] 2.3 Accept persist-skip tests still pass unchanged — 1d2b82d
- [x] 2.4 npm run lint passes — 1d2b82d

### Phase 3: Admin UI and close FU-011

#### Automated

- [x] 3.1 admin.astro still 404s non-admins and still mounts AdminReports — 8449c8f
- [x] 3.2 AdminLlmSettings is mounted only on the Admin branch of admin.astro — 8449c8f
- [x] 3.3 FU-011 is Status: done under ## Done with Done: 2026-08-31 — 8449c8f
- [x] 3.4 npm test passes — 8449c8f
- [x] 3.5 npm run lint passes — 8449c8f
- [x] 3.6 npm run build passes — 8449c8f

#### Manual

- [ ] 3.7 As Admin, open /admin, save a model id, reload: the field still shows it and "resolved" matches
- [ ] 3.8 As Admin, clear the field and save: resolved falls back to OPENAI_MODEL or gpt-4o-mini
- [ ] 3.9 As a non-admin signed-in Member, /admin is Not found and there is no Topbar Admin link; dashboard chat has no model picker
- [ ] 3.10 With OPENAI_API_KEY set, send a chat message after saving a model: Completions still returns a propose payload; Accept of a hard-bound diff still cannot land the week
