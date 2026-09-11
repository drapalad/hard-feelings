import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(import.meta.dirname, "WorkoutStagesChart.tsx"), "utf8");

describe("WorkoutStagesChart source", () => {
  it("uses cn(), stage colors, and native titles", () => {
    expect(source).toContain('from "@/lib/utils"');
    expect(source).toContain("cn(");
    expect(source).toContain("bg-slate-400");
    expect(source).toContain("bg-sky-400");
    expect(source).toContain("bg-amber-400");
    expect(source).toContain("bg-red-400");
    expect(source).toContain("title=");
    expect(source).toContain('aria-label="Workout stages"');
    expect(source).toContain("stages: persistedStages");
    expect(source).toContain("stages?: UnitStage[]");
  });

  it("colors bars from the stage kind field even when the label is easy jog", () => {
    expect(source).toContain("KIND_BAR[stage.kind]");
    expect(source).toContain("stages: persistedStages");
    expect(source).toContain("parseWorkoutStages({ structure, stages: persistedStages, distanceKm, type })");
  });

  it("does not use a charting library", () => {
    expect(source).not.toContain("recharts");
    expect(source).not.toContain("chart.js");
    expect(source).not.toContain("chartjs");
  });
});
