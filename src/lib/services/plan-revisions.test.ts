import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase, type MemoryRow } from "@/lib/test/memory-supabase";
import { weekDates } from "@/lib/dates";
import {
  editUnit,
  generateAndPersist,
  listWeek,
  readLatestRevisionUnits,
  restoreBodySchema,
  restoreWeek,
  snapshotBodySchema,
  snapshotCurrentWeek,
  toTrainingUnitRow,
  undoWeek,
} from "./plan";
import type { TrainingUnit } from "@/types";

const MONDAY = "2026-08-10";
const USER_ID = "member-revisions";
const DATES = weekDates(MONDAY);

function distinctiveWeek(): TrainingUnit[] {
  return DATES.map((date) => ({ date, type: "long", distanceKm: 42, frozen: false }));
}

function unitRows(units: TrainingUnit[]): MemoryRow[] {
  return units.map((unit) => ({ user_id: USER_ID, ...toTrainingUnitRow(unit) }));
}

function seedGenerate(units: TrainingUnit[], extras: { weeklyKm?: number; races?: MemoryRow[] } = {}): SupabaseClient {
  const weeklyKm = extras.weeklyKm;
  const profiles =
    weeklyKm === undefined ? [{ user_id: USER_ID, weekly_km: 50 }] : [{ user_id: USER_ID, weekly_km: weeklyKm }];
  return createMemorySupabase({
    profiles,
    races: extras.races ?? [
      { id: "a-race", user_id: USER_ID, date: "2026-10-04", priority: "A", goal: "sub-3", name: "Berlin" },
    ],
    training_units: unitRows(units),
  });
}

async function revisionCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("plan_revisions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", USER_ID)
    .eq("week_start", MONDAY);
  expect(error).toBeNull();
  return count ?? 0;
}

async function latestRevisionUnits(client: SupabaseClient): Promise<unknown> {
  const { data, error } = await client
    .from("plan_revisions")
    .select("units")
    .eq("user_id", USER_ID)
    .eq("week_start", MONDAY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(error).toBeNull();
  if (data === null || typeof data !== "object" || !("units" in data)) {
    return undefined;
  }
  return data.units;
}

describe("generateAndPersist revision stack", () => {
  it("does not snapshot the pre-generate week", async () => {
    const before = distinctiveWeek();
    const client = seedGenerate(before);

    const result = await generateAndPersist(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    expect(await listWeek(client, USER_ID, MONDAY)).not.toEqual(before);
    expect(await revisionCount(client)).toBe(0);
    expect(await readLatestRevisionUnits(client, USER_ID, MONDAY)).toBeNull();
  });

  it("does not insert a revision on a second generate", async () => {
    const client = seedGenerate(distinctiveWeek());
    const first = await generateAndPersist(client, USER_ID, MONDAY);
    expect(first.ok).toBe(true);
    expect(await revisionCount(client)).toBe(0);

    const second = await generateAndPersist(client, USER_ID, MONDAY);
    expect(second.ok).toBe(true);
    expect(await revisionCount(client)).toBe(0);
  });

  it("inserts no revision when generate fails", async () => {
    const before = distinctiveWeek();
    const missingKm = seedGenerate(before, { weeklyKm: Number.NaN });
    const missing = await generateAndPersist(missingKm, USER_ID, MONDAY);
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("MISSING_WEEKLY_KM");
    }
    expect(await listWeek(missingKm, USER_ID, MONDAY)).toEqual(before);
    expect(await revisionCount(missingKm)).toBe(0);

    const noA = seedGenerate(before, {
      races: [{ id: "b-race", user_id: USER_ID, date: "2026-10-04", priority: "B", name: "Tune-up" }],
    });
    const noAResult = await generateAndPersist(noA, USER_ID, MONDAY);
    expect(noAResult.ok).toBe(false);
    if (!noAResult.ok) {
      expect(noAResult.error.code).toBe("NO_A_RACE");
    }
    expect(await listWeek(noA, USER_ID, MONDAY)).toEqual(before);
    expect(await revisionCount(noA)).toBe(0);
  });

  it("undo after generate from empty has nothing to undo and keeps the generated week", async () => {
    const client = seedGenerate([]);
    const result = await generateAndPersist(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    const generated = await listWeek(client, USER_ID, MONDAY);
    expect(generated.length).toBe(7);

    const undone = await undoWeek(client, USER_ID, MONDAY);
    expect(undone.ok).toBe(false);
    if (!undone.ok) {
      expect(undone.error.code).toBe("NOTHING_TO_UNDO");
    }
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(generated);
  });
});

describe("snapshotCurrentWeek", () => {
  it("inserts the current week units without changing the live week", async () => {
    const before = distinctiveWeek();
    const client = seedGenerate(before);

    const result = await snapshotCurrentWeek(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.weekStart).toBe(MONDAY);
    expect(result.undoAvailable).toBe(true);
    expect(result.revisions.length).toBe(1);
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(before);
    expect(await latestRevisionUnits(client)).toEqual(before);
    expect(await readLatestRevisionUnits(client, USER_ID, MONDAY)).toEqual(before);
  });
});

describe("editUnit revision stack", () => {
  it("does not insert a revision when a unit changes", async () => {
    const client = seedGenerate(typedWeek("base", 8));
    const result = await editUnit(client, USER_ID, { date: MONDAY, type: "tempo", distanceKm: 10 });
    expect(result.ok).toBe(true);
    expect(await revisionCount(client)).toBe(0);
  });
});

function typedWeek(type: TrainingUnit["type"], km: number): TrainingUnit[] {
  return DATES.map((date) => ({ date, type, distanceKm: km, frozen: false }));
}

async function revisionIds(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client
    .from("plan_revisions")
    .select("id")
    .eq("user_id", USER_ID)
    .eq("week_start", MONDAY);
  expect(error).toBeNull();
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((row) => (typeof row.id === "string" ? row.id : "")).filter((id) => id !== "");
}

describe("restoreWeek", () => {
  it("lands a non-latest snapshot and keeps later rows", async () => {
    const older = typedWeek("base", 1);
    const middle = typedWeek("tempo", 2);
    const newer = typedWeek("threshold", 3);
    const live = typedWeek("recovery", 4);
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: 50 }],
      training_units: unitRows(live),
      plan_revisions: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          user_id: USER_ID,
          week_start: MONDAY,
          units: older,
          created_at: "2020-08-10T10:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          user_id: USER_ID,
          week_start: MONDAY,
          units: middle,
          created_at: "2020-08-10T11:00:00.000Z",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          user_id: USER_ID,
          week_start: MONDAY,
          units: newer,
          created_at: "2020-08-10T12:00:00.000Z",
        },
      ],
    });

    const result = await restoreWeek(client, USER_ID, MONDAY, "22222222-2222-4222-8222-222222222222");
    expect(result.ok).toBe(true);
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(middle);
    const ids = await revisionIds(client);
    expect(ids).toEqual(
      expect.arrayContaining([
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ]),
    );
    expect(ids.length).toBe(4);
    expect(await latestRevisionUnits(client)).toEqual(live);
  });

  it("returns NOT_FOUND for another week or unknown id", async () => {
    const client = createMemorySupabase({
      training_units: unitRows(distinctiveWeek()),
      plan_revisions: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          user_id: USER_ID,
          week_start: "2026-08-17",
          units: typedWeek("base", 8),
          created_at: "2026-08-17T10:00:00.000Z",
        },
      ],
    });
    const before = await listWeek(client, USER_ID, MONDAY);
    const wrongWeek = await restoreWeek(client, USER_ID, MONDAY, "44444444-4444-4444-8444-444444444444");
    expect(wrongWeek.ok).toBe(false);
    if (!wrongWeek.ok) {
      expect(wrongWeek.error.code).toBe("NOT_FOUND");
    }
    const missing = await restoreWeek(client, USER_ID, MONDAY, "55555555-5555-4555-8555-555555555555");
    expect(missing.ok).toBe(false);
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(before);
  });
});

describe("revision cap", () => {
  it("trims the oldest snapshot when an 11th is inserted", async () => {
    const oldestId = "00000000-0000-4000-8000-000000000000";
    const seeded = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? oldestId : `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      user_id: USER_ID,
      week_start: MONDAY,
      units: typedWeek("base", index),
      created_at: `2020-01-01T${String(index).padStart(2, "0")}:00:00.000Z`,
    }));
    const client = seedGenerate(distinctiveWeek());
    for (const row of seeded) {
      const inserted = await client.from("plan_revisions").insert(row);
      expect(inserted.error).toBeNull();
    }
    expect(await revisionCount(client)).toBe(10);

    const result = await snapshotCurrentWeek(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    expect(await revisionCount(client)).toBe(10);
    const ids = await revisionIds(client);
    expect(ids).not.toContain(oldestId);
  });
});

describe("restoreBodySchema", () => {
  it("requires a uuid revisionId", () => {
    expect(restoreBodySchema.safeParse({ revisionId: "not-a-uuid" }).success).toBe(false);
    expect(restoreBodySchema.safeParse({ revisionId: "22222222-2222-4222-8222-222222222222" }).success).toBe(true);
  });
});

describe("snapshotBodySchema", () => {
  it("accepts an optional ISO weekStart", () => {
    expect(snapshotBodySchema.safeParse({}).success).toBe(true);
    expect(snapshotBodySchema.safeParse({ weekStart: "2026-08-10" }).success).toBe(true);
    expect(snapshotBodySchema.safeParse({ weekStart: "10-08-2026" }).success).toBe(false);
  });
});
