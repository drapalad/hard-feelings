import { describe, expect, it } from "vitest";
import { inclusiveIsoDates } from "@/lib/dates";
import type { TrainingUnit, WorkoutLog, WorkoutType } from "@/types";
import {
  aggregateDailyLoad,
  aggregateLoadWeeks,
  bucketWorkoutType,
  DECAY_FACTOR,
  loadChartWindow,
  nextDailyLoad,
  pickDayLoad,
} from "./training-load";

const TODAY = "2026-09-02";

function unit(date: string, type: WorkoutType, distanceKm: number): TrainingUnit {
  return { date, type, distanceKm, frozen: false };
}

function log(date: string, type: WorkoutType, distanceKm: number): WorkoutLog {
  return { date, type, distanceKm };
}

describe("bucketWorkoutType", () => {
  it("maps Easy, Threshold, and Speed from the six workout types", () => {
    expect(bucketWorkoutType("base")).toBe("easy");
    expect(bucketWorkoutType("recovery")).toBe("easy");
    expect(bucketWorkoutType("long")).toBe("easy");
    expect(bucketWorkoutType("tempo")).toBe("threshold");
    expect(bucketWorkoutType("threshold")).toBe("threshold");
    expect(bucketWorkoutType("anaerobic")).toBe("speed");
  });
});

describe("loadChartWindow", () => {
  it("returns eight Mondays and 56 inclusive days around UTC today", () => {
    const window = loadChartWindow(TODAY);
    expect(window.weekStarts).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
    ]);
    expect(window.from).toBe("2026-07-27");
    expect(window.to).toBe("2026-09-20");
    expect(inclusiveIsoDates(window.from, window.to)).toHaveLength(56);
  });
});

describe("pickDayLoad", () => {
  it("uses log type and km on a past date when a log exists", () => {
    expect(pickDayLoad("2026-08-31", TODAY, unit("2026-08-31", "base", 8), log("2026-08-31", "anaerobic", 3))).toEqual({
      bucket: "speed",
      distanceKm: 3,
    });
  });

  it("uses the planned unit on a past date when there is no log", () => {
    expect(pickDayLoad("2026-08-31", TODAY, unit("2026-08-31", "tempo", 10), undefined)).toEqual({
      bucket: "threshold",
      distanceKm: 10,
    });
  });

  it("ignores a log on today and on a future date", () => {
    expect(pickDayLoad(TODAY, TODAY, unit(TODAY, "long", 18), log(TODAY, "anaerobic", 1))).toEqual({
      bucket: "easy",
      distanceKm: 18,
    });
    expect(pickDayLoad("2026-09-08", TODAY, unit("2026-09-08", "threshold", 12), log("2026-09-08", "base", 4))).toEqual(
      { bucket: "threshold", distanceKm: 12 },
    );
  });

  it("counts a past log when there is no planned unit", () => {
    expect(pickDayLoad("2026-08-20", TODAY, undefined, log("2026-08-20", "recovery", 6))).toEqual({
      bucket: "easy",
      distanceKm: 6,
    });
  });

  it("returns null on rest (neither unit nor usable source)", () => {
    expect(pickDayLoad("2026-08-21", TODAY, undefined, undefined)).toBeNull();
    expect(pickDayLoad(TODAY, TODAY, undefined, log(TODAY, "base", 5))).toBeNull();
  });
});

describe("aggregateLoadWeeks", () => {
  it("buckets eight weeks with logs winning in the past and plan winning today", () => {
    const weeks = aggregateLoadWeeks(
      [
        unit("2026-08-10", "base", 8),
        unit("2026-08-31", "tempo", 10),
        unit(TODAY, "long", 18),
        unit("2026-09-08", "anaerobic", 5),
      ],
      [log("2026-08-10", "threshold", 12), log(TODAY, "base", 2)],
      TODAY,
    );
    expect(weeks).toHaveLength(8);
    expect(weeks[2]).toEqual({ weekStart: "2026-08-10", easy: 0, threshold: 12, speed: 0 });
    expect(weeks[5]).toEqual({ weekStart: "2026-08-31", easy: 18, threshold: 10, speed: 0 });
    expect(weeks[6]).toEqual({ weekStart: "2026-09-07", easy: 0, threshold: 0, speed: 5 });
    expect(weeks.filter((week) => week.easy === 0 && week.threshold === 0 && week.speed === 0)).toHaveLength(5);
  });
});

describe("nextDailyLoad", () => {
  it("returns zero when both prev and todayKm are zero", () => {
    const zero = { easy: 0, threshold: 0, speed: 0 };
    expect(nextDailyLoad(zero, zero)).toEqual({ easy: 0, threshold: 0, speed: 0 });
  });

  it("decays prev and adds todayKm for each bucket", () => {
    const prev = { easy: 10, threshold: 5, speed: 2 };
    const km = { easy: 3, threshold: 0, speed: 1 };
    const result = nextDailyLoad(prev, km);
    expect(result.easy).toBeCloseTo(10 * DECAY_FACTOR + 3);
    expect(result.threshold).toBeCloseTo(5 * DECAY_FACTOR);
    expect(result.speed).toBeCloseTo(2 * DECAY_FACTOR + 1);
  });

  it("spike decays toward zero over several iterations", () => {
    let load = nextDailyLoad({ easy: 0, threshold: 0, speed: 0 }, { easy: 10, threshold: 0, speed: 0 });
    expect(load.easy).toBe(10);
    for (let i = 0; i < 10; i++) {
      load = nextDailyLoad(load, { easy: 0, threshold: 0, speed: 0 });
    }
    expect(load.easy).toBeLessThan(2);
    expect(load.easy).toBeGreaterThan(0);
  });
});

describe("aggregateDailyLoad", () => {
  it("returns 56 entries for empty inputs", () => {
    const entries = aggregateDailyLoad([], [], TODAY);
    expect(entries).toHaveLength(56);
    expect(entries.every((e) => e.easy === 0 && e.threshold === 0 && e.speed === 0)).toBe(true);
  });

  it("accumulates a single-day unit into the correct bucket", () => {
    const entries = aggregateDailyLoad([unit("2026-09-08", "tempo", 10)], [], TODAY);
    expect(entries).toHaveLength(56);
    expect(entries.find((e) => e.date === "2026-09-08")).toEqual(
      expect.objectContaining({ threshold: 10, easy: 0, speed: 0 }),
    );
  });

  it("decays a spike over subsequent days", () => {
    const entries = aggregateDailyLoad([unit("2026-09-08", "anaerobic", 8)], [], TODAY);
    const spike = entries.find((e) => e.date === "2026-09-08");
    const dayAfter = entries.find((e) => e.date === "2026-09-09");
    const twoDaysAfter = entries.find((e) => e.date === "2026-09-10");
    expect(spike).toBeDefined();
    expect(dayAfter).toBeDefined();
    expect(twoDaysAfter).toBeDefined();
    expect(spike?.speed).toBe(8);
    expect(dayAfter?.speed).toBeCloseTo(8 * DECAY_FACTOR, 1);
    expect(twoDaysAfter?.speed).toBeLessThan(dayAfter?.speed ?? Number.POSITIVE_INFINITY);
  });

  it("uses logs for past dates and units for today/future", () => {
    const entries = aggregateDailyLoad(
      [unit("2026-08-31", "base", 10), unit(TODAY, "long", 18)],
      [log("2026-08-31", "threshold", 12)],
      TODAY,
    );
    expect(entries.find((e) => e.date === "2026-08-31")?.threshold).toBeGreaterThan(0);
    expect(entries.find((e) => e.date === TODAY)?.easy).toBeGreaterThan(0);
  });
});
