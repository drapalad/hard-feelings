import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createMemorySupabase, type MemoryRow } from "@/lib/test/memory-supabase";
import { acceptProposition } from "./chat";
import { listWeek } from "./plan";
import { listRaces } from "./races";
import type { TrainingUnit } from "@/types";

const MONDAY = "2026-08-10";
const USER_ID = "member-accept";
const WEEKLY_KM = 50;
const DATES = ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16"];

function weekWithDistances(kms: number[]): TrainingUnit[] {
  return DATES.map((date, index) => ({
    date,
    type: "base",
    distanceKm: kms[index] ?? 0,
    frozen: false,
  }));
}

const CURRENT = weekWithDistances([5, 5, 5, 5, 5, 5, 5]);

function trainingRows(units: TrainingUnit[]): MemoryRow[] {
  return units.map((unit) => ({
    user_id: USER_ID,
    date: unit.date,
    type: unit.type,
    distance_km: unit.distanceKm,
    structure: null,
    frozen: unit.frozen,
  }));
}

describe("risk #2 Accept hard bounds: acceptProposition profile/freeze fallback", () => {
  it("accepts pending profile/freeze changes", async () => {
    const client = createMemorySupabase({
      profiles: [
        {
          user_id: USER_ID,
          weekly_km: WEEKLY_KM,
          long_weekdays: ["sat"],
          rest_weekdays: [],
          mix_easy: 70,
          mix_threshold: 20,
          mix_speed: 10,
        },
      ],
      training_units: trainingRows(CURRENT),
      chat_profile_freeze_pending: [
        {
          id: "pending-profile-freeze",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: { restWeekdays: ["tue"] },
          freeze_dates: ["2026-08-10"],
          unfreeze_dates: [],
          status: "pending",
        },
      ],
    });

    const result = await acceptProposition(client, USER_ID, MONDAY);

    expect(result.ok).toBe(true);
    expect((await listWeek(client, USER_ID, MONDAY)).find((unit) => unit.date === "2026-08-10")?.frozen).toBe(true);
    const profile = await client.from("profiles").select("*").eq("user_id", USER_ID).maybeSingle();
    expect(profile.data).toEqual(expect.objectContaining({ rest_weekdays: ["tue"] }));
    const pending = await client
      .from("chat_profile_freeze_pending")
      .select("*")
      .eq("id", "pending-profile-freeze")
      .maybeSingle();
    expect(pending.data).toEqual(expect.objectContaining({ status: "accepted" }));
  });

  it("returns NO_PENDING_PROFILE_FREEZE when no profile/freeze row exists", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: trainingRows(CURRENT),
    });

    const result = await acceptProposition(client, USER_ID, MONDAY);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("NO_PENDING_PROFILE_FREEZE");
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(CURRENT);
  });

  it("accepts pending calendar creates outside the create window", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      training_units: trainingRows(CURRENT),
      chat_profile_freeze_pending: [
        {
          id: "pending-creates",
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: null,
          freeze_dates: [],
          unfreeze_dates: [],
          calendar_creates: [{ date: "2026-09-28", type: "base", distanceKm: 8 }],
          status: "pending",
        },
      ],
    });
    const result = await acceptProposition(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect((await listWeek(client, USER_ID, "2026-09-28")).find((unit) => unit.date === "2026-09-28")).toEqual(
      expect.objectContaining({ date: "2026-09-28", type: "base", distanceKm: 8, frozen: false }),
    );
    expect(await listWeek(client, USER_ID, MONDAY)).toEqual(CURRENT);
    expect(result.units.filter((unit) => unit.date >= MONDAY && unit.date <= "2026-08-16")).toEqual(CURRENT);
    expect(result.units.find((unit) => unit.date === "2026-09-28")).toEqual(
      expect.objectContaining({ date: "2026-09-28", type: "base", distanceKm: 8, frozen: false }),
    );
  });
});

describe("risk #2 Accept hard bounds: acceptProposition races patch", () => {
  const PENDING_ID = "pending-races";

  function seedRacesPending(input: {
    races?: MemoryRow[];
    racesPatch: {
      add: { date: string; priority: "A" | "B" | "C" | "D"; name?: string; goal?: string }[];
      remove: { id: string }[];
      patch: { id: string; date?: string; priority?: "A" | "B" | "C" | "D"; name?: string; goal?: string }[];
    };
  }): SupabaseClient {
    return createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: WEEKLY_KM }],
      races: input.races ?? [],
      chat_profile_freeze_pending: [
        {
          id: PENDING_ID,
          user_id: USER_ID,
          week_start: MONDAY,
          profile_patch: null,
          freeze_dates: [],
          unfreeze_dates: [],
          races_patch: input.racesPatch,
          status: "pending",
        },
      ],
    });
  }

  async function pendingStatus(client: SupabaseClient): Promise<unknown> {
    const { data, error } = await client
      .from("chat_profile_freeze_pending")
      .select("status")
      .eq("id", PENDING_ID)
      .eq("user_id", USER_ID)
      .maybeSingle();
    expect(error).toBeNull();
    if (typeof data !== "object" || data === null || !("status" in data)) {
      return undefined;
    }
    return data.status;
  }

  it("inserts a pending add and marks the row accepted", async () => {
    const client = seedRacesPending({
      racesPatch: {
        add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
        remove: [],
        patch: [],
      },
    });
    const result = await acceptProposition(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    expect(await listRaces(client, USER_ID)).toEqual([
      expect.objectContaining({ date: "2027-04-12", priority: "A", name: "Spring HM" }),
    ]);
    expect(await pendingStatus(client)).toBe("accepted");
  });

  it("refuses a second A without writing races or accepting", async () => {
    const client = seedRacesPending({
      races: [{ id: "existing-a", user_id: USER_ID, date: "2026-10-04", priority: "A", name: "Berlin" }],
      racesPatch: {
        add: [{ date: "2027-04-12", priority: "A", name: "Spring HM" }],
        remove: [],
        patch: [],
      },
    });
    const before = await listRaces(client, USER_ID);
    const result = await acceptProposition(client, USER_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("SECOND_A_RACE");
    expect(await listRaces(client, USER_ID)).toEqual(before);
    expect(await pendingStatus(client)).toBe("pending");
  });

  it("refuses a duplicate date without writing races or accepting", async () => {
    const client = seedRacesPending({
      races: [{ id: "existing-b", user_id: USER_ID, date: "2027-04-12", priority: "B", name: "Tune-up" }],
      racesPatch: {
        add: [{ date: "2027-04-12", priority: "C", name: "Spring HM" }],
        remove: [],
        patch: [],
      },
    });
    const before = await listRaces(client, USER_ID);
    const result = await acceptProposition(client, USER_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("DUPLICATE_RACE_DATE");
    expect(await listRaces(client, USER_ID)).toEqual(before);
    expect(await pendingStatus(client)).toBe("pending");
  });

  it("returns NOT_FOUND for an unknown remove id before writing races", async () => {
    const client = seedRacesPending({
      races: [{ id: "existing-b", user_id: USER_ID, date: "2027-04-12", priority: "B", name: "Tune-up" }],
      racesPatch: {
        add: [],
        remove: [{ id: "missing-race" }],
        patch: [],
      },
    });
    const before = await listRaces(client, USER_ID);
    const result = await acceptProposition(client, USER_ID, MONDAY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("NOT_FOUND");
    expect(await listRaces(client, USER_ID)).toEqual(before);
    expect(await pendingStatus(client)).toBe("pending");
  });
});
