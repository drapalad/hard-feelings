import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase, type MemoryRow } from "@/lib/test/memory-supabase";
import { editUnit, listRevisions, listWeek, restoreWeek, setFrozen } from "./plan";
import { deleteLog, listLogs, upsertLog } from "./workout-log";

const MONDAY = "2026-08-10";
const TUESDAY = "2026-08-11";
const WEDNESDAY = "2026-08-12";
const USER_A = "member-a";
const USER_B = "member-b";

const A_MONDAY = {
  user_id: USER_A,
  date: MONDAY,
  type: "long",
  distance_km: 42,
  structure: "member-a-monday",
  frozen: false,
};

const B_MONDAY = {
  user_id: USER_B,
  date: MONDAY,
  type: "base",
  distance_km: 5,
  structure: null,
  frozen: false,
};

const A_TUESDAY = {
  user_id: USER_A,
  date: TUESDAY,
  type: "tempo",
  distance_km: 10,
  structure: null,
  frozen: false,
};

const A_MONDAY_LOG = {
  user_id: USER_A,
  date: MONDAY,
  type: "long",
  distance_km: 42,
};

const A_WEDNESDAY_LOG = {
  user_id: USER_A,
  date: WEDNESDAY,
  type: "recovery",
  distance_km: 7,
};

function twoUserClient(): SupabaseClient {
  return createMemorySupabase({
    training_units: [A_MONDAY, A_TUESDAY, B_MONDAY],
    workout_logs: [A_MONDAY_LOG, A_WEDNESDAY_LOG],
  });
}

function asRows(data: unknown): MemoryRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter((row): row is MemoryRow => typeof row === "object" && row !== null);
}

async function ownerSnapshot(
  client: SupabaseClient,
  table: "training_units" | "workout_logs",
  userId: string,
): Promise<MemoryRow[]> {
  const { data, error } = await client.from(table).select("*");
  expect(error).toBeNull();
  return asRows(data)
    .filter((row) => row.user_id === userId)
    .map((row) => structuredClone(row))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

function isADistinctive(item: { type: string; distanceKm: number }): boolean {
  return item.type === "long" && item.distanceKm === 42;
}

describe("risk #1 ownership: two-user plan and log isolation", () => {
  it("does not return A's distinctive km/type when listing as B", async () => {
    const client = twoUserClient();
    const week = await listWeek(client, USER_B, MONDAY);
    const logs = await listLogs(client, USER_B, MONDAY);

    expect(week.some(isADistinctive)).toBe(false);
    expect(logs.some(isADistinctive)).toBe(false);
    expect(week).toEqual([expect.objectContaining({ date: MONDAY, type: "base", distanceKm: 5 })]);
    expect(logs).toEqual([]);
  });

  it("leaves A's stored units and logs unchanged after B writes", async () => {
    const client = twoUserClient();
    const unitsBefore = await ownerSnapshot(client, "training_units", USER_A);
    const logsBefore = await ownerSnapshot(client, "workout_logs", USER_A);

    await setFrozen(client, USER_B, TUESDAY, true);
    await editUnit(client, USER_B, { date: MONDAY, type: "threshold", distanceKm: 9 });
    const bWeek = await listWeek(client, USER_B, MONDAY);
    await upsertLog(client, USER_B, bWeek, { date: MONDAY });
    await deleteLog(client, USER_B, WEDNESDAY);

    expect(await ownerSnapshot(client, "training_units", USER_A)).toEqual(unitsBefore);
    expect(await ownerSnapshot(client, "workout_logs", USER_A)).toEqual(logsBefore);
    expect(unitsBefore).toEqual([
      expect.objectContaining({
        user_id: USER_A,
        date: MONDAY,
        type: "long",
        distance_km: 42,
        structure: "member-a-monday",
        frozen: false,
      }),
      expect.objectContaining({ user_id: USER_A, date: TUESDAY, type: "tempo", frozen: false }),
    ]);
    expect(logsBefore).toEqual([
      expect.objectContaining({ user_id: USER_A, date: MONDAY, type: "long", distance_km: 42 }),
      expect.objectContaining({ user_id: USER_A, date: WEDNESDAY, type: "recovery", distance_km: 7 }),
    ]);
  });

  it("does not let B restore or list A's revisions", async () => {
    const aRevisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const client = createMemorySupabase({
      training_units: [A_MONDAY, A_TUESDAY, B_MONDAY],
      plan_revisions: [
        {
          id: aRevisionId,
          user_id: USER_A,
          week_start: MONDAY,
          units: [{ date: MONDAY, type: "long", distanceKm: 42, frozen: false }],
          created_at: "2026-08-10T10:00:00.000Z",
        },
      ],
    });
    const unitsBefore = await ownerSnapshot(client, "training_units", USER_A);

    const restored = await restoreWeek(client, USER_B, MONDAY, aRevisionId);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe("NOT_FOUND");
    }
    expect(await listRevisions(client, USER_B, MONDAY)).toEqual([]);
    expect(await ownerSnapshot(client, "training_units", USER_A)).toEqual(unitsBefore);
  });
});
