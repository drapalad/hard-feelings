import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { utcMondayOf, utcToday, addUtcDays, weekDates } from "@/lib/dates";
import { weekStartSchema, listWeek, listRange, replaceWeek, setFrozen } from "./plan";
import { applyMutations, gateByIsoWeek } from "./plan-adaptation";
import {
  proposeAdaptation,
  sanitizeProposeResult,
  toRawProposeResult,
  COACH_UNAVAILABLE_REPLY,
  type ProposeCompleteFn,
  type ProposeResult,
} from "./propose-adaptation";
import {
  clampLoadedRange,
  compactCoachRaces,
  parseLoadedRange,
  type CompactCoachRace,
  type LlmProposeExtra,
} from "./openai-chat";
import { getProfile, upsertProfile } from "./profile";
import { getStoredCoachNotes } from "./llm-settings";
import { listLogs, listLogsRange, upsertLog } from "./workout-log";
import { listRaces, insertRace, updateRace, deleteRace, type RaceWrite } from "./races";
import { validateRaceList } from "./profile-races";
import {
  buildGapReport,
  buildHardBoundReport,
  FLAG_TECHNICAL_MARKER,
  insertAgentReport,
  shouldCaptureHardBoundReport,
  splitAgentReportBody,
} from "./agent-report";
import type {
  ChatMessage,
  ChatRole,
  FlagTurnSnapshot,
  PendingProfileFreeze,
  PendingRacesPatch,
  Profile,
  ProfilePatch,
  Race,
  RacePriority,
  TrainingUnit,
  LoadedRange,
  UnitMutation,
  ValidateResult,
  WorkoutLog,
  WorkoutType,
  ChatThread,
} from "@/types";

export const chatMessageBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
  content: z.string().min(1).max(2000),
  threadId: z.uuid().optional(),
});

export const chatWeekBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
});

export const chatReportBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
  messageId: z.string().min(1).max(100),
});

export interface ChatList {
  messages: ChatMessage[];
  pendingProfileFreeze: PendingProfileFreeze | null;
  threadId: string | null;
  thread: ChatThread | null;
}

export type AcceptDecision =
  | { ok: true; validation: ValidateResult }
  | { ok: false; code: "HARD_BOUNDS"; validation: ValidateResult };

export type SendMessageResult =
  | {
      ok: true;
      data: ChatList & {
        logs: WorkoutLog[];
        units?: TrainingUnit[];
        validation?: ValidateResult;
        loadedRange: LoadedRange | null;
        pendingProfileFreeze: PendingProfileFreeze | null;
      };
    }
  | {
      ok: false;
      error: {
        code: "VALIDATION_ERROR" | "MISSING_WEEKLY_KM" | "INVALID_WEEKLY_KM" | "NOT_FOUND" | "DB_ERROR";
        message: string;
      };
    };

export type AcceptPropositionResult =
  | { ok: true; weekStart: string; units: TrainingUnit[]; validation: ValidateResult }
  | {
      ok: false;
      error: {
        code:
          | "NO_PENDING_PROFILE_FREEZE"
          | "MISSING_WEEKLY_KM"
          | "INVALID_WEEKLY_KM"
          | "HARD_BOUNDS"
          | "DB_ERROR"
          | "SECOND_A_RACE"
          | "DUPLICATE_RACE_DATE"
          | "NOT_FOUND";
        message: string;
      };
      validation?: ValidateResult;
    };

export type ReportAssistantGapResult = { ok: true } | { ok: false; error: { code: "NOT_FOUND"; message: string } };

export type DismissPendingProfileFreezeResult =
  | { ok: true }
  | { ok: false; error: { code: "NO_PENDING_PROFILE_FREEZE" | "DB_ERROR"; message: string } };

export function acceptDecision(
  plan: { units: TrainingUnit[] },
  weeklyKm: number,
  frozenUnits: TrainingUnit[],
): AcceptDecision {
  const gated = gateByIsoWeek(plan.units, weeklyKm, frozenUnits);
  if (!gated.ok) {
    return { ok: false, code: "HARD_BOUNDS", validation: gated.validation };
  }
  return { ok: true, validation: gated.validation };
}

export async function listChat(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  threadId?: string,
): Promise<ChatList> {
  const monday = utcMondayOf(weekStart);
  const resolved = await resolveThreadId(client, userId, threadId);
  if (!resolved.ok) {
    throw new Error("THREAD_NOT_FOUND");
  }
  const messages = resolved.threadId === null ? [] : await loadMessages(client, userId, resolved.threadId);
  const pendingProfileFreeze = await loadPendingProfileFreeze(client, userId, monday);
  return {
    messages,
    pendingProfileFreeze,
    threadId: resolved.threadId,
    thread: resolved.thread,
  };
}

export async function listThreads(client: SupabaseClient, userId: string): Promise<ChatThread[]> {
  const { data, error } = await client
    .from("chat_threads")
    .select("id, title, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const thread = asChatThread(row);
    return thread === null ? [] : [thread];
  });
}

export async function createThread(client: SupabaseClient, userId: string): Promise<ChatThread> {
  const { data, error } = await client
    .from("chat_threads")
    .insert({ user_id: userId, title: null, started_at: new Date().toISOString() })
    .select("id, title, started_at")
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const thread = asChatThread(data);
  if (thread === null) {
    throw new Error("Failed to create thread");
  }
  return thread;
}

async function loadOwnedThread(client: SupabaseClient, userId: string, threadId: string): Promise<ChatThread | null> {
  const { data, error } = await client
    .from("chat_threads")
    .select("id, title, started_at")
    .eq("user_id", userId)
    .eq("id", threadId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return asChatThread(data);
}

async function loadLatestThread(client: SupabaseClient, userId: string): Promise<ChatThread | null> {
  const { data, error } = await client
    .from("chat_threads")
    .select("id, title, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return asChatThread(data);
}

async function resolveThreadId(
  client: SupabaseClient,
  userId: string,
  threadId: string | undefined,
  options?: { createIfMissing?: boolean },
): Promise<{ ok: true; threadId: string | null; thread: ChatThread | null } | { ok: false; code: "NOT_FOUND" }> {
  if (threadId !== undefined) {
    const owned = await loadOwnedThread(client, userId, threadId);
    if (owned === null) {
      return { ok: false, code: "NOT_FOUND" };
    }
    return { ok: true, threadId: owned.id, thread: owned };
  }
  const latest = await loadLatestThread(client, userId);
  if (latest !== null) {
    return { ok: true, threadId: latest.id, thread: latest };
  }
  if (options?.createIfMissing === true) {
    const created = await createThread(client, userId);
    return { ok: true, threadId: created.id, thread: created };
  }
  return { ok: true, threadId: null, thread: null };
}

async function maybeSetThreadTitle(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  content: string,
): Promise<void> {
  const owned = await loadOwnedThread(client, userId, threadId);
  if (owned?.title !== null) {
    return;
  }
  const title = content.trim().slice(0, 60);
  if (title === "") {
    return;
  }
  const { error } = await client.from("chat_threads").update({ title }).eq("id", threadId).eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

function asChatThread(data: unknown): ChatThread | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("id" in data) || typeof data.id !== "string") {
    return null;
  }
  const startedAt =
    "started_at" in data && typeof data.started_at === "string"
      ? data.started_at
      : "created_at" in data && typeof data.created_at === "string"
        ? data.created_at
        : null;
  if (startedAt === null) {
    return null;
  }
  const title = "title" in data && typeof data.title === "string" && data.title !== "" ? data.title : null;
  return { id: data.id, title, startedAt };
}

export async function sendMessage(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  content: string,
  deps?: { complete?: ProposeCompleteFn; threadId?: string },
): Promise<SendMessageResult> {
  const trimmed = content.trim();
  if (trimmed === "") {
    return { ok: false, error: { code: "VALIDATION_ERROR", message: "Message cannot be empty" } };
  }
  const monday = utcMondayOf(weekStart);
  try {
    const resolved = await resolveThreadId(client, userId, deps?.threadId, { createIfMissing: true });
    if (!resolved.ok || resolved.threadId === null) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Thread not found." } };
    }
    const threadId = resolved.threadId;
    const horizon = utcCreateHorizon();
    const weekUnits = await listWeek(client, userId, monday);
    const rangeUnits = await listRange(client, userId, horizon.createFrom, horizon.createTo);
    const units = unionByDate(weekUnits, rangeUnits);
    const profile = await getProfile(client, userId);
    const currentLoad = await loadCurrentLoad(client, userId, horizon.createFrom);
    const isoWeeks = await loadIsoWeeks(client, userId, horizon.createFrom, horizon.createTo);
    const races = compactCoachRaces(await listRaces(client, userId), utcToday());
    if (profile.weeklyKm === null) {
      return { ok: false, error: { code: "MISSING_WEEKLY_KM", message: "weeklyKm must be a finite number." } };
    }
    if (profile.weeklyKm <= 0) {
      return { ok: false, error: { code: "INVALID_WEEKLY_KM", message: "weeklyKm must be greater than 0." } };
    }
    await insertMessage(client, userId, threadId, monday, "user", trimmed);
    await maybeSetThreadTitle(client, userId, threadId, trimmed);
    const history = (await loadMessages(client, userId, threadId))
      .map((item) => ({ role: item.role, content: item.content }))
      .slice(-12);
    const { proposed, loadedRange, extraUnits } = await completeSendTurn(
      client,
      userId,
      {
        message: trimmed,
        weekStart: monday,
        units,
        weeklyKm: profile.weeklyKm,
        history,
        createFrom: horizon.createFrom,
        createTo: horizon.createTo,
        profile,
        currentLoad,
        isoWeeks,
        races,
      },
      horizon,
      deps?.complete,
    );
    const existingDates = new Set(unionByDate(units, extraUnits).map((unit) => unit.date));
    const { autoApply, pendingCreates } = partitionCalendarMutations(proposed.mutations, existingDates, horizon);
    const pendingProfilePatch = sanitizePendingProfileFreeze(proposed, profile as Profile, units, pendingCreates);
    if (pendingProfilePatch !== null) {
      await upsertPendingProfileFreeze(client, userId, monday, pendingProfilePatch);
    }
    if (proposed.log !== undefined) {
      const upserted = await upsertLog(client, userId, units, proposed.log);
      if (!upserted.ok) {
        return {
          ok: false,
          error: {
            code: upserted.error.code === "NOT_FOUND" ? "NOT_FOUND" : "DB_ERROR",
            message: upserted.error.message,
          },
        };
      }
      const assistantId = await insertMessage(client, userId, threadId, monday, "assistant", proposed.reply);
      await stampAssistantSnapshot(
        client,
        userId,
        assistantId,
        proposed.reply,
        buildTurnSnapshot({
          proposed,
          validation: { hard: [], soft: [] },
          dataRequest: loadedRange,
        }),
      );
      const chat = await listChat(client, userId, monday, threadId);
      return { ok: true, data: { ...chat, logs: upserted.logs, loadedRange } };
    }
    const plan = applyMutations(await unitsForApply(client, userId, units, extraUnits, autoApply), autoApply);
    const assistantId = await insertMessage(client, userId, threadId, monday, "assistant", proposed.reply);
    if (autoApply.length > 0) {
      const deletedDates = autoApply
        .filter((mutation) => mutation.delete === true)
        .map((mutation) => mutation.date)
        .filter((date) => !plan.units.some((unit) => unit.date === date));
      const mutationDates = autoApply.map((mutation) => mutation.date);
      const persistMondays = mondaysToPersist(plan.units, monday, horizon, deletedDates, mutationDates);
      const frozenUnits = await frozenUnitsForMondays(client, userId, monday, persistMondays, weekUnits);
      const decision = acceptDecision({ units: plan.units }, profile.weeklyKm, frozenUnits);
      try {
        if (shouldCaptureHardBoundReport(autoApply.length, decision.validation)) {
          const report = buildHardBoundReport({
            sourceUserId: userId,
            weekStart: monday,
            validation: decision.validation,
          });
          if (report !== null) {
            await insertAgentReport(client, report);
          }
        }
      } catch {
        // Missing agent_reports must not fail chat persist.
      }
      const appliedUnits = decision.ok
        ? await persistProposedUnits(client, userId, monday, plan.units, horizon, deletedDates, mutationDates)
        : undefined;
      await stampAssistantSnapshot(
        client,
        userId,
        assistantId,
        proposed.reply,
        buildTurnSnapshot({
          proposed,
          validation: decision.validation,
          dataRequest: loadedRange,
          appliedUnits,
        }),
      );
      const chat = await listChat(client, userId, monday, threadId);
      const logs = await loadWeekLogs(client, userId, monday);
      return {
        ok: true,
        data: {
          ...chat,
          logs,
          loadedRange,
          validation: decision.validation,
          ...(appliedUnits === undefined ? {} : { units: appliedUnits }),
        },
      };
    }
    await stampAssistantSnapshot(
      client,
      userId,
      assistantId,
      proposed.reply,
      buildTurnSnapshot({
        proposed,
        validation: { hard: [], soft: [] },
        dataRequest: loadedRange,
      }),
    );
    const chat = await listChat(client, userId, monday, threadId);
    const logs = await loadWeekLogs(client, userId, monday);
    return { ok: true, data: { ...chat, logs, loadedRange } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    if (message === "THREAD_NOT_FOUND") {
      return { ok: false, error: { code: "NOT_FOUND", message: "Thread not found." } };
    }
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export async function acceptProposition(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<AcceptPropositionResult> {
  const monday = utcMondayOf(weekStart);
  try {
    const acceptedPending = await acceptPendingProfileFreeze(client, userId, monday);
    if (acceptedPending !== null) {
      return acceptedPending;
    }
    return {
      ok: false,
      error: { code: "NO_PENDING_PROFILE_FREEZE", message: "No pending profile/freeze changes." },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept proposition";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export async function reportAssistantGap(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  messageId: string,
): Promise<ReportAssistantGapResult> {
  const monday = utcMondayOf(weekStart);
  const { data, error } = await client
    .from("chat_messages")
    .select("id, thread_id, week_start, role, content, created_at")
    .eq("user_id", userId)
    .eq("id", messageId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  const flagged = asChatMessage(data);
  const threadId =
    typeof data === "object" && data !== null && "thread_id" in data && typeof data.thread_id === "string"
      ? data.thread_id
      : null;
  const rawContent =
    typeof data === "object" && data !== null && "content" in data && typeof data.content === "string"
      ? data.content
      : "";
  if (flagged?.role !== "assistant" || threadId === null) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Assistant message not found." } };
  }
  const messages = await loadMessages(client, userId, threadId);
  const flaggedIndex = messages.findIndex((message) => message.id === messageId);
  const lastAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");
  if (flaggedIndex === -1 || flaggedIndex !== lastAssistantIndex) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Assistant message not found." } };
  }
  const assistant = messages[flaggedIndex];
  if (assistant.role !== "assistant") {
    return { ok: false, error: { code: "NOT_FOUND", message: "Assistant message not found." } };
  }
  const userMessage =
    flaggedIndex > 0 && messages[flaggedIndex - 1]?.role === "user" ? messages[flaggedIndex - 1] : undefined;
  await insertAgentReport(
    client,
    buildGapReport({
      sourceUserId: userId,
      weekStart: monday,
      assistant,
      userMessage,
      snapshot: decodeAssistantContent(rawContent).snapshot,
    }),
  );
  return { ok: true };
}

export async function dismissPendingProfileFreeze(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<DismissPendingProfileFreezeResult> {
  const pending = await loadPendingProfileFreezeRow(client, userId, utcMondayOf(weekStart));
  if (pending === null) {
    return { ok: false, error: { code: "NO_PENDING_PROFILE_FREEZE", message: "No pending profile/freeze changes." } };
  }
  await setPendingProfileFreezeStatus(client, userId, pending.id, "dismissed");
  return { ok: true };
}

function utcCreateHorizon(): { createFrom: string; createTo: string } {
  const createFrom = utcToday();
  return { createFrom, createTo: addUtcDays(createFrom, 13) };
}

interface CompleteSendInput {
  message: string;
  weekStart: string;
  units: TrainingUnit[];
  weeklyKm: number;
  history: { role: "user" | "assistant"; content: string }[];
  createFrom: string;
  createTo: string;
  profile: Awaited<ReturnType<typeof getProfile>>;
  currentLoad: { from: string; to: string; plannedKm: number; loggedKm: number };
  isoWeeks: { monday: string; plannedKm: number; loggedKm: number; dates: string[] }[];
  races: CompactCoachRace[];
}

async function completeSendTurn(
  client: SupabaseClient,
  userId: string,
  input: CompleteSendInput,
  horizon: { createFrom: string; createTo: string },
  complete: ProposeCompleteFn | undefined,
): Promise<{ proposed: ProposeResult; loadedRange: LoadedRange | null; extraUnits: TrainingUnit[] }> {
  if (complete === undefined) {
    return {
      proposed: await proposeAdaptation(input),
      loadedRange: null,
      extraUnits: [],
    };
  }
  const firstRequest = {
    ...input,
    adminCoachNotes: await getStoredCoachNotes(client),
  };
  let raw: ProposeResult & { dataRequest?: LoadedRange | null };
  try {
    raw = await complete(firstRequest);
  } catch (error) {
    // eslint-disable-next-line no-console -- chat UI is pinned; status belongs in the server log
    console.error("Coach LLM failed:", error instanceof Error ? error.message : error);
    raw = { reply: COACH_UNAVAILABLE_REPLY, mutations: [] };
  }
  const requestedRange = parseLoadedRange(raw.dataRequest);
  let loadedRange: LoadedRange | null = null;
  let extraUnits: TrainingUnit[] = [];
  if (requestedRange !== null) {
    const clampedRange = clampLoadedRange(requestedRange);
    const extra = await fetchCoachExtra(client, userId, clampedRange);
    if (extra !== null) {
      try {
        raw = await complete({ ...firstRequest, extra });
        loadedRange = clampedRange;
        extraUnits = extra.units ?? [];
      } catch (error) {
        // eslint-disable-next-line no-console -- chat UI is pinned; status belongs in the server log
        console.error("Coach LLM failed:", error instanceof Error ? error.message : error);
        raw = { reply: COACH_UNAVAILABLE_REPLY, mutations: [] };
        loadedRange = null;
        extraUnits = [];
      }
    }
  }
  return {
    proposed: sanitizeProposeResult(toRawProposeResult(raw), unionByDate(input.units, extraUnits), {
      createFrom: horizon.createFrom,
      createTo: horizon.createTo,
    }),
    loadedRange,
    extraUnits,
  };
}

async function fetchCoachExtra(
  client: SupabaseClient,
  userId: string,
  range: LoadedRange,
): Promise<LlmProposeExtra | null> {
  try {
    const [units, logs, races] = await Promise.all([
      listRange(client, userId, range.from, range.to),
      listLogsRange(client, userId, range.from, range.to),
      listRaces(client, userId),
    ]);
    return { range, units, logs, races };
  } catch {
    return null;
  }
}

async function loadCurrentLoad(
  client: SupabaseClient,
  userId: string,
  today: string,
): Promise<{ from: string; to: string; plannedKm: number; loggedKm: number }> {
  const from = addUtcDays(today, -6);
  const [plannedUnits, logs] = await Promise.all([
    listRange(client, userId, from, today),
    listLogsRange(client, userId, from, today),
  ]);
  return {
    from,
    to: today,
    plannedKm: sumDistance(plannedUnits),
    loggedKm: sumDistance(logs),
  };
}

async function loadIsoWeeks(
  client: SupabaseClient,
  userId: string,
  createFrom: string,
  createTo: string,
): Promise<{ monday: string; plannedKm: number; loggedKm: number; dates: string[] }[]> {
  const firstMonday = utcMondayOf(createFrom);
  const lastMonday = utcMondayOf(createTo);
  const lastSunday = addUtcDays(lastMonday, 6);
  const [plannedUnits, logs] = await Promise.all([
    listRange(client, userId, firstMonday, lastSunday),
    listLogsRange(client, userId, firstMonday, lastSunday),
  ]);
  const weeks: { monday: string; plannedKm: number; loggedKm: number; dates: string[] }[] = [];
  for (let monday = firstMonday; monday <= lastMonday; monday = addUtcDays(monday, 7)) {
    const dates = weekDates(monday);
    const inWeek = new Set(dates);
    weeks.push({
      monday,
      plannedKm: sumDistance(plannedUnits.filter((unit) => inWeek.has(unit.date))),
      loggedKm: sumDistance(logs.filter((log) => inWeek.has(log.date))),
      dates,
    });
  }
  return weeks;
}

function sumDistance(items: { distanceKm: number }[]): number {
  return Math.round(items.reduce((total, item) => total + item.distanceKm, 0) * 10) / 10;
}

async function loadWeekLogs(client: SupabaseClient, userId: string, monday: string): Promise<WorkoutLog[]> {
  try {
    return await listLogs(client, userId, monday);
  } catch {
    return [];
  }
}

async function frozenUnitsForMondays(
  client: SupabaseClient,
  userId: string,
  requestMonday: string,
  persistMondays: string[],
  current: TrainingUnit[],
): Promise<TrainingUnit[]> {
  const frozenUnits: TrainingUnit[] = [];
  for (const persistMonday of persistMondays) {
    const week = persistMonday === requestMonday ? current : await listWeek(client, userId, persistMonday);
    frozenUnits.push(...week.filter((unit) => unit.frozen));
  }
  return frozenUnits;
}

async function persistProposedUnits(
  client: SupabaseClient,
  userId: string,
  requestMonday: string,
  proposedUnits: TrainingUnit[],
  horizon: { createFrom: string; createTo: string },
  deletedDates: string[] = [],
  mutationDates: string[] = [],
): Promise<TrainingUnit[]> {
  const persistMondays = mondaysToPersist(proposedUnits, requestMonday, horizon, deletedDates, mutationDates);
  const written: TrainingUnit[] = [];
  for (const persistMonday of persistMondays) {
    const incoming = await incomingForWeek(
      client,
      userId,
      persistMonday,
      requestMonday,
      proposedUnits,
      horizon,
      deletedDates,
    );
    await replaceWeek(client, userId, persistMonday, incoming);
    written.push(...(await listWeek(client, userId, persistMonday)));
  }
  written.sort((left, right) => left.date.localeCompare(right.date));
  return written;
}

async function persistPendingCreates(
  client: SupabaseClient,
  userId: string,
  requestMonday: string,
  creates: UnitMutation[],
  weeklyKm: number,
): Promise<AcceptPropositionResult> {
  const horizon = utcCreateHorizon();
  const plan = applyMutations(await unitsForApply(client, userId, [], [], creates), creates);
  const mutationDates = creates.map((mutation) => mutation.date);
  const writeMonday = utcMondayOf(mutationDates[0] ?? requestMonday);
  const persistMondays = mondaysToPersist(plan.units, writeMonday, horizon, [], mutationDates);
  const weekUnits = await listWeek(client, userId, writeMonday);
  const frozenUnits = await frozenUnitsForMondays(client, userId, writeMonday, persistMondays, weekUnits);
  const decision = acceptDecision({ units: plan.units }, weeklyKm, frozenUnits);
  if (!decision.ok) {
    return {
      ok: false,
      error: {
        code: "HARD_BOUNDS",
        message: decision.validation.hard[0]?.message ?? "Hard bounds blocked the plan.",
      },
      validation: decision.validation,
    };
  }
  const written = await persistProposedUnits(client, userId, writeMonday, plan.units, horizon, [], mutationDates);
  const requestWeek = writeMonday === requestMonday ? written : await listWeek(client, userId, requestMonday);
  return {
    ok: true,
    weekStart: requestMonday,
    units: unionByDate(requestWeek, written),
    validation: decision.validation,
  };
}

function inHorizon(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function weekOverlapsHorizon(weekStart: string, from: string, to: string): boolean {
  return weekDates(weekStart).some((date) => inHorizon(date, from, to));
}

function unionByDate(left: TrainingUnit[], right: TrainingUnit[]): TrainingUnit[] {
  const byDate = new Map<string, TrainingUnit>();
  for (const unit of [...left, ...right]) {
    byDate.set(unit.date, unit);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mondaysToPersist(
  proposed: TrainingUnit[],
  requestMonday: string,
  horizon: { createFrom: string; createTo: string },
  deletedDates: string[] = [],
  mutationDates: string[] = [],
): string[] {
  const mondays = new Set<string>([requestMonday]);
  for (const unit of proposed) {
    if (inHorizon(unit.date, horizon.createFrom, horizon.createTo)) {
      mondays.add(utcMondayOf(unit.date));
    }
  }
  for (const date of [...deletedDates, ...mutationDates]) {
    mondays.add(utcMondayOf(date));
  }
  return [...mondays].sort((a, b) => a.localeCompare(b));
}

async function unitsForApply(
  client: SupabaseClient,
  userId: string,
  base: TrainingUnit[],
  extra: TrainingUnit[],
  mutations: { date: string }[],
): Promise<TrainingUnit[]> {
  if (mutations.length === 0) {
    return unionByDate(base, extra);
  }
  const mondays = [...new Set(mutations.map((mutation) => utcMondayOf(mutation.date)))];
  const weeks = (await Promise.all(mondays.map((monday) => listWeek(client, userId, monday)))).flat();
  return unionByDate(unionByDate(base, extra), weeks);
}

async function incomingForWeek(
  client: SupabaseClient,
  userId: string,
  persistMonday: string,
  requestMonday: string,
  proposed: TrainingUnit[],
  horizon: { createFrom: string; createTo: string },
  deletedDates: string[] = [],
): Promise<TrainingUnit[]> {
  const weekSet = new Set(weekDates(persistMonday));
  const deleted = new Set(deletedDates);
  if (persistMonday === requestMonday && !weekOverlapsHorizon(requestMonday, horizon.createFrom, horizon.createTo)) {
    return proposed.filter((unit) => weekSet.has(unit.date));
  }
  const existing = await listWeek(client, userId, persistMonday);
  const byDate = new Map<string, TrainingUnit>();
  for (const unit of existing) {
    if (!inHorizon(unit.date, horizon.createFrom, horizon.createTo) && !deleted.has(unit.date)) {
      byDate.set(unit.date, unit);
    }
  }
  for (const unit of proposed) {
    if (weekSet.has(unit.date) && !deleted.has(unit.date)) {
      byDate.set(unit.date, unit);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

interface PendingProfileFreezeRow {
  id: string;
  week_start: string;
  profile_patch: unknown;
  freeze_dates: unknown;
  unfreeze_dates: unknown;
  races_patch: unknown;
  calendar_creates: unknown;
  status: string;
}

async function loadMessages(client: SupabaseClient, userId: string, threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await client
    .from("chat_messages")
    .select("id, week_start, role, content, created_at")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("created_at");
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const message = asChatMessage(row);
    return message === null ? [] : [message];
  });
}

async function loadPendingProfileFreezeRow(
  client: SupabaseClient,
  userId: string,
  monday: string,
): Promise<PendingProfileFreezeRow | null> {
  const { data, error } = await client
    .from("chat_profile_freeze_pending")
    .select("id, week_start, profile_patch, freeze_dates, unfreeze_dates, races_patch, calendar_creates, status")
    .eq("user_id", userId)
    .eq("week_start", monday)
    .eq("status", "pending")
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return asPendingProfileFreezeRow(data);
}

async function loadPendingProfileFreeze(
  client: SupabaseClient,
  userId: string,
  monday: string,
): Promise<PendingProfileFreeze | null> {
  return toPendingProfileFreeze(await loadPendingProfileFreezeRow(client, userId, monday));
}

async function upsertPendingProfileFreeze(
  client: SupabaseClient,
  userId: string,
  monday: string,
  pending: PendingProfileFreeze,
): Promise<void> {
  await dismissExistingPendingProfileFreeze(client, userId, monday);
  const { error } = await client.from("chat_profile_freeze_pending").insert({
    user_id: userId,
    week_start: monday,
    profile_patch: pending.profile ?? null,
    freeze_dates: pending.freeze,
    unfreeze_dates: pending.unfreeze,
    races_patch: pending.races ?? null,
    calendar_creates: pending.creates ?? null,
    status: "pending",
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function dismissExistingPendingProfileFreeze(
  client: SupabaseClient,
  userId: string,
  monday: string,
): Promise<void> {
  const { error } = await client
    .from("chat_profile_freeze_pending")
    .update({ status: "dismissed" })
    .eq("user_id", userId)
    .eq("week_start", monday)
    .eq("status", "pending");
  if (error) {
    throw new Error(error.message);
  }
}

async function setPendingProfileFreezeStatus(
  client: SupabaseClient,
  userId: string,
  id: string,
  status: "pending" | "accepted" | "dismissed",
): Promise<void> {
  const { error } = await client
    .from("chat_profile_freeze_pending")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

async function acceptPendingProfileFreeze(
  client: SupabaseClient,
  userId: string,
  monday: string,
): Promise<AcceptPropositionResult | null> {
  const pendingRow = await loadPendingProfileFreezeRow(client, userId, monday);
  const pending = toPendingProfileFreeze(pendingRow);
  if (pendingRow === null || pending === null) {
    return null;
  }
  const currentRaces = pending.races === undefined ? [] : await listRaces(client, userId);
  if (pending.races !== undefined) {
    const projected = projectPendingRaces(currentRaces, pending.races);
    if (!projected.ok) {
      return { ok: false, error: projected.error };
    }
    const invariants = validateRaceList(projected.next);
    if (!invariants.ok) {
      return { ok: false, error: { code: invariants.error.code, message: invariants.error.message } };
    }
  }
  const currentProfile = await getProfile(client, userId);
  const resolvedWeeklyKm = pending.profile?.weeklyKm ?? currentProfile.weeklyKm;
  if (resolvedWeeklyKm === null) {
    return { ok: false, error: { code: "MISSING_WEEKLY_KM", message: "weeklyKm must be a finite number." } };
  }
  const nextProfile: Profile = {
    weeklyKm: resolvedWeeklyKm,
    longWeekdays: pending.profile?.longWeekdays ?? currentProfile.longWeekdays,
    restWeekdays: pending.profile?.restWeekdays ?? currentProfile.restWeekdays,
    mixEasy: pending.profile?.mixEasy ?? currentProfile.mixEasy,
    mixThreshold: pending.profile?.mixThreshold ?? currentProfile.mixThreshold,
    mixSpeed: pending.profile?.mixSpeed ?? currentProfile.mixSpeed,
  };
  let writtenUnits: TrainingUnit[] | undefined;
  let validation: ValidateResult = { hard: [], soft: [] };
  if (pending.creates !== undefined && pending.creates.length > 0) {
    const created = await persistPendingCreates(client, userId, monday, pending.creates, nextProfile.weeklyKm);
    if (!created.ok) {
      return created;
    }
    writtenUnits = created.units;
    validation = created.validation;
  }
  await upsertProfile(client, userId, nextProfile);
  for (const date of pending.freeze) {
    const result = await setFrozen(client, userId, date, true);
    if (!result.ok && result.error.code !== "NOT_FOUND") {
      return { ok: false, error: { code: "DB_ERROR", message: result.error.message } };
    }
  }
  for (const date of pending.unfreeze) {
    const result = await setFrozen(client, userId, date, false);
    if (!result.ok && result.error.code !== "NOT_FOUND") {
      return { ok: false, error: { code: "DB_ERROR", message: result.error.message } };
    }
  }
  if (pending.races !== undefined) {
    const applied = await applyPendingRaceWrites(client, userId, currentRaces, pending.races);
    if (applied !== null) {
      return applied;
    }
  }
  await setPendingProfileFreezeStatus(client, userId, pendingRow.id, "accepted");
  return {
    ok: true,
    weekStart: monday,
    units: writtenUnits ?? (await listWeek(client, userId, monday)),
    validation,
  };
}

function raceNotFoundError(): { code: "NOT_FOUND"; message: string } {
  return { code: "NOT_FOUND", message: "Race not found" };
}

function projectPendingRaces(
  current: Race[],
  patch: PendingRacesPatch,
): { ok: true; next: Race[] } | { ok: false; error: { code: "NOT_FOUND"; message: string } } {
  const byId = new Map(current.map((race) => [race.id, race]));
  const removeIds = new Set(patch.remove.map((item) => item.id));
  for (const item of patch.remove) {
    if (!byId.has(item.id)) {
      return { ok: false, error: raceNotFoundError() };
    }
  }
  for (const item of patch.patch) {
    if (!byId.has(item.id) || removeIds.has(item.id)) {
      return { ok: false, error: raceNotFoundError() };
    }
  }
  const next: Race[] = current
    .filter((race) => !removeIds.has(race.id))
    .map((race) => {
      const item = patch.patch.find((entry) => entry.id === race.id);
      return item === undefined ? race : mergeProjectedRace(race, item);
    });
  for (const [index, add] of patch.add.entries()) {
    next.push({
      id: `pending-add-${String(index)}`,
      date: add.date,
      priority: add.priority,
      ...(add.name === undefined ? {} : { name: add.name }),
      ...(add.goal === undefined ? {} : { goal: add.goal }),
    });
  }
  return { ok: true, next };
}

function mergeProjectedRace(current: Race, patch: PendingRacesPatch["patch"][number]): Race {
  const next: Race = {
    id: current.id,
    date: patch.date ?? current.date,
    priority: patch.priority ?? current.priority,
  };
  const name = patch.name ?? current.name;
  const goal = patch.goal ?? current.goal;
  if (name !== undefined) {
    next.name = name;
  }
  if (goal !== undefined) {
    next.goal = goal;
  }
  return next;
}

function toRaceWrite(race: { date: string; priority: RacePriority; name?: string; goal?: string }): RaceWrite {
  const write: RaceWrite = { date: race.date, priority: race.priority };
  if (race.name !== undefined) {
    write.name = race.name;
  }
  if (race.goal !== undefined) {
    write.goal = race.goal;
  }
  return write;
}

async function applyPendingRaceWrites(
  client: SupabaseClient,
  userId: string,
  current: Race[],
  patch: PendingRacesPatch,
): Promise<AcceptPropositionResult | null> {
  for (const item of patch.remove) {
    const result = await deleteRace(client, userId, item.id);
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message } };
    }
  }
  for (const item of patch.patch) {
    const existing = current.find((race) => race.id === item.id);
    if (existing === undefined) {
      return { ok: false, error: raceNotFoundError() };
    }
    const result = await updateRace(client, userId, item.id, toRaceWrite(mergeProjectedRace(existing, item)));
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message } };
    }
  }
  for (const item of patch.add) {
    const result = await insertRace(client, userId, toRaceWrite(item));
    if (!result.ok) {
      return { ok: false, error: { code: result.error.code, message: result.error.message } };
    }
  }
  return null;
}

async function insertMessage(
  client: SupabaseClient,
  userId: string,
  threadId: string,
  monday: string,
  role: ChatRole,
  content: string,
): Promise<string> {
  const { data, error } = await client
    .from("chat_messages")
    .insert({
      user_id: userId,
      thread_id: threadId,
      week_start: monday,
      role,
      content,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== "object" || data === null || !("id" in data) || typeof data.id !== "string") {
    throw new Error("Failed to insert message");
  }
  return data.id;
}

function encodeAssistantContent(reply: string, snapshot: FlagTurnSnapshot): string {
  return `${reply}\n\n${FLAG_TECHNICAL_MARKER}\n${JSON.stringify(snapshot, null, 2)}`;
}

function parseOptionalObject(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseOptionalStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    items.push(item);
  }
  return items;
}

function parseFlagTurnSnapshot(value: unknown): FlagTurnSnapshot | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  if (!("mutations" in value) || !("validation" in value) || !("dataRequest" in value) || !("persist" in value)) {
    return undefined;
  }
  if (!Array.isArray(value.mutations)) {
    return undefined;
  }
  const persist = value.persist;
  if (typeof persist !== "object" || persist === null) {
    return undefined;
  }
  if (
    !("proposedCount" in persist) ||
    !("appliedCount" in persist) ||
    !("weeksWritten" in persist) ||
    typeof persist.proposedCount !== "number" ||
    typeof persist.appliedCount !== "number" ||
    !Array.isArray(persist.weeksWritten)
  ) {
    return undefined;
  }
  return {
    mutations: value.mutations as UnitMutation[],
    log: "log" in value ? (parseOptionalObject(value.log) as FlagTurnSnapshot["log"]) : null,
    profile: "profile" in value ? parseOptionalObject(value.profile) : null,
    freeze: "freeze" in value ? parseOptionalStringArray(value.freeze) : null,
    unfreeze: "unfreeze" in value ? parseOptionalStringArray(value.unfreeze) : null,
    races: "races" in value ? (parseOptionalObject(value.races) as FlagTurnSnapshot["races"]) : null,
    validation: value.validation as ValidateResult,
    dataRequest: value.dataRequest as LoadedRange | null,
    persist: {
      proposedCount: persist.proposedCount,
      appliedCount: persist.appliedCount,
      weeksWritten: persist.weeksWritten as string[],
    },
  };
}

function decodeAssistantContent(raw: string): { reply: string; snapshot: FlagTurnSnapshot | undefined } {
  const split = splitAgentReportBody(raw);
  if (split.technical === null) {
    return { reply: raw, snapshot: undefined };
  }
  try {
    return { reply: split.prose, snapshot: parseFlagTurnSnapshot(JSON.parse(split.technical)) };
  } catch {
    return { reply: raw, snapshot: undefined };
  }
}

function buildTurnSnapshot(input: {
  proposed: ProposeResult;
  validation: ValidateResult;
  dataRequest: LoadedRange | null;
  appliedUnits?: TrainingUnit[];
}): FlagTurnSnapshot {
  const written = input.appliedUnits ?? [];
  const weeksWritten = [...new Set(written.map((unit) => utcMondayOf(unit.date)))].sort((left, right) =>
    left.localeCompare(right),
  );
  return {
    mutations: input.proposed.mutations,
    log: input.proposed.log ?? null,
    profile: input.proposed.profile ?? null,
    freeze: input.proposed.freeze ?? null,
    unfreeze: input.proposed.unfreeze ?? null,
    races: input.proposed.races ?? null,
    validation: input.validation,
    dataRequest: input.dataRequest,
    persist: {
      proposedCount: input.proposed.mutations.length,
      appliedCount: written.length,
      weeksWritten: written.length === 0 ? [] : weeksWritten,
    },
  };
}

async function stampAssistantSnapshot(
  client: SupabaseClient,
  userId: string,
  messageId: string,
  reply: string,
  snapshot: FlagTurnSnapshot,
): Promise<void> {
  try {
    const { error } = await client
      .from("chat_messages")
      .update({ content: encodeAssistantContent(reply, snapshot) })
      .eq("id", messageId)
      .eq("user_id", userId);
    if (error) {
      throw new Error(error.message);
    }
  } catch {
    // Best-effort: persist/log already committed; Flag degrades to prose-only.
  }
}

function asChatMessage(data: unknown): ChatMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (
    !("id" in data) ||
    !("week_start" in data) ||
    !("role" in data) ||
    !("content" in data) ||
    !("created_at" in data)
  ) {
    return null;
  }
  if (
    typeof data.id !== "string" ||
    typeof data.week_start !== "string" ||
    typeof data.content !== "string" ||
    typeof data.created_at !== "string"
  ) {
    return null;
  }
  if (data.role !== "user" && data.role !== "assistant") {
    return null;
  }
  return {
    id: data.id,
    role: data.role,
    content: data.role === "assistant" ? decodeAssistantContent(data.content).reply : data.content,
    createdAt: data.created_at,
    weekStart: data.week_start,
  };
}

function asPendingProfileFreezeRow(data: unknown): PendingProfileFreezeRow | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (
    !("id" in data) ||
    !("week_start" in data) ||
    !("profile_patch" in data) ||
    !("freeze_dates" in data) ||
    !("unfreeze_dates" in data) ||
    !("status" in data)
  ) {
    return null;
  }
  if (typeof data.id !== "string" || typeof data.week_start !== "string" || typeof data.status !== "string") {
    return null;
  }
  return {
    id: data.id,
    week_start: data.week_start,
    profile_patch: data.profile_patch,
    freeze_dates: data.freeze_dates,
    unfreeze_dates: data.unfreeze_dates,
    races_patch: "races_patch" in data ? data.races_patch : null,
    calendar_creates: "calendar_creates" in data ? data.calendar_creates : null,
    status: data.status,
  };
}

function toPendingProfileFreeze(row: PendingProfileFreezeRow | null): PendingProfileFreeze | null {
  if (row?.status !== "pending") {
    return null;
  }
  const freeze = parseDateList(row.freeze_dates);
  const unfreeze = parseDateList(row.unfreeze_dates);
  const profile = parseProfilePatch(row.profile_patch);
  const races = parseRacesPatch(row.races_patch);
  const creates = parseCalendarCreates(row.calendar_creates);
  if (
    profile === undefined &&
    freeze.length === 0 &&
    unfreeze.length === 0 &&
    races === undefined &&
    creates === undefined
  ) {
    return null;
  }
  return {
    id: row.id,
    weekStart: row.week_start,
    ...(profile === undefined ? {} : { profile }),
    freeze,
    unfreeze,
    ...(races === undefined ? {} : { races }),
    ...(creates === undefined ? {} : { creates }),
  };
}

function parseProfilePatch(value: unknown): ProfilePatch | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const patch: ProfilePatch = {};
  if (
    "weeklyKm" in value &&
    typeof value.weeklyKm === "number" &&
    Number.isFinite(value.weeklyKm) &&
    value.weeklyKm > 0
  ) {
    patch.weeklyKm = value.weeklyKm;
  }
  if (
    "longWeekdays" in value &&
    Array.isArray(value.longWeekdays) &&
    value.longWeekdays.every((day) => typeof day === "string")
  ) {
    patch.longWeekdays = [...new Set(value.longWeekdays)] as Profile["longWeekdays"];
  }
  if (
    "restWeekdays" in value &&
    Array.isArray(value.restWeekdays) &&
    value.restWeekdays.every((day) => typeof day === "string")
  ) {
    patch.restWeekdays = [...new Set(value.restWeekdays)] as Profile["restWeekdays"];
  }
  if ("mixEasy" in value && typeof value.mixEasy === "number" && Number.isFinite(value.mixEasy)) {
    patch.mixEasy = Math.round(value.mixEasy);
  }
  if ("mixThreshold" in value && typeof value.mixThreshold === "number" && Number.isFinite(value.mixThreshold)) {
    patch.mixThreshold = Math.round(value.mixThreshold);
  }
  if ("mixSpeed" in value && typeof value.mixSpeed === "number" && Number.isFinite(value.mixSpeed)) {
    patch.mixSpeed = Math.round(value.mixSpeed);
  }
  return Object.keys(patch).length === 0 ? undefined : patch;
}

function parseDateList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(value.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item))),
  ].sort();
}

function isRacePriority(value: unknown): value is RacePriority {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

function optionalRaceText(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function parseRaceAdd(value: unknown): PendingRacesPatch["add"][number] | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  if (!("date" in value) || !("priority" in value)) {
    return null;
  }
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !isRacePriority(value.priority)) {
    return null;
  }
  const add: PendingRacesPatch["add"][number] = { date: value.date, priority: value.priority };
  const name = "name" in value ? optionalRaceText(value.name) : undefined;
  const goal = "goal" in value ? optionalRaceText(value.goal) : undefined;
  if (name !== undefined) {
    add.name = name;
  }
  if (goal !== undefined) {
    add.goal = goal;
  }
  return add;
}

function parseRaceRemove(value: unknown): PendingRacesPatch["remove"][number] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    value.id === ""
  ) {
    return null;
  }
  return { id: value.id };
}

function parseRacePatch(value: unknown): PendingRacesPatch["patch"][number] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    value.id === ""
  ) {
    return null;
  }
  const patch: PendingRacesPatch["patch"][number] = { id: value.id };
  if ("date" in value && typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    patch.date = value.date;
  }
  if ("priority" in value && isRacePriority(value.priority)) {
    patch.priority = value.priority;
  }
  const name = "name" in value ? optionalRaceText(value.name) : undefined;
  const goal = "goal" in value ? optionalRaceText(value.goal) : undefined;
  if (name !== undefined) {
    patch.name = name;
  }
  if (goal !== undefined) {
    patch.goal = goal;
  }
  return patch;
}

function parseRacesPatch(value: unknown): PendingRacesPatch | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const add =
    "add" in value && Array.isArray(value.add)
      ? value.add.flatMap((item) => {
          const parsed = parseRaceAdd(item);
          return parsed === null ? [] : [parsed];
        })
      : [];
  const remove =
    "remove" in value && Array.isArray(value.remove)
      ? value.remove.flatMap((item) => {
          const parsed = parseRaceRemove(item);
          return parsed === null ? [] : [parsed];
        })
      : [];
  const patch =
    "patch" in value && Array.isArray(value.patch)
      ? value.patch.flatMap((item) => {
          const parsed = parseRacePatch(item);
          return parsed === null ? [] : [parsed];
        })
      : [];
  if (add.length === 0 && remove.length === 0 && patch.length === 0) {
    return undefined;
  }
  return { add, remove, patch };
}

function parseCalendarCreates(value: unknown): UnitMutation[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const creates = value.flatMap((item) => {
    const parsed = parseCalendarCreate(item);
    return parsed === null ? [] : [parsed];
  });
  return creates.length === 0 ? undefined : creates;
}

function parseCalendarCreate(value: unknown): UnitMutation | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("date" in value) ||
    !("type" in value) ||
    !("distanceKm" in value)
  ) {
    return null;
  }
  if (typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    return null;
  }
  if (!isPendingWorkoutType(value.type)) {
    return null;
  }
  if (typeof value.distanceKm !== "number" || !Number.isFinite(value.distanceKm) || value.distanceKm < 0) {
    return null;
  }
  const create: UnitMutation = { date: value.date, type: value.type, distanceKm: value.distanceKm };
  if ("structure" in value && typeof value.structure === "string" && value.structure !== "") {
    create.structure = value.structure;
  }
  return create;
}

function isPendingWorkoutType(value: unknown): value is WorkoutType {
  return (
    value === "base" ||
    value === "recovery" ||
    value === "tempo" ||
    value === "threshold" ||
    value === "anaerobic" ||
    value === "long"
  );
}

function partitionCalendarMutations(
  mutations: UnitMutation[],
  existingDates: Set<string>,
  horizon: { createFrom: string; createTo: string },
): { autoApply: UnitMutation[]; pendingCreates: UnitMutation[] } {
  const autoApply: UnitMutation[] = [];
  const pendingCreates: UnitMutation[] = [];
  for (const mutation of mutations) {
    const isNew =
      mutation.delete !== true &&
      !existingDates.has(mutation.date) &&
      mutation.type !== undefined &&
      mutation.distanceKm !== undefined;
    if (isNew && !inHorizon(mutation.date, horizon.createFrom, horizon.createTo)) {
      pendingCreates.push(mutation);
    } else {
      autoApply.push(mutation);
    }
  }
  return { autoApply, pendingCreates };
}

function sanitizePendingProfileFreeze(
  proposed: ProposeResult,
  profile: Profile,
  units: TrainingUnit[],
  pendingCreates: UnitMutation[] = [],
): PendingProfileFreeze | null {
  const mergedProfile = mergeProfilePatch(profile, parseProfilePatch(proposed.profile));
  const allowedDates = new Set(units.map((unit) => unit.date));
  const freeze = parseDateList(proposed.freeze).filter((date) => allowedDates.has(date));
  const unfreeze = parseDateList(proposed.unfreeze).filter((date) => allowedDates.has(date) && !freeze.includes(date));
  const races = parseRacesPatch(proposed.races);
  const creates = pendingCreates.filter(
    (mutation) => mutation.delete !== true && mutation.type !== undefined && mutation.distanceKm !== undefined,
  );
  if (
    mergedProfile === undefined &&
    freeze.length === 0 &&
    unfreeze.length === 0 &&
    races === undefined &&
    creates.length === 0
  ) {
    return null;
  }
  return {
    id: "pending-profile-freeze",
    weekStart: "",
    ...(mergedProfile === undefined ? {} : { profile: mergedProfile }),
    freeze,
    unfreeze,
    ...(races === undefined ? {} : { races }),
    ...(creates.length === 0 ? {} : { creates }),
  };
}

function mergeProfilePatch(current: Profile, patch: ProfilePatch | undefined): ProfilePatch | undefined {
  if (patch === undefined) {
    return undefined;
  }
  const merged: Profile = {
    weeklyKm: patch.weeklyKm ?? current.weeklyKm,
    longWeekdays: patch.longWeekdays ?? current.longWeekdays,
    restWeekdays: patch.restWeekdays ?? current.restWeekdays,
    mixEasy: patch.mixEasy ?? current.mixEasy,
    mixThreshold: patch.mixThreshold ?? current.mixThreshold,
    mixSpeed: patch.mixSpeed ?? current.mixSpeed,
  };
  if (
    merged.weeklyKm <= 0 ||
    merged.longWeekdays.length === 0 ||
    merged.mixEasy < 0 ||
    merged.mixThreshold < 0 ||
    merged.mixSpeed < 0 ||
    merged.mixEasy + merged.mixThreshold + merged.mixSpeed !== 100
  ) {
    return undefined;
  }
  return patch;
}
