<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Flag for admin stores technical propose and persist JSON

- **Plan**: `context/changes/flag-admin-technical/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-04
- **Verdict**: SOUND
- **Findings**: 0 critical, 3 warnings, 0 observations (all triaged)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 9/9 paths ✓ (`agent-report.ts`, `chat.ts`, `AdminReports.tsx`, `types.ts`, `agent-report.test.ts`, `report.test.ts`, `plan.ts`, `admin.astro`, `PlanChat.tsx`), 8/8 symbols ✓ (`buildGapReport`, `reportAssistantGap`, `sendMessage`, `persistProposedUnits`, `insertMessage`, `asChatMessage`, `shouldCaptureHardBoundReport`, `replaceWeek`), brief↔plan ✓ after PLAN-FIX.

Deep verify: claims 2–5 confirmed in code; claim 1 premises (raw row in `reportAssistantGap`, `asChatMessage` is the ChatMessage gate, `AdminReports` is `client:load` with no `agent-report` import) confirmed. Stamp/strip is to-build. No existing text-column sentinel pattern. `insertMessage` is `Promise<void>` without `.select`; `createThread` shows `.insert().select().maybeSingle()`; memory-supabase `stampRow` assigns UUID when returning.

## Findings

### F1 — Human-readable marker can collide with coach prose

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details — Hold until Flag; Phases 1–3 marker string
- **Detail**: Plan originally split on `--- technical payload ---`. That phrase can appear in a coach reply or an existing `body`. A collision would leak JSON into PlanChat/history or hide the `<pre>` split. Repo has no prior sentinel-on-text-column pattern.
- **Fix**: Use machine sentinel `<!--hf-technical-payload-->` for encode/decode/split. Keep the visible Admin label **Technical payload**.
- **Decision**: FIXED — PLAN-FIX: marker is `<!--hf-technical-payload-->` in plan.md, plan-brief.md, and FU-140 notes. Label unchanged.

### F2 — Stamp UPDATE has no row id; `insertMessage` returns void

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Encode / decode on chat messages
- **Detail**: Plan said UPDATE “that assistant row” after persist, but `insertMessage` (`chat.ts:896-914`) is `Promise<void>` and does not `.select("id")`. Implementer would guess “latest assistant in thread.” `createThread` already returns an id via `.insert().select().maybeSingle()` (`chat.ts:162-166`). Memory-supabase only returns inserted rows when `.select()` sets `returning`.
- **Fix**: Change `insertMessage` to `.insert(…).select("id")` and return the id; UPDATE by that id.
- **Decision**: FIXED — PLAN-FIX: Phase 2 contract and Critical Implementation Details now require `.select("id")` matching `createThread`.

### F3 — `buildGapReport` title would ingest JSON if passed unstripped content

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 `buildGapReport`; Phase 2 `reportAssistantGap`
- **Detail**: Title is `assistant.content.trim().slice(0, 72)` (`agent-report.ts:44-45`). If Flag passed the raw stamped row through `asChatMessage` before strip (or skipped strip), titles and `Assistant:` prose would include the sentinel and JSON. Blast-radius: `PlanChat.tsx:166` and last-12 history are safe only if `asChatMessage` strips.
- **Fix**: Parse snapshot from raw `data.content`; pass stripped `ChatMessage` into `buildGapReport` for title/prose; snapshot is a separate argument.
- **Decision**: FIXED — PLAN-FIX: Hold-until-Flag and Phase 1/2 contracts now require stripped content for title/`Assistant:` and a separate `snapshot` argument.

## Triage summary

Fixed: F1, F2, F3 (3). Skipped: none. Dismissed: none.

► Verdict after fixes: SOUND
