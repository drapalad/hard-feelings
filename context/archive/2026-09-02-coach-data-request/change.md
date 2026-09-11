---
change_id: coach-data-request
title: Coach loads richer context and can request an allowlisted extra fetch
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T17:15:51Z
---

## Notes

LOCKED. Files: `src/lib/services/openai-chat.ts` (`systemPrompt`, propose JSON schema, allowlist), `src/lib/services/chat.ts` (`sendMessage` first-pass context + second completion), `src/components/plan/PlanChat.tsx` (muted chip under the last assistant message). Reuse `listLogsRange`, `listRange`, `listRaces`, `getProfile`. Source-scan / unit tests for the allowlist and chip copy. No migration.

### Today

`systemPrompt` serializes the open week as date/type/distanceKm/frozen — no `structure`. No races. No logs. The model cannot ask for extra JSON. Chat UI has no signal that extra context was loaded.

### Do

1. **Default first completion:** include `structure` on week (or 14-day window) units, upcoming races (`listRaces`), last 14d logs (`listLogsRange` from utcToday−13 through utcToday), and `weeklyKm` (already present). Pass those on `LlmProposeRequest`. If `generate-via-chat` already widened the mutation window, send that same window here.

2. **Schema:** `dataRequest: { keys: string[] } | null` (required in the strict JSON schema; null when unused). Server allowlist exactly `logs_42d`, `prior_plan_14d`, `races`, `profile`. Drop unknown keys and duplicates. If none remain, do not call the model again.

3. **Second completion (at most one):** `logs_42d` → `listLogsRange` (utcToday−41..today); `prior_plan_14d` → `listRange` for the 14 days before the open window; `races` → `listRaces`; `profile` → `getProfile`. Then exactly one second completion with that JSON. Never loop. Do not invent new allowlist entries.

4. After the turn, a muted chip under the last assistant message, e.g. `Loaded: last 42 days of logs` (`Loaded: ` + comma-joined labels for keys that actually fetched). Do not persist a new `chat_messages` column; return `loadedKeys` on the send response for that turn.

5. Do not ship a hardcoded transcript.

### Do not

- POST from the UI for extra data; add a migration; change generate; add Profile fields.
- Revert auto-apply or reintroduce Accept if `chat-auto-apply` already shipped.
- Arbitrary fetches / SQL from model-supplied strings — allowlist only.

### Visible

The coach can show it pulled extra data; not a silent week-only brain.

### Sequencing

After `chat-auto-apply` (same `PlanChat` / `chat.ts` / `openai-chat.ts`). Do not run in parallel with `generate-via-chat`.
