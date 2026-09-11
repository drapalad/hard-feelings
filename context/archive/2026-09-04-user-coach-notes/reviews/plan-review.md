<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Member coach notes on Profile

- **Plan**: `context/changes/user-coach-notes/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 paths ✓, 8/8 symbols ✓ (`getProfile`, `upsertProfile`, `updateLastRace`, `profileWriteSchema`, `systemPrompt`, `completeOpenAiPropose`, `SELECT_COLUMNS`, `saveKm`), brief↔plan ✓ after F1 fix.

Riskiest claims (deep, no sub-agent — parent forbade extra agents):

1. **Omit-to-preserve on memory upsert** — confirmed: `memory-supabase.ts` merges `{ ...existing, ...row }`, so omitted `coach_notes` keeps the previous value. Same pattern persist-race-result used for last-race.
2. **Migration filename order** — `20260904120000_profile_coach_notes.sql` sorts before `20260904180000_profile_last_race.sql`. Plan correctly inserts in the list and leaves `newest.name` as last-race.
3. **Chat freeze wipe** — `acceptPendingProfileFreeze` builds a prefs-only `Profile` object (no `coachNotes` key) and calls `upsertProfile`. `'coachNotes' in profile` is false. Confirmed `chat.ts:864–872`.
4. **Shared systemPrompt** — `completeOpenAiPropose` always uses `systemPrompt(request)` (`openai-chat.ts:199`). Extra follow-up is a second `complete()` with the same helper. Injecting there covers first-pass and extra.
5. **SSR seed files** — `dashboard.astro` and `DashboardTabs.tsx` exist and already pass last-race props; adding `coachNotes` is the established pattern.

## Findings

### F1 — Omitted `coachNotes` must stay absent on zod output

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — PUT write schema
- **Detail**: Weekly-km Save omits `coachNotes` so `upsertProfile` can skip `coach_notes`. If `profileWriteSchema` uses a naive `z.string().optional().transform(emptyToNull)`, Zod will put `coachNotes: null` on every prefs PUT. `'coachNotes' in parsed.data` then becomes true and every Save weekly km writes NULL, wiping notes. Memory merge and PostgREST omit-to-preserve only help when the key is actually absent.
- **Fix**: State the invariant in the schema contract: omitted body key → omitted parse key (`not.toHaveProperty("coachNotes")`); empty string still present as `null`.
- **Decision**: FIXED — Phase 1 schema Contract and Changes Required 7 now require `not.toHaveProperty("coachNotes")` on prefs-only parse, and warn against defaulting omitted → `null`. Plan-brief Save-shape row updated.

## Triage

- Fixed: F1
- Skipped: none
- Accepted: none
- Dismissed: none

► Verdict after fixes: SOUND
