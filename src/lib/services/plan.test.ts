import { describe, expect, it } from "vitest";
import { generatePlan } from "./generate-plan";
import { createMemorySupabase } from "@/lib/test/memory-supabase";
import {
  applyUnitEdit,
  buildGenerateInput,
  deleteUnit,
  listWeek,
  resolveWeekStart,
  toTrainingUnit,
  toTrainingUnitRow,
  unitEditSchema,
} from "./plan";
import type { Race, TrainingUnit } from "@/types";

const WEEK_START = "2026-08-10";

function namedARace(): Race {
  return {
    id: "keep-out",
    date: "2026-10-04",
    priority: "A",
    goal: "sub-3",
    name: "Berlin Marathon",
  };
}

function frozenTempo(): TrainingUnit {
  return {
    date: "2026-08-13",
    type: "tempo",
    distanceKm: 12,
    structure: "3x2k",
    frozen: true,
  };
}

describe("toTrainingUnit / toTrainingUnitRow", () => {
  it("round-trips a unit with structure and frozen true", () => {
    const unit = frozenTempo();
    const row = toTrainingUnitRow(unit);
    expect(row).toEqual({
      date: "2026-08-13",
      type: "tempo",
      distance_km: 12,
      structure: "3x2k",
      stages: null,
      frozen: true,
    });
    expect(toTrainingUnit(row)).toEqual(unit);
  });

  it("omits structure when null or empty", () => {
    expect(toTrainingUnit({ ...toTrainingUnitRow(frozenTempo()), structure: null })?.structure).toBeUndefined();
    expect(toTrainingUnit({ ...toTrainingUnitRow(frozenTempo()), structure: "" })?.structure).toBeUndefined();
  });

  it("round-trips stages and treats invalid jsonb as absent", () => {
    const withStages: TrainingUnit = {
      ...frozenTempo(),
      stages: [
        { kind: "warmup", label: "WU", duration: "2 km", target: "" },
        { kind: "work", label: "", duration: "5 km", target: "4:20" },
      ],
    };
    const row = toTrainingUnitRow(withStages);
    expect(row.stages).toEqual(withStages.stages);
    expect(toTrainingUnit(row)).toEqual(withStages);
    expect(toTrainingUnit({ ...row, stages: [{ kind: "easy" }] as never })?.stages).toBeUndefined();
  });
});

describe("buildGenerateInput", () => {
  it("maps races with toRaceInput so id and name never enter generate", () => {
    const input = buildGenerateInput({
      weeklyKm: 50,
      races: [namedARace()],
      frozenUnits: [],
      weekStart: WEEK_START,
    });

    expect(input.races).toEqual([{ date: "2026-10-04", priority: "A", goal: "sub-3" }]);
    expect(input.races[0]).not.toHaveProperty("id");
    expect(input.races[0]).not.toHaveProperty("name");
  });

  it("returns MISSING_WEEKLY_KM when weeklyKm is null and NO_A_RACE when no A race", () => {
    const missingKm = generatePlan(
      buildGenerateInput({
        weeklyKm: null,
        races: [namedARace()],
        frozenUnits: [],
        weekStart: WEEK_START,
      }),
    );
    expect(missingKm.ok).toBe(false);
    if (!missingKm.ok) {
      expect(missingKm.error.code).toBe("MISSING_WEEKLY_KM");
    }

    const noA = generatePlan(
      buildGenerateInput({
        weeklyKm: 50,
        races: [{ id: "b", date: "2026-10-04", priority: "B", name: "Tune-up" }],
        frozenUnits: [],
        weekStart: WEEK_START,
      }),
    );
    expect(noA.ok).toBe(false);
    if (!noA.ok) {
      expect(noA.error.code).toBe("NO_A_RACE");
    }
  });
});

describe("resolveWeekStart", () => {
  it("normalizes a Thursday to that week's Monday and rejects non-ISO dates", () => {
    expect(resolveWeekStart("2026-08-13")).toEqual({ ok: true, weekStart: "2026-08-10" });
    expect(resolveWeekStart("2026-08-16")).toEqual({ ok: true, weekStart: "2026-08-10" });
    expect(resolveWeekStart("13-08-2026").ok).toBe(false);
    expect(resolveWeekStart("").ok).toBe(false);
  });
});

function weekWithFrozenTempo(): TrainingUnit[] {
  return [{ date: "2026-08-10", type: "base", distanceKm: 8, frozen: false }, frozenTempo()];
}

describe("applyUnitEdit", () => {
  it("returns NOT_FOUND for an unknown date", () => {
    expect(applyUnitEdit(weekWithFrozenTempo(), "2026-08-11", { type: "long", distanceKm: 20 })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("changes type and km on a known date and keeps frozen", () => {
    const result = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", { type: "threshold", distanceKm: 10 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.changed).toBe(true);
    const edited = result.units.find((unit) => unit.date === "2026-08-13");
    expect(edited).toEqual({
      date: "2026-08-13",
      type: "threshold",
      distanceKm: 10,
      structure: "3x2k",
      frozen: true,
    });
  });

  it("clears structure when patch is empty string or null, and keeps it when omitted", () => {
    const clearedEmpty = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", {
      type: "tempo",
      distanceKm: 12,
      structure: "",
    });
    expect(clearedEmpty.ok).toBe(true);
    if (clearedEmpty.ok) {
      expect(clearedEmpty.changed).toBe(true);
      expect(clearedEmpty.units.find((unit) => unit.date === "2026-08-13")?.structure).toBeUndefined();
    }

    const clearedNull = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", {
      type: "tempo",
      distanceKm: 12,
      structure: null,
    });
    expect(clearedNull.ok).toBe(true);
    if (clearedNull.ok) {
      expect(clearedNull.units.find((unit) => unit.date === "2026-08-13")?.structure).toBeUndefined();
    }

    const kept = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", { type: "tempo", distanceKm: 12 });
    expect(kept.ok).toBe(true);
    if (kept.ok) {
      expect(kept.changed).toBe(false);
      expect(kept.units.find((unit) => unit.date === "2026-08-13")?.structure).toBe("3x2k");
    }
  });

  it("sets, preserves, and clears stages", () => {
    const stages = [{ kind: "warmup" as const, label: "WU", duration: "2 km", target: "" }];
    const seeded = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", {
      type: "tempo",
      distanceKm: 12,
      structure: "3x2k",
      stages,
    });
    expect(seeded.ok).toBe(true);
    if (!seeded.ok) {
      return;
    }
    expect(seeded.changed).toBe(true);
    expect(seeded.units.find((unit) => unit.date === "2026-08-13")?.stages).toEqual(stages);

    const preserved = applyUnitEdit(seeded.units, "2026-08-13", { type: "tempo", distanceKm: 12, structure: "3x2k" });
    expect(preserved.ok).toBe(true);
    if (preserved.ok) {
      expect(preserved.changed).toBe(false);
      expect(preserved.units.find((unit) => unit.date === "2026-08-13")?.stages).toEqual(stages);
    }

    const cleared = applyUnitEdit(seeded.units, "2026-08-13", {
      type: "tempo",
      distanceKm: 12,
      structure: "3x2k",
      stages: [],
    });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.units.find((unit) => unit.date === "2026-08-13")?.stages).toBeUndefined();
    }
  });

  it("returns changed false when type, km, and structure are unchanged", () => {
    const result = applyUnitEdit(weekWithFrozenTempo(), "2026-08-13", {
      type: "tempo",
      distanceKm: 12,
      structure: "3x2k",
    });
    expect(result).toEqual({ ok: true, units: weekWithFrozenTempo(), changed: false });
  });
});

describe("unitEditSchema", () => {
  it("rejects negative km and unknown types", () => {
    expect(unitEditSchema.safeParse({ date: "2026-08-13", type: "tempo", distanceKm: -1 }).success).toBe(false);
    expect(unitEditSchema.safeParse({ date: "2026-08-13", type: "easy", distanceKm: 8 }).success).toBe(false);
    expect(unitEditSchema.safeParse({ date: "2026-08-13", type: "tempo", distanceKm: 8 }).success).toBe(true);
    expect(
      unitEditSchema.safeParse({
        date: "2026-08-13",
        type: "tempo",
        distanceKm: 8,
        stages: [{ kind: "warmup", label: "WU", duration: "2 km", target: "" }],
      }).success,
    ).toBe(true);
    expect(
      unitEditSchema.safeParse({
        date: "2026-08-13",
        type: "tempo",
        distanceKm: 8,
        stages: [{ kind: "easy", label: "WU", duration: "2 km", target: "" }],
      }).success,
    ).toBe(false);
  });
});

describe("deleteUnit", () => {
  const USER_ID = "member-delete-unit";
  const OTHER = "member-other-delete";
  const MONDAY = "2026-08-10";
  const TUESDAY = "2026-08-11";

  it("DELETEs the leftover date and leaves other week days and other members", async () => {
    const client = createMemorySupabase({
      profiles: [{ user_id: USER_ID, weekly_km: 50 }],
      training_units: [
        {
          user_id: USER_ID,
          date: MONDAY,
          type: "tempo",
          distance_km: 10,
          structure: "2x3k",
          frozen: false,
        },
        {
          user_id: USER_ID,
          date: TUESDAY,
          type: "base",
          distance_km: 8,
          structure: null,
          frozen: false,
        },
        {
          user_id: OTHER,
          date: MONDAY,
          type: "long",
          distance_km: 42,
          structure: "victim",
          frozen: false,
        },
      ],
    });

    const missing = await deleteUnit(client, USER_ID, "2026-08-12");
    expect(missing).toEqual({ ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } });

    const result = await deleteUnit(client, USER_ID, MONDAY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.changed).toBe(true);
    expect(result.units.find((unit) => unit.date === MONDAY)).toBeUndefined();
    expect(result.units.find((unit) => unit.date === TUESDAY)).toEqual(
      expect.objectContaining({ date: TUESDAY, type: "base", distanceKm: 8 }),
    );
    expect(result.units.some((unit) => unit.distanceKm === 0)).toBe(false);

    const week = await listWeek(client, USER_ID, MONDAY);
    expect(week.find((unit) => unit.date === MONDAY)).toBeUndefined();
    expect(week.find((unit) => unit.date === TUESDAY)?.type).toBe("base");
    expect(week.some((unit) => unit.distanceKm === 0)).toBe(false);

    const other = await listWeek(client, OTHER, MONDAY);
    expect(other).toEqual([expect.objectContaining({ date: MONDAY, type: "long", distanceKm: 42 })]);
  });
});
