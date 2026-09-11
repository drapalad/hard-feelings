import { describe, expect, it } from "vitest";
import { addUtcDays } from "@/lib/dates";
import { applyMutations, gateAccept, gateByIsoWeek } from "./plan-adaptation";
import type { TrainingUnit } from "@/types";

const WEEKLY_KM = 50;

function unit(partial: Partial<TrainingUnit> & Pick<TrainingUnit, "date">): TrainingUnit {
  return {
    type: "base",
    distanceKm: 7,
    frozen: false,
    ...partial,
  };
}

const week: TrainingUnit[] = [
  unit({ date: "2026-08-10", type: "base", distanceKm: 7 }),
  unit({ date: "2026-08-11", type: "tempo", distanceKm: 7, structure: "3x2k" }),
  unit({ date: "2026-08-12", type: "recovery", distanceKm: 7 }),
  unit({ date: "2026-08-13", type: "threshold", distanceKm: 7 }),
  unit({ date: "2026-08-14", type: "base", distanceKm: 7 }),
  unit({ date: "2026-08-15", type: "long", distanceKm: 7 }),
  unit({ date: "2026-08-16", type: "recovery", distanceKm: 7 }),
];

describe("applyMutations", () => {
  it("copies unspecified days, changes one type, and keeps frozen from the existing unit", () => {
    const frozen = unit({ date: "2026-08-13", type: "threshold", distanceKm: 7, frozen: true });
    const current = week.map((item) => (item.date === frozen.date ? frozen : item));

    const plan = applyMutations(current, [{ date: "2026-08-12", type: "tempo" }]);

    expect(plan.units).toHaveLength(7);
    expect(plan.units.find((item) => item.date === "2026-08-12")).toEqual({
      date: "2026-08-12",
      type: "tempo",
      distanceKm: 7,
      frozen: false,
    });
    expect(plan.units.find((item) => item.date === "2026-08-11")).toEqual(current[1]);
    expect(plan.units.find((item) => item.date === "2026-08-13")?.frozen).toBe(true);
    expect(plan.units.find((item) => item.date === "2026-08-13")?.type).toBe("threshold");
  });

  it("inserts a new unfrozen unit when type and distanceKm are set", () => {
    const plan = applyMutations(week, [{ date: "2026-08-17", type: "long", distanceKm: 16, structure: "90 min" }]);
    expect(plan.units.find((item) => item.date === "2026-08-17")).toEqual({
      date: "2026-08-17",
      type: "long",
      distanceKm: 16,
      frozen: false,
      structure: "90 min",
    });
    expect(plan.units).toHaveLength(8);
  });

  it("skips incomplete creates and frozen existing dates", () => {
    const incomplete = applyMutations(week, [{ date: "2026-08-17", type: "long" }]);
    expect(incomplete.units).toEqual([...week].sort((a, b) => a.date.localeCompare(b.date)));

    const frozen = unit({ date: "2026-08-13", type: "threshold", distanceKm: 7, frozen: true });
    const withFrozen = week.map((item) => (item.date === frozen.date ? frozen : item));
    const skipped = applyMutations(withFrozen, [{ date: "2026-08-13", type: "base", distanceKm: 5 }]);
    expect(skipped.units.find((item) => item.date === "2026-08-13")).toEqual(frozen);
  });

  it("preserves existing stages when the mutation omits them and does not add a key when absent", () => {
    const stages = [{ kind: "warmup" as const, label: "WU", duration: "2 km", target: "" }];
    const withStages = week.map((item) => (item.date === "2026-08-11" ? { ...item, stages } : item));
    const preserved = applyMutations(withStages, [{ date: "2026-08-11", type: "threshold" }]);
    expect(preserved.units.find((item) => item.date === "2026-08-11")?.stages).toEqual(stages);
    expect(preserved.units.find((item) => item.date === "2026-08-12")).toEqual({
      date: "2026-08-12",
      type: "recovery",
      distanceKm: 7,
      frozen: false,
    });
    expect(preserved.units.find((item) => item.date === "2026-08-12")).not.toHaveProperty("stages");

    const cleared = applyMutations(withStages, [{ date: "2026-08-11", stages: [] }], { skipFrozen: false });
    expect(cleared.units.find((item) => item.date === "2026-08-11")?.stages).toBeUndefined();
  });

  it("deletes a date instead of upserting recovery or 0 km and skips frozen by default", () => {
    const plan = applyMutations(week, [{ date: "2026-08-12", delete: true }]);
    expect(plan.units.find((item) => item.date === "2026-08-12")).toBeUndefined();
    expect(plan.units).toHaveLength(6);
    expect(plan.units.some((item) => item.date === "2026-08-12" && item.distanceKm === 0)).toBe(false);

    const frozen = unit({ date: "2026-08-13", type: "threshold", distanceKm: 7, frozen: true });
    const withFrozen = week.map((item) => (item.date === frozen.date ? frozen : item));
    const skipped = applyMutations(withFrozen, [{ date: "2026-08-13", delete: true }]);
    expect(skipped.units.find((item) => item.date === "2026-08-13")).toEqual(frozen);

    const forced = applyMutations(withFrozen, [{ date: "2026-08-13", delete: true }], { skipFrozen: false });
    expect(forced.units.find((item) => item.date === "2026-08-13")).toBeUndefined();

    const missing = applyMutations(week, [{ date: "2026-08-20", delete: true }]);
    expect(missing.units).toEqual([...week].sort((a, b) => a.date.localeCompare(b.date)));
  });
});

describe("gateAccept", () => {
  it("returns ok true with soft WEEKLY_VOLUME_EXCEEDED when over weekly km but at or under 120%", () => {
    const plan = applyMutations(week, [{ date: "2026-08-14", distanceKm: 12.1 }]);
    const result = gateAccept(plan, WEEKLY_KM, []);

    expect(result.ok).toBe(true);
    expect(result.validation.hard).toEqual([]);
    expect(result.validation.soft).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft" }),
    ]);
  });

  it("returns ok false when volume exceeds 120%, consecutive longs, or a frozen unit is mutated", () => {
    const over = applyMutations(week, [{ date: "2026-08-14", distanceKm: 200 }]);
    expect(gateAccept(over, WEEKLY_KM, []).ok).toBe(false);
    expect(gateAccept(over, WEEKLY_KM, []).validation.hard).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "hard" }),
    ]);

    const longs = applyMutations(
      week.map((item) => (item.date === "2026-08-11" ? { ...item, type: "long" as const } : item)),
      [{ date: "2026-08-12", type: "long" }],
    );
    expect(gateAccept(longs, WEEKLY_KM, []).ok).toBe(false);
    expect(gateAccept(longs, WEEKLY_KM, []).validation.hard).toEqual([
      expect.objectContaining({ code: "CONSECUTIVE_LONGS", severity: "hard" }),
    ]);

    const frozen = unit({ date: "2026-08-13", type: "threshold", distanceKm: 7, frozen: true });
    const droppedAnchor = week.map((item) =>
      item.date === frozen.date ? { ...item, type: "base" as const, frozen: false } : item,
    );
    const freezeResult = gateAccept({ units: droppedAnchor }, WEEKLY_KM, [frozen]);
    expect(freezeResult.ok).toBe(false);
    expect(freezeResult.validation.hard).toEqual([
      expect.objectContaining({ code: "FROZEN_ANCHOR_DROPPED", severity: "hard" }),
    ]);
  });

  it("scores each ISO week separately so a 14-day set is not one volume blob", () => {
    const week2 = week.map((item) => ({ ...item, date: addUtcDays(item.date, 7) }));
    const fortnight = [...week, ...week2];
    expect(gateAccept({ units: fortnight }, WEEKLY_KM, []).ok).toBe(false);
    expect(gateByIsoWeek(fortnight, WEEKLY_KM, []).ok).toBe(true);
  });
});
