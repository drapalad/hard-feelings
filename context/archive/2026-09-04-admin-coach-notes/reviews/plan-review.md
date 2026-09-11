<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Admin coach notes

- **Plan**: `context/changes/admin-coach-notes/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 14/14 paths ✓, 9/9 symbols ✓ (`systemPrompt`, `completeOpenAiPropose`, `setStoredOpenAiModel`, `getStoredOpenAiModel`, `isSettingsPayload`, `Member coach notes`, `patchBodySchema`, `PROJECT_SETTINGS_ID`, `notFound`), brief↔plan ✓ after F1/F2 fixes.

Riskiest claims (deep, no extra sub-agent — parent forbade nested agents):

1. **Omit-to-preserve on memory upsert** — confirmed: `memory-supabase.ts` merges `{ ...existing, ...row }`. `setStoredOpenAiModel` payload omits `coach_notes`, so a model-only PATCH keeps notes. Same as last-race / member notes.
2. **Migration filename order** — `20260904120100_project_coach_notes.sql` sorts after `20260904120000_profile_coach_notes.sql` and before `20260904180000_profile_last_race.sql`. Plan inserts in the list and leaves `newest.name` as last-race.
3. **Extra follow-up inherits notes** — `completeSendTurn` second call is `{ ...firstRequest, extra }` (`chat.ts:565`). Putting `adminCoachNotes` on `firstRequest` covers both completions. `completeOpenAiPropose` has no Supabase client (`openai-chat.ts:180–183`).
4. **Member inject stays** — `systemPrompt` pushes `Member coach notes:` from `request.profile.coachNotes` (`openai-chat.ts:329–331`). Plan adds a sibling Admin line after that block.
5. **messages.ts passthrough** — `POST /api/chat/messages` wraps `completeOpenAiPropose(req, …)` with no request rewrite. No handler change needed; blast radius is the request field, not a new caller.
6. **isAdmin 404** — `admin.astro:14–16` and settings GET/PATCH `notFound()` stay; plan does not touch the 404 HTML branch.

## Findings

### F1 — Omitted `coachNotes` must stay absent on zod output

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — PATCH/GET handler
- **Detail**: Model-only PATCH (existing tests and a Save that only intends to change the model id) omits `coachNotes` so the upsert can skip `coach_notes`. If `patchBodySchema` uses a naive `z.string().nullable().optional().transform(emptyToNull)`, Zod will put `coachNotes: null` on every model-only PATCH. `'coachNotes' in parsed.data` then becomes true and every Save model writes NULL, wiping notes. Memory merge and PostgREST omit-to-preserve only help when the key is actually absent. Sibling `profileWriteSchema` already rebuilds the object when `coachNotes === undefined`.
- **Fix**: State the invariant in the schema contract: omitted body key → omitted parse key; empty string still present as `null`. Mirror `profileWriteSchema`.
- **Decision**: FIXED — Phase 1 handler Contract now requires the `profileWriteSchema` rebuild and warns against defaulting omitted → `null`.

### F2 — Phase 3 Manual rows were prompt inspection

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 — Manual Verification
- **Detail**: Checking `Admin coach notes:` / `Member coach notes:` in the OpenAI system prompt is not human-observable in the product. Those checks already live under Automated (`openai-chat.test.ts`, `chat.test.ts`). Dummy Manual rows pause `/10x-implement` for work the agent already gated.
- **Fix**: Drop Phase 3 Manual Verification; keep Phase 2 UI reload/404 checks.
- **Decision**: FIXED — Phase 3 Manual subsection and Progress 3.6–3.8 removed. Manual Testing Steps no longer list prompt inspection.

## Triage

- Fixed: F1, F2
- Skipped: none
- Accepted: none
- Dismissed: none

► Verdict after fixes: SOUND
