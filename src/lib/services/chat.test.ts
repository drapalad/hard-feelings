import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addUtcDays, utcMondayOf, utcToday, weekDates } from "@/lib/dates";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import { applyMutations } from "./plan-adaptation";
import { type ProposeCompleteFn } from "./propose-adaptation";
import {
  acceptDecision,
  acceptProposition,
  createThread,
  dismissPendingProfileFreeze,
  listChat,
  listThreads,
  reportAssistantGap,
  sendMessage,
} from "./chat";
import { listWeek } from "./plan";
import { listRaces } from "./races";
import { FLAG_TECHNICAL_MARKER } from "./agent-report";
import type { FlagTurnSnapshot, TrainingUnit } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const WEEKLY_KM = 50;
const USER_ID = "member-chat";
const MONDAY = "2026-08-10";
const DATES = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"];
const chatSource = readFileSync(path.join(import.meta.dirname, "chat.ts"), "utf8");

function unit(partial: Partial<TrainingUnit> & Pick<TrainingUnit, "date">): TrainingUnit {
  return {
    type: "base",
    distanceKm: 7,
    frozen: false,
    ...partial,
  };
}

const week: TrainingUnit[] = [
  unit({ date: "2026-08-10", type: "base" }),
  unit({ date: "2026-08-11", type: "tempo" }),
  unit({ date: "2026-08-12", type: "recovery" }),
  unit({ date: "2026-08-13", type: "threshold" }),
  unit({ date: "2026-08-14", type: "base" }),
  unit({ date: "2026-08-15", type: "long" }),
  unit({ date: "2026-08-16", type: "recovery" }),
];

const CURRENT = DATES.map((date) => unit({ date, type: "base", distanceKm: 5 }));

function seedSendClient(): ReturnType<typeof createMemorySupabase> {
  return createMemorySupabase({
    profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
    training_units: CURRENT.map((item) => ({
      user_id: USER_ID,
      date: item.date,
      type: item.type,
      distance_km: item.distanceKm,
      structure: null,
      frozen: item.frozen,
    })),
  });
}

async function revisionCount(client: SupabaseClient): Promise<number | null> {
  const { count, error } = await client
    .from("plan_revisions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", USER_ID);
  expect(error).toBeNull();
  return count;
}

async function reportRows(client: SupabaseClient): Promise<unknown[]> {
  const { data, error } = await client.from("agent_reports").select("*").order("created_at");
  expect(error).toBeNull();
  return Array.isArray(data) ? (data as unknown[]) : [];
}

async function pendingProfileFreezeRows(client: SupabaseClient): Promise<unknown[]> {
  const { data, error } = await client.from("chat_profile_freeze_pending").select("*").order("created_at");
  expect(error).toBeNull();
  return Array.isArray(data) ? (data as unknown[]) : [];
}

function completeWith(
  mutations: { date: string; distanceKm?: number; delete?: true }[],
  log?: { date: string },
): ProposeCompleteFn {
  return () =>
    Promise.resolve({
      reply: "ok",
      mutations,
      ...(log === undefined ? {} : { log }),
    });
}

describe("acceptDecision", () => {
  it("returns HARD_BOUNDS when gateAccept fails and does not represent a persist", () => {
    const plan = applyMutations(week, [{ date: "2026-08-14", distanceKm: 200 }]);
    const decision = acceptDecision(plan, WEEKLY_KM, []);

    expect(decision.ok).toBe(false);
    if (decision.ok) {
      return;
    }
    expect(decision.code).toBe("HARD_BOUNDS");
    expect(decision.validation.hard).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "hard" }),
    ]);
  });

  it("returns ok true for a soft-only overage", () => {
    const plan = applyMutations(week, [{ date: "2026-08-14", distanceKm: 12.1 }]);
    const decision = acceptDecision(plan, WEEKLY_KM, []);

    expect(decision.ok).toBe(true);
    expect(decision.validation.hard).toEqual([]);
    expect(decision.validation.soft).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft" }),
    ]);
  });
});

describe("sendMessage", () => {
  it("does not return PLAN_EMPTY and passes the UTC create horizon into complete", async () => {
    expect(chatSource).not.toContain("PLAN_EMPTY");
    const today = utcToday();
    const horizonUnitDate = addUtcDays(today, 10);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: horizonUnitDate,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
      ],
    });
    let captured: Parameters<ProposeCompleteFn>[0] | undefined;
    const complete: ProposeCompleteFn = (request) => {
      captured = request;
      return Promise.resolve({ reply: "ok", mutations: [] });
    };
    const result = await sendMessage(client, USER_ID, utcMondayOf(today), "lay out the next 14 days", { complete });
    expect(result.ok).toBe(true);
    expect(captured?.createFrom).toBe(today);
    expect(captured?.createTo).toBe(addUtcDays(today, 13));
    expect(captured?.units.some((unit) => unit.date === horizonUnitDate)).toBe(true);
    expect(captured?.profile?.weeklyKm).toBe(WEEKLY_KM);
    expect(captured?.currentLoad?.to).toBe(today);
    if (result.ok) {
      expect(result.data.loadedRange).toBeNull();
    }
  });

  it("injects isoWeeks for ISO weeks overlapping the create horizon including the bleed Monday", async () => {
    const today = utcToday();
    const bleedMonday = utcMondayOf(today);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: bleedMonday,
          type: "long",
          distance_km: 18,
          structure: null,
          frozen: false,
        },
      ],
      workout_logs: [{ user_id: USER_ID, date: bleedMonday, type: "long", distance_km: 16 }],
    });
    let captured: Parameters<ProposeCompleteFn>[0] | undefined;
    const complete: ProposeCompleteFn = (request) => {
      captured = request;
      return Promise.resolve({ reply: "ok", mutations: [] });
    };
    const result = await sendMessage(client, USER_ID, utcMondayOf(today), "lay out the next 14 days", { complete });
    expect(result.ok).toBe(true);
    expect(captured?.currentLoad).toEqual(expect.objectContaining({ to: today }));
    const isoWeek = captured?.isoWeeks?.find((week) => week.monday === bleedMonday);
    expect(isoWeek).toEqual({
      monday: bleedMonday,
      plannedKm: 18,
      loggedKm: 16,
      dates: weekDates(bleedMonday),
    });
    expect(captured?.isoWeeks?.every((week) => week.dates.length === 7)).toBe(true);
  });

  it("persists mutations when hard is empty and does not leave a revision", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "make Friday longer", {
      complete: completeWith([{ date: "2026-08-14", distanceKm: 25 }]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data).not.toHaveProperty("proposition");
    expect(result.data.validation?.hard).toEqual([]);
    expect(result.data.units?.find((item) => item.date === "2026-08-14")?.distanceKm).toBe(25);
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: "2026-08-14", distanceKm: 25 })]),
    );
    expect(await revisionCount(client)).toBe(0);
  });

  it("persists delete true by removing the row including out-of-horizon dates and skips frozen", async () => {
    const today = utcToday();
    const outOfHorizon = addUtcDays(today, -1);
    const frozenDate = addUtcDays(today, 1);
    const inHorizon = addUtcDays(today, 2);
    const requestMonday = utcMondayOf(outOfHorizon);
    const otherMonday = utcMondayOf(inHorizon);
    const VICTIM = "member-other";
    const seen = new Set<string>();
    const memberRows: Record<string, unknown>[] = [];
    for (const monday of [requestMonday, otherMonday]) {
      for (const date of weekDates(monday)) {
        const key = `${USER_ID}:${date}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        memberRows.push({
          user_id: USER_ID,
          date,
          type: "base",
          distance_km: 5,
          structure: null,
          frozen: date === frozenDate,
        });
      }
    }
    const client = createMemorySupabase({
      profiles: [
        { user_id: USER_ID, weekly_km: WEEKLY_KM },
        { user_id: VICTIM, weekly_km: WEEKLY_KM },
      ],
      training_units: [
        ...memberRows,
        {
          user_id: VICTIM,
          date: outOfHorizon,
          type: "long",
          distance_km: 20,
          structure: null,
          frozen: false,
        },
      ],
    });

    const removed = await sendMessage(client, USER_ID, requestMonday, "remove yesterday", {
      complete: completeWith([{ date: outOfHorizon, delete: true }]),
    });
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.data.units?.find((item) => item.date === outOfHorizon)).toBeUndefined();
    }
    const afterRemove = await client
      .from("training_units")
      .select("user_id,date,type,distance_km")
      .eq("date", outOfHorizon);
    expect(afterRemove.error).toBeNull();
    const remaining = Array.isArray(afterRemove.data) ? afterRemove.data : [];
    expect(remaining).toEqual([
      expect.objectContaining({ user_id: VICTIM, date: outOfHorizon, type: "long", distance_km: 20 }),
    ]);
    expect(remaining.some((row) => row.user_id === USER_ID)).toBe(false);

    const frozen = await sendMessage(client, USER_ID, utcMondayOf(frozenDate), "remove the frozen day", {
      complete: completeWith([{ date: frozenDate, delete: true }]),
    });
    expect(frozen.ok).toBe(true);
    expect(await listWeek(client, USER_ID, utcMondayOf(frozenDate))).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: frozenDate, frozen: true })]),
    );

    const inHorizonRemoved = await sendMessage(client, USER_ID, otherMonday, "remove a future day", {
      complete: completeWith([{ date: inHorizon, delete: true }]),
    });
    expect(inHorizonRemoved.ok).toBe(true);
    if (inHorizonRemoved.ok) {
      expect(inHorizonRemoved.data.units?.find((item) => item.date === inHorizon)).toBeUndefined();
    }
    const afterInHorizon = await listWeek(client, USER_ID, otherMonday);
    expect(afterInHorizon.find((item) => item.date === inHorizon)).toBeUndefined();
    expect(afterInHorizon.some((item) => item.distanceKm === 0 && item.type === "recovery")).toBe(false);
  });

  it("stamps a technical snapshot on the assistant row and strips it from listChat", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "make Friday longer", {
      complete: completeWith([{ date: "2026-08-14", distanceKm: 25 }]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const assistant = result.data.messages.find((message) => message.role === "assistant");
    expect(assistant?.content).toBe("ok");
    expect(assistant?.content).not.toContain(FLAG_TECHNICAL_MARKER);

    const stored = await client
      .from("chat_messages")
      .select("content")
      .eq("id", assistant?.id ?? "")
      .maybeSingle();
    expect(stored.error).toBeNull();
    expect(typeof stored.data?.content).toBe("string");
    expect(String(stored.data?.content)).toContain(FLAG_TECHNICAL_MARKER);
    expect(String(stored.data?.content)).toContain("2026-08-14");

    const flagged = await reportAssistantGap(client, USER_ID, MONDAY, assistant?.id ?? "");
    expect(flagged).toEqual({ ok: true });
    const reports = await reportRows(client);
    const gap = reports.find(
      (row) => typeof row === "object" && row !== null && "kind" in row && row.kind === "gap",
    ) as { body: string } | undefined;
    expect(gap?.body).toContain("User: make Friday longer");
    expect(gap?.body).toContain("Assistant: ok");
    expect(gap?.body).not.toContain(`${FLAG_TECHNICAL_MARKER}\nAssistant`);
    const snapshot = JSON.parse(gap?.body.split(FLAG_TECHNICAL_MARKER)[1] ?? "null") as FlagTurnSnapshot;
    expect(snapshot.mutations).toEqual([expect.objectContaining({ date: "2026-08-14", distanceKm: 25 })]);
    expect(snapshot.log).toBeNull();
    expect(snapshot.profile).toBeNull();
    expect(snapshot.freeze).toBeNull();
    expect(snapshot.unfreeze).toBeNull();
    expect(snapshot.races).toBeNull();
    expect(snapshot.persist.appliedCount).toBeGreaterThan(0);
    expect(snapshot.persist.proposedCount).toBe(1);
  });

  it("stamps log, profile, freeze, and races from a log-only propose", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "I completed Tuesday", {
      complete: () =>
        Promise.resolve({
          reply: "logged",
          mutations: [{ date: "2026-08-14", distanceKm: 25 }],
          log: { date: "2026-08-11", distanceKm: 8 },
          profile: { restWeekdays: ["tue"] },
          freeze: ["2026-08-10"],
          unfreeze: ["2026-08-12"],
          races: {
            add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
            remove: [],
            patch: [],
          },
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const assistant = result.data.messages.find((message) => message.role === "assistant");
    const flagged = await reportAssistantGap(client, USER_ID, MONDAY, assistant?.id ?? "");
    expect(flagged).toEqual({ ok: true });
    const reports = await reportRows(client);
    const gap = reports.find(
      (row) => typeof row === "object" && row !== null && "kind" in row && row.kind === "gap",
    ) as { body: string } | undefined;
    const snapshot = JSON.parse(gap?.body.split(FLAG_TECHNICAL_MARKER)[1] ?? "null") as FlagTurnSnapshot;
    expect(snapshot.mutations).toEqual([]);
    expect(snapshot.log).toEqual({ date: "2026-08-11", distanceKm: 8 });
    expect(snapshot.profile).toEqual({ restWeekdays: ["tue"] });
    expect(snapshot.freeze).toEqual(["2026-08-10"]);
    expect(snapshot.unfreeze).toEqual(["2026-08-12"]);
    expect(snapshot.races).toEqual({
      add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
      remove: [],
      patch: [],
    });
    expect(snapshot.persist).toEqual({ proposedCount: 0, appliedCount: 0, weeksWritten: [] });
  });

  it("does not persist mutations when hard is non-empty", async () => {
    const client = seedSendClient();
    const before = await listWeek(client, USER_ID, MONDAY);
    const result = await sendMessage(client, USER_ID, MONDAY, "make Friday huge", {
      complete: completeWith([{ date: "2026-08-14", distanceKm: 40 }]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data).not.toHaveProperty("proposition");
    expect(result.data.units).toBeUndefined();
    expect(result.data.validation?.hard).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "hard" }),
    ]);
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(before);
    expect(await revisionCount(client)).toBe(0);
    expect(await reportRows(client)).toEqual([
      expect.objectContaining({
        source_user_id: USER_ID,
        kind: "algorithm_proposal",
        status: "open",
      }),
    ]);
  });

  it("flags a hard-blocked send with appliedCount 0 and keeps the algorithm_proposal row", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "make Friday huge", {
      complete: completeWith([{ date: "2026-08-14", distanceKm: 40 }]),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const assistant = result.data.messages.find((message) => message.role === "assistant");
    expect(assistant).toBeDefined();
    const flagged = await reportAssistantGap(client, USER_ID, MONDAY, assistant?.id ?? "");
    expect(flagged).toEqual({ ok: true });
    const reports = await reportRows(client);
    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "algorithm_proposal" }),
        expect.objectContaining({ kind: "gap" }),
      ]),
    );
    const gap = reports.find(
      (row) => typeof row === "object" && row !== null && "kind" in row && row.kind === "gap",
    ) as { body: string } | undefined;
    const snapshot = JSON.parse(gap?.body.split(FLAG_TECHNICAL_MARKER)[1] ?? "null") as FlagTurnSnapshot;
    expect(snapshot.persist.appliedCount).toBe(0);
    expect(snapshot.persist.weeksWritten).toEqual([]);
    expect(snapshot.persist.proposedCount).toBeGreaterThanOrEqual(1);
  });

  it("does not write training_units for empty mutations or a log-only turn", async () => {
    const explainClient = seedSendClient();
    const beforeExplain = await listWeek(explainClient, USER_ID, MONDAY);
    const explain = await sendMessage(explainClient, USER_ID, MONDAY, "what is Tuesday for", {
      complete: completeWith([]),
    });
    expect(explain.ok).toBe(true);
    expect(await listWeek(explainClient, USER_ID, MONDAY)).toEqual(beforeExplain);

    const logClient = seedSendClient();
    const beforeLog = await listWeek(logClient, USER_ID, MONDAY);
    const logged = await sendMessage(logClient, USER_ID, MONDAY, "I completed Tuesday", {
      complete: completeWith([], { date: "2026-08-11" }),
    });
    expect(logged.ok).toBe(true);
    expect(await listWeek(logClient, USER_ID, MONDAY)).toEqual(beforeLog);
  });

  it("stores a pending profile/freeze patch without applying it on send", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "freeze monday and rest on tuesday", {
      complete: () =>
        Promise.resolve({
          reply: "I can freeze Monday and make Tuesday a rest day preference.",
          mutations: [],
          profile: { restWeekdays: ["tue"] },
          freeze: ["2026-08-10", "not-a-date"],
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pendingProfileFreeze?.freeze).toEqual(["2026-08-10"]);
    expect(result.data.pendingProfileFreeze?.profile?.restWeekdays).toEqual(["tue"]);
    expect((await listWeek(client, USER_ID, MONDAY)).find((unit) => unit.date === "2026-08-10")?.frozen).toBe(false);
    const profile = await client.from("profiles").select("*").eq("user_id", USER_ID).maybeSingle();
    expect(profile.data).toEqual(expect.objectContaining({ weekly_km: WEEKLY_KM }));
  });

  it("passes compact first-pass races without a dataRequest", async () => {
    const today = utcToday();
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: CURRENT.map((item) => ({
        user_id: USER_ID,
        date: item.date,
        type: item.type,
        distance_km: item.distanceKm,
        structure: null,
        frozen: item.frozen,
      })),
      races: [
        { id: "upcoming-a", user_id: USER_ID, date: addUtcDays(today, 30), priority: "A", name: "Goal", goal: "sub-3" },
        { id: "past-b", user_id: USER_ID, date: addUtcDays(today, -20), priority: "B", name: "Old" },
      ],
    });
    const calls: Parameters<ProposeCompleteFn>[0][] = [];
    const complete: ProposeCompleteFn = (request) => {
      calls.push(request);
      return Promise.resolve({ reply: "ok", mutations: [] });
    };
    const result = await sendMessage(client, USER_ID, utcMondayOf(today), "what races do I have", { complete });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.races?.some((race) => race.id === "upcoming-a")).toBe(true);
    expect(calls[0]?.races?.some((race) => race.id === "past-b")).toBe(false);
    expect(calls[0]?.extra).toBeUndefined();
  });

  it("stores a pending races patch without writing races on send", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "add Spring HM as an A race on 2027-04-12", {
      complete: () =>
        Promise.resolve({
          reply: "I can add Spring HM.",
          mutations: [],
          races: {
            add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
            remove: [],
            patch: [],
          },
        }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.pendingProfileFreeze?.races?.add).toEqual([
      { date: "2027-04-12", priority: "A", name: "Spring HM" },
    ]);
    expect(await listRaces(client, USER_ID)).toEqual([]);
  });

  it("still auto-applies km mutations when a races patch is also proposed", async () => {
    const client = seedSendClient();
    const result = await sendMessage(client, USER_ID, MONDAY, "make Monday 6 km and add a race", {
      complete: () =>
        Promise.resolve({
          reply: "Eased Monday and queued a race.",
          mutations: [{ date: "2026-08-10", distanceKm: 6 }],
          races: {
            add: [{ date: "2027-04-12", priority: "B", name: "Spring HM" }],
            remove: [],
            patch: [],
          },
        }),
    });
    expect(result.ok).toBe(true);
    expect((await listWeek(client, USER_ID, MONDAY)).find((unit) => unit.date === "2026-08-10")?.distanceKm).toBe(6);
    expect(await listRaces(client, USER_ID)).toEqual([]);
  });

  it("passes profile/current-load first and fetches a loaded range on the second complete", async () => {
    const today = utcToday();
    const priorDate = addUtcDays(today, -7);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: today,
          type: "base",
          distance_km: 8,
          structure: "6x1k",
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: priorDate,
          type: "tempo",
          distance_km: 10,
          structure: null,
          frozen: false,
        },
      ],
      races: [{ id: "race-a", user_id: USER_ID, date: addUtcDays(today, 30), priority: "A", name: "Goal" }],
      workout_logs: [{ user_id: USER_ID, date: today, type: "base", distance_km: 8 }],
    });
    const calls: Parameters<ProposeCompleteFn>[0][] = [];
    const complete: ProposeCompleteFn = (request) => {
      calls.push(request);
      if (calls.length === 1) {
        return Promise.resolve({
          reply: "need extra",
          mutations: [],
          dataRequest: { from: priorDate, to: addUtcDays(today, 30) },
        });
      }
      return Promise.resolve({ reply: "with extra", mutations: [] });
    };
    const result = await sendMessage(client, USER_ID, utcMondayOf(today), "how has volume been", { complete });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calls).toHaveLength(2);
    expect(calls[0]?.units.some((unit) => unit.date === today && unit.structure === "6x1k")).toBe(true);
    expect(calls[0]?.profile?.weeklyKm).toBe(WEEKLY_KM);
    expect(calls[0]?.currentLoad?.loggedKm).toBe(8);
    expect(calls[1]?.extra?.range).toEqual({ from: priorDate, to: addUtcDays(today, 30) });
    expect(calls[1]?.extra?.units?.some((unit) => unit.date === priorDate)).toBe(true);
    expect(calls[1]?.extra?.logs?.some((log) => log.date === today)).toBe(true);
    expect(calls[1]?.extra?.races?.some((race) => race.id === "race-a")).toBe(true);
    expect(result.data.loadedRange).toEqual({ from: priorDate, to: addUtcDays(today, 30) });
  });

  it("persists extra-range deletes outside the create window and does not touch other members", async () => {
    const today = utcToday();
    const farMonday = addUtcDays(utcMondayOf(today), 21);
    const farA = farMonday;
    const farB = addUtcDays(farMonday, 1);
    const farKeep = addUtcDays(farMonday, 2);
    const VICTIM = "member-other-far";
    const client = createMemorySupabase({
      profiles: [
        { user_id: USER_ID, weekly_km: WEEKLY_KM },
        { user_id: VICTIM, weekly_km: WEEKLY_KM },
      ],
      training_units: [
        {
          user_id: USER_ID,
          date: today,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: farA,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: farB,
          type: "tempo",
          distance_km: 10,
          structure: null,
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: farKeep,
          type: "recovery",
          distance_km: 5,
          structure: null,
          frozen: false,
        },
        {
          user_id: VICTIM,
          date: farA,
          type: "long",
          distance_km: 20,
          structure: null,
          frozen: false,
        },
      ],
    });
    const result = await sendMessage(client, USER_ID, utcMondayOf(today), "usuń 28 i 29", {
      complete: (request) => {
        if (request.extra === undefined) {
          return Promise.resolve({
            reply: "need extra",
            mutations: [],
            dataRequest: { from: farA, to: farKeep },
          });
        }
        return Promise.resolve({
          reply: "Removed both.",
          mutations: [
            { date: farA, delete: true },
            { date: farB, delete: true },
          ],
        });
      },
    });
    expect(result.ok).toBe(true);
    const after = await listWeek(client, USER_ID, farMonday);
    expect(after.find((unit) => unit.date === farA)).toBeUndefined();
    expect(after.find((unit) => unit.date === farB)).toBeUndefined();
    expect(after.find((unit) => unit.date === farKeep)).toEqual(
      expect.objectContaining({ date: farKeep, type: "recovery", distanceKm: 5 }),
    );
    const victim = await client.from("training_units").select("user_id,date,type,distance_km").eq("date", farA);
    expect(victim.error).toBeNull();
    const remaining = Array.isArray(victim.data) ? victim.data : [];
    expect(remaining).toEqual([
      expect.objectContaining({ user_id: VICTIM, date: farA, type: "long", distance_km: 20 }),
    ]);
  });

  it("skips frozen extra-range deletes, persists km changes, and drops deletes without a loaded range", async () => {
    const today = utcToday();
    const farMonday = addUtcDays(utcMondayOf(today), 21);
    const farKeep = addUtcDays(farMonday, 2);
    const farFrozen = addUtcDays(farMonday, 3);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: today,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: farKeep,
          type: "recovery",
          distance_km: 5,
          structure: null,
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: farFrozen,
          type: "long",
          distance_km: 18,
          structure: null,
          frozen: true,
        },
      ],
    });

    const frozen = await sendMessage(client, USER_ID, utcMondayOf(today), "usuń frozen", {
      complete: (request) => {
        if (request.extra === undefined) {
          return Promise.resolve({
            reply: "need extra",
            mutations: [],
            dataRequest: { from: farFrozen, to: farFrozen },
          });
        }
        return Promise.resolve({
          reply: "Tried to remove frozen.",
          mutations: [{ date: farFrozen, delete: true }],
        });
      },
    });
    expect(frozen.ok).toBe(true);
    expect(await listWeek(client, USER_ID, farMonday)).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: farFrozen, frozen: true, distanceKm: 18 })]),
    );

    const changed = await sendMessage(client, USER_ID, utcMondayOf(today), "skróć keep", {
      complete: (request) => {
        if (request.extra === undefined) {
          return Promise.resolve({
            reply: "need extra",
            mutations: [],
            dataRequest: { from: farKeep, to: farKeep },
          });
        }
        return Promise.resolve({
          reply: "Eased keep.",
          mutations: [{ date: farKeep, distanceKm: 3 }],
        });
      },
    });
    expect(changed.ok).toBe(true);
    expect((await listWeek(client, USER_ID, farMonday)).find((unit) => unit.date === farKeep)?.distanceKm).toBe(3);

    const skipped = await sendMessage(client, USER_ID, utcMondayOf(today), "usuń bez load", {
      complete: () =>
        Promise.resolve({
          reply: "Cannot.",
          mutations: [{ date: farKeep, delete: true }],
        }),
    });
    expect(skipped.ok).toBe(true);
    expect((await listWeek(client, USER_ID, farMonday)).find((unit) => unit.date === farKeep)?.distanceKm).toBe(3);
  });

  it("queues extra-range creates for Accept and persists them only after accept", async () => {
    const today = utcToday();
    const farMonday = addUtcDays(utcMondayOf(today), 21);
    const farCreate = addUtcDays(farMonday, 1);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: today,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
      ],
    });
    const sent = await sendMessage(client, USER_ID, utcMondayOf(today), "dodaj trening", {
      complete: () =>
        Promise.resolve({
          reply: "Added a far day.",
          mutations: [{ date: farCreate, type: "base", distanceKm: 8 }],
        }),
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      return;
    }
    expect(sent.data.pendingProfileFreeze?.creates).toEqual([{ date: farCreate, type: "base", distanceKm: 8 }]);
    expect(await listWeek(client, USER_ID, farMonday)).toEqual([]);

    const accepted = await acceptProposition(client, USER_ID, utcMondayOf(today));
    expect(accepted.ok).toBe(true);
    expect((await listWeek(client, USER_ID, farMonday)).find((unit) => unit.date === farCreate)).toEqual(
      expect.objectContaining({ date: farCreate, type: "base", distanceKm: 8, frozen: false }),
    );
    expect(await pendingProfileFreezeRows(client)).toEqual([expect.objectContaining({ status: "accepted" })]);
  });

  it("passes adminCoachNotes on first-pass and extra follow-up complete calls", async () => {
    const today = utcToday();
    const priorDate = addUtcDays(today, -7);
    const fixtures = {
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: [
        {
          user_id: USER_ID,
          date: today,
          type: "base",
          distance_km: 8,
          structure: "6x1k",
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: priorDate,
          type: "tempo",
          distance_km: 10,
          structure: null,
          frozen: false,
        },
      ],
      races: [{ id: "race-a", user_id: USER_ID, date: addUtcDays(today, 30), priority: "A" as const, name: "Goal" }],
      workout_logs: [{ user_id: USER_ID, date: today, type: "base", distance_km: 8 }],
    };
    type CompleteRequest = Parameters<ProposeCompleteFn>[0] & { adminCoachNotes?: string | null };

    const withNotes = createMemorySupabase({
      ...fixtures,
      project_settings: [{ id: "default", coach_notes: "Project-wide cue" }],
    });
    const notedCalls: CompleteRequest[] = [];
    const notedComplete: ProposeCompleteFn = (request) => {
      notedCalls.push(request);
      if (notedCalls.length === 1) {
        return Promise.resolve({
          reply: "need extra",
          mutations: [],
          dataRequest: { from: priorDate, to: addUtcDays(today, 30) },
        });
      }
      return Promise.resolve({ reply: "with extra", mutations: [] });
    };
    const noted = await sendMessage(withNotes, USER_ID, utcMondayOf(today), "how has volume been", {
      complete: notedComplete,
    });
    expect(noted.ok).toBe(true);
    expect(notedCalls).toHaveLength(2);
    expect(notedCalls[0]?.adminCoachNotes).toBe("Project-wide cue");
    expect(notedCalls[1]?.adminCoachNotes).toBe("Project-wide cue");

    const emptyClient = createMemorySupabase(fixtures);
    const emptyCalls: CompleteRequest[] = [];
    const emptyComplete: ProposeCompleteFn = (request) => {
      emptyCalls.push(request);
      if (emptyCalls.length === 1) {
        return Promise.resolve({
          reply: "need extra",
          mutations: [],
          dataRequest: { from: priorDate, to: addUtcDays(today, 30) },
        });
      }
      return Promise.resolve({ reply: "with extra", mutations: [] });
    };
    const empty = await sendMessage(emptyClient, USER_ID, utcMondayOf(today), "how has volume been", {
      complete: emptyComplete,
    });
    expect(empty.ok).toBe(true);
    expect(emptyCalls).toHaveLength(2);
    expect(emptyCalls[0]?.adminCoachNotes ?? null).toBeNull();
    expect(emptyCalls[1]?.adminCoachNotes ?? null).toBeNull();
  });

  it("does not call complete again when the returned range is invalid", async () => {
    const client = seedSendClient();
    let calls = 0;
    const complete: ProposeCompleteFn = () => {
      calls += 1;
      return Promise.resolve({ reply: "ok", mutations: [], dataRequest: { from: "2026-08-15", to: "2026-08-10" } });
    };
    const result = await sendMessage(client, USER_ID, MONDAY, "what is Tuesday for", { complete });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calls).toBe(1);
    expect(result.data.loadedRange).toBeNull();
  });

  it("fails closed like a first-call LLM failure when the second complete throws", async () => {
    const client = seedSendClient();
    let calls = 0;
    const complete: ProposeCompleteFn = () => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          reply: "first",
          mutations: [{ date: "2026-08-14", distanceKm: 9 }],
          dataRequest: { from: MONDAY, to: addUtcDays(MONDAY, 6) },
        });
      }
      return Promise.reject(new Error("second failed"));
    };
    const result = await sendMessage(client, USER_ID, MONDAY, "make Friday a bit longer", { complete });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calls).toBe(2);
    expect(result.data.loadedRange).toBeNull();
    expect((chatSource.match(/raw = \{ reply: COACH_UNAVAILABLE_REPLY, mutations: \[\] \}/g) ?? []).length).toBe(2);
    expect(result.data.units).toBeUndefined();
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(
      expect.arrayContaining([expect.objectContaining({ date: "2026-08-14", distanceKm: 5 })]),
    );
  });
});

describe("chat threads", () => {
  const OTHER = "member-other";

  it("lists only the caller's threads newest-first and hides another member's threads", async () => {
    const client = createMemorySupabase({
      chat_threads: [
        {
          id: "old-a",
          user_id: USER_ID,
          title: "Old",
          started_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "new-a",
          user_id: USER_ID,
          title: "New",
          started_at: "2026-08-11T00:00:00.000Z",
        },
        {
          id: "b-only",
          user_id: OTHER,
          title: "Secret",
          started_at: "2026-08-12T00:00:00.000Z",
        },
      ],
    });
    expect(await listThreads(client, USER_ID)).toEqual([
      expect.objectContaining({ id: "new-a", title: "New" }),
      expect.objectContaining({ id: "old-a", title: "Old" }),
    ]);
    expect(await listThreads(client, OTHER)).toEqual([expect.objectContaining({ id: "b-only", title: "Secret" })]);
  });

  it("defaults send to the latest thread and stores on an explicit owned thread", async () => {
    const latest = "thread-latest";
    const older = "thread-older";
    const client = seedSendClient();
    await client.from("chat_threads").insert([
      { id: older, user_id: USER_ID, title: "Older", started_at: "2026-08-10T00:00:00.000Z" },
      { id: latest, user_id: USER_ID, title: "Latest", started_at: "2026-08-11T00:00:00.000Z" },
    ]);
    const defaulted = await sendMessage(client, USER_ID, MONDAY, "hello latest", { complete: completeWith([]) });
    expect(defaulted.ok).toBe(true);
    if (!defaulted.ok) {
      return;
    }
    expect(defaulted.data.threadId).toBe(latest);
    const pinned = await sendMessage(client, USER_ID, MONDAY, "hello older", {
      complete: completeWith([]),
      threadId: older,
    });
    expect(pinned.ok).toBe(true);
    if (!pinned.ok) {
      return;
    }
    expect(pinned.data.threadId).toBe(older);
    const latestRows = await client.from("chat_messages").select("*").eq("thread_id", latest);
    const olderRows = await client.from("chat_messages").select("*").eq("thread_id", older);
    expect(latestRows.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "hello latest", thread_id: latest })]),
    );
    expect(olderRows.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "hello older", thread_id: older })]),
    );
    const foreign = await sendMessage(client, USER_ID, MONDAY, "nope", {
      complete: completeWith([]),
      threadId: "missing-thread",
    });
    expect(foreign).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Thread not found." },
    });
  });

  it("sets title from the first 60 characters of the first user message", async () => {
    const client = seedSendClient();
    const created = await createThread(client, USER_ID);
    expect(created.title).toBeNull();
    const long = `${"x".repeat(70)} extra`;
    const result = await sendMessage(client, USER_ID, MONDAY, long, {
      complete: completeWith([]),
      threadId: created.id,
    });
    expect(result.ok).toBe(true);
    const stored = await client.from("chat_threads").select("*").eq("id", created.id).maybeSingle();
    expect(stored.data).toEqual(expect.objectContaining({ title: "x".repeat(60) }));
  });

  it("sends only the active thread's last 12 messages as coach history", async () => {
    const active = "thread-active";
    const other = "thread-other";
    const client = seedSendClient();
    await client.from("chat_threads").insert([
      { id: other, user_id: USER_ID, title: "Other", started_at: "2026-08-10T00:00:00.000Z" },
      { id: active, user_id: USER_ID, title: "Active", started_at: "2026-08-11T00:00:00.000Z" },
    ]);
    const otherMessages = Array.from({ length: 4 }, (_, index) => ({
      id: `other-${index}`,
      user_id: USER_ID,
      thread_id: other,
      week_start: MONDAY,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `other-${index}`,
      created_at: `2026-08-12T12:00:0${index}.000Z`,
    }));
    const activeMessages = Array.from({ length: 14 }, (_, index) => ({
      id: `active-${index}`,
      user_id: USER_ID,
      thread_id: active,
      week_start: "2026-08-17",
      role: index % 2 === 0 ? "user" : "assistant",
      content: `active-${index}`,
      created_at: `2026-08-11T00:00:${String(index).padStart(2, "0")}.000Z`,
    }));
    await client.from("chat_messages").insert([...otherMessages, ...activeMessages]);
    let captured: Parameters<ProposeCompleteFn>[0] | undefined;
    const complete: ProposeCompleteFn = (request) => {
      captured = request;
      return Promise.resolve({ reply: "ok", mutations: [] });
    };
    const result = await sendMessage(client, USER_ID, MONDAY, "continue", { complete, threadId: active });
    expect(result.ok).toBe(true);
    const history = captured?.history ?? [];
    expect(history.some((item) => item.content.startsWith("other-"))).toBe(false);
    expect(history).toHaveLength(12);
    expect(history[0]?.content).toBe("active-3");
    expect(history.at(-1)?.content).toBe("continue");
  });
});

describe("dismissPendingProfileFreeze", () => {
  it("dismisses a pending profile/freeze row without changing the plan", async () => {
    const client = createMemorySupabase({
      chat_profile_freeze_pending: [
        {
          id: "pending-freeze",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: { restWeekdays: ["tue"] },
          freeze_dates: ["2026-08-10"],
          unfreeze_dates: [],
          status: "pending",
        },
      ],
      training_units: CURRENT.map((item) => ({
        user_id: USER_ID,
        date: item.date,
        type: item.type,
        distance_km: item.distanceKm,
        structure: null,
        frozen: false,
      })),
    });
    const before = await listWeek(client, USER_ID, MONDAY);
    const result = await dismissPendingProfileFreeze(client, USER_ID, MONDAY);
    expect(result).toEqual({ ok: true });
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(before);
    expect(await pendingProfileFreezeRows(client)).toEqual([
      expect.objectContaining({ id: "pending-freeze", status: "dismissed" }),
    ]);
  });

  it("dismisses a pending races patch without writing races", async () => {
    const client = createMemorySupabase({
      chat_profile_freeze_pending: [
        {
          id: "pending-races",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: null,
          freeze_dates: [],
          unfreeze_dates: [],
          races_patch: {
            add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
            remove: [],
            patch: [],
          },
          status: "pending",
        },
      ],
    });
    const result = await dismissPendingProfileFreeze(client, USER_ID, MONDAY);
    expect(result).toEqual({ ok: true });
    expect(await listRaces(client, USER_ID)).toEqual([]);
    expect(await pendingProfileFreezeRows(client)).toEqual([
      expect.objectContaining({ id: "pending-races", status: "dismissed" }),
    ]);
  });

  it("loads profile/freeze when races_patch is omitted and races-only pending when freeze is empty", async () => {
    const withoutRaces = createMemorySupabase({
      chat_profile_freeze_pending: [
        {
          id: "pending-no-races-key",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: { restWeekdays: ["tue"] },
          freeze_dates: ["2026-08-10"],
          unfreeze_dates: [],
          status: "pending",
        },
      ],
    });
    const withoutKey = await listChat(withoutRaces, USER_ID, MONDAY);
    expect(withoutKey).not.toHaveProperty("proposition");
    expect(withoutKey.pendingProfileFreeze?.profile?.restWeekdays).toEqual(["tue"]);
    expect(withoutKey.pendingProfileFreeze?.freeze).toEqual(["2026-08-10"]);
    expect(withoutKey.pendingProfileFreeze?.races).toBeUndefined();

    const racesOnly = createMemorySupabase({
      chat_profile_freeze_pending: [
        {
          id: "pending-races-only",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: null,
          freeze_dates: [],
          unfreeze_dates: [],
          races_patch: {
            add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
            remove: [],
            patch: [],
          },
          status: "pending",
        },
      ],
    });
    const onlyRaces = await listChat(racesOnly, USER_ID, MONDAY);
    expect(onlyRaces.pendingProfileFreeze?.races?.add).toEqual([
      { date: "2027-04-12", priority: "A", name: "Spring HM" },
    ]);
    expect(onlyRaces.pendingProfileFreeze?.freeze).toEqual([]);
    expect(onlyRaces.pendingProfileFreeze?.profile).toBeUndefined();
  });
});

describe("reportAssistantGap", () => {
  it("inserts a gap report for the latest assistant reply", async () => {
    const client = createMemorySupabase({
      chat_threads: [{ id: "thread-1", user_id: USER_ID, title: "Gap", started_at: "2026-08-10T00:00:00.000Z" }],
      chat_messages: [
        {
          id: "u-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "Can you adjust Friday?",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "I suggested a longer Friday.",
          created_at: "2026-08-10T00:01:00.000Z",
        },
      ],
    });

    const result = await reportAssistantGap(client, USER_ID, MONDAY, "a-1");
    expect(result).toEqual({ ok: true });
    const reports = await reportRows(client);
    expect(reports).toHaveLength(1);
    const report = reports[0] as {
      source_user_id: string;
      week_start: string;
      kind: string;
      status: string;
      body: string;
    };
    expect(report.source_user_id).toBe(USER_ID);
    expect(report.week_start).toBe(MONDAY);
    expect(report.kind).toBe("gap");
    expect(report.status).toBe("open");
    expect(report.body).toContain("User: Can you adjust Friday?");
    expect(report.body).not.toContain(FLAG_TECHNICAL_MARKER);
  });

  it("rejects unknown, non-assistant, and non-latest ids", async () => {
    const client = createMemorySupabase({
      chat_threads: [{ id: "thread-1", user_id: USER_ID, title: "Gap", started_at: "2026-08-10T00:00:00.000Z" }],
      chat_messages: [
        {
          id: "u-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "Can you adjust Friday?",
          created_at: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "a-1",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "First reply.",
          created_at: "2026-08-10T00:01:00.000Z",
        },
        {
          id: "u-2",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "user",
          content: "What about Sunday?",
          created_at: "2026-08-10T00:02:00.000Z",
        },
        {
          id: "a-2",
          user_id: USER_ID,
          thread_id: "thread-1",
          week_start: MONDAY,
          role: "assistant",
          content: "Latest reply.",
          created_at: "2026-08-10T00:03:00.000Z",
        },
      ],
    });

    await expect(reportAssistantGap(client, USER_ID, MONDAY, "missing")).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Assistant message not found." },
    });
    await expect(reportAssistantGap(client, USER_ID, MONDAY, "u-2")).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Assistant message not found." },
    });
    await expect(reportAssistantGap(client, USER_ID, MONDAY, "a-1")).resolves.toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Assistant message not found." },
    });
    expect(await reportRows(client)).toEqual([]);
  });
});

describe("POST /api/chat/messages applied payload", () => {
  const messagesSource = readFileSync(path.join(import.meta.dirname, "../../pages/api/chat/messages.ts"), "utf8");

  it("returns units, validation, and the revision stack when Send applied", () => {
    expect(messagesSource).toContain("readRevisionStack");
    expect(messagesSource).toContain("units");
    expect(messagesSource).toContain("validation");
    expect(messagesSource).toContain("undoAvailable");
    expect(messagesSource).toContain("revisions");
    expect(messagesSource).toContain("...result.data");
    expect(messagesSource).not.toContain("fetch(");
  });

  it("does not copy Accept 409 hardBounds onto the messages route", () => {
    expect(messagesSource).not.toContain("hardBounds");
    expect(messagesSource).not.toContain("409");
  });
});
