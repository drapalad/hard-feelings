import { describe, expect, it } from "vitest";
import { durationToWeight, formatStructureFromStages, parseWorkoutStages } from "./workout-stages";

describe("parseWorkoutStages", () => {
  it("splits the notes example into warmup, work, and cooldown", () => {
    const stages = parseWorkoutStages({
      structure: "10 km: 2 km warm-up, 6 × 800 m @ 3:40, 2 km cool-down",
      distanceKm: 10,
      type: "anaerobic",
    });
    expect(stages.map((stage) => stage.kind)).toEqual(["warmup", "work", "cooldown"]);
    expect(stages[0]?.weight).toBe(2);
    expect(stages[1]?.weight).toBeCloseTo(4.8);
    expect(stages[2]?.weight).toBe(2);
    expect(stages[1]?.label).toContain("800 m");
  });

  it("returns one stage for an easy unstructured run", () => {
    const stages = parseWorkoutStages({
      structure: "Easy 8 km",
      distanceKm: 8,
      type: "base",
    });
    expect(stages).toHaveLength(1);
    expect(stages[0]?.kind).toBe("work");
    expect(stages[0]?.weight).toBe(8);
  });

  it("does not throw on missing or blank structure", () => {
    const missing = parseWorkoutStages({ distanceKm: 8, type: "base" });
    const blank = parseWorkoutStages({ structure: "   ", distanceKm: 8, type: "base" });
    expect(missing).toEqual([{ kind: "work", label: "8 km base", weight: 8 }]);
    expect(blank).toEqual([{ kind: "work", label: "8 km base", weight: 8 }]);
  });

  it("treats compact intervals as one work stage", () => {
    const compact = parseWorkoutStages({
      structure: "6x1k",
      distanceKm: 6,
      type: "threshold",
    });
    const spaced = parseWorkoutStages({
      structure: "6 x 1 km",
      distanceKm: 6,
      type: "threshold",
    });
    expect(compact).toHaveLength(1);
    expect(compact[0]?.kind).toBe("work");
    expect(compact[0]?.weight).toBe(6);
    expect(spaced).toHaveLength(1);
    expect(spaced[0]?.weight).toBe(6);
  });

  it("uses persisted kind even when the label is easy jog", () => {
    const stages = parseWorkoutStages({
      structure: "Easy 8 km",
      stages: [{ kind: "warmup", label: "easy jog", duration: "2 km", target: "" }],
      distanceKm: 8,
      type: "base",
    });
    expect(stages).toEqual([{ kind: "warmup", label: "easy jog", weight: 2 }]);
  });

  it("maps duration strings to bar weights", () => {
    expect(durationToWeight("2 km")).toBe(2);
    expect(durationToWeight("10 min")).toBe(2);
    expect(durationToWeight("")).toBe(1);
  });

  it("formats a derived structure one-liner from stages", () => {
    expect(
      formatStructureFromStages([
        { kind: "warmup", label: "WU", duration: "2 km", target: "" },
        { kind: "work", label: "", duration: "5 km", target: "4:20" },
        { kind: "cooldown", label: "CD", duration: "2 km", target: "" },
      ]),
    ).toBe("2 km WU, 5 km @ 4:20, 2 km CD");
  });
});
