import { describe, expect, it } from "vitest";
import { resolveWorkoutLog, workoutLogWriteSchema } from "./workout-log";
import type { TrainingUnit } from "@/types";

const week: TrainingUnit[] = [
  { date: "2026-08-11", type: "tempo", distanceKm: 10, frozen: false },
  { date: "2026-08-12", type: "recovery", distanceKm: 7, frozen: false },
];

describe("resolveWorkoutLog", () => {
  it("returns NOT_FOUND on an unknown date", () => {
    expect(resolveWorkoutLog(week, "2026-08-10")).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("copies type and planned km on a known date", () => {
    expect(resolveWorkoutLog(week, "2026-08-11")).toEqual({
      ok: true,
      log: { date: "2026-08-11", type: "tempo", distanceKm: 10 },
    });
  });

  it("overrides distance only when km is explicit", () => {
    expect(resolveWorkoutLog(week, "2026-08-11", 8)).toEqual({
      ok: true,
      log: { date: "2026-08-11", type: "tempo", distanceKm: 8 },
    });
  });
});

describe("workoutLogWriteSchema", () => {
  it("rejects negative km and bad dates", () => {
    expect(workoutLogWriteSchema.safeParse({ date: "2026-08-11", distanceKm: -1 }).success).toBe(false);
    expect(workoutLogWriteSchema.safeParse({ date: "11-08-2026" }).success).toBe(false);
    expect(workoutLogWriteSchema.safeParse({ date: "2026-08-11" }).success).toBe(true);
  });
});
