import { describe, expect, it } from "vitest";
import { predictTimes, formatTime, STANDARD_DISTANCES } from "./pace-estimate";

describe("formatTime", () => {
  it("formats seconds under one hour as MM:SS", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(61)).toBe("01:01");
    expect(formatTime(1200)).toBe("20:00");
    expect(formatTime(3599)).toBe("59:59");
  });

  it("formats seconds at or above one hour as H:MM:SS", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(7200)).toBe("2:00:00");
    expect(formatTime(12345)).toBe("3:25:45");
  });

  it("rounds and handles negative input", () => {
    expect(formatTime(-90)).toBe("01:30");
    expect(formatTime(90.7)).toBe("01:31");
  });
});

describe("predictTimes", () => {
  it("returns four standard-distance predictions", () => {
    const result = predictTimes(5, 1200);
    expect(result).toHaveLength(4);
    expect(result.map((r) => r.label)).toEqual(["5K", "10K", "Half", "Marathon"]);
  });

  it("returns the reference time for the reference distance", () => {
    const result = predictTimes(5, 1200);
    expect(result.find((r) => r.label === "5K")).toEqual(
      expect.objectContaining({ timeSeconds: 1200, formatted: "20:00" }),
    );
  });

  it("predicts 10K from a 20:00 5K using Riegel", () => {
    const result = predictTimes(5, 1200);
    const tenK = result.find((r) => r.label === "10K");
    // Riegel: 1200 * (10/5)^1.06 ≈ 2498
    expect(tenK).toBeDefined();
    expect(tenK?.timeSeconds).toBeGreaterThan(2400);
    expect(tenK?.timeSeconds).toBeLessThan(2600);
  });

  it("predicts marathon from a 20:00 5K", () => {
    const result = predictTimes(5, 1200);
    const marathon = result.find((r) => r.label === "Marathon");
    // Should be around 3:10–3:30 range
    expect(marathon).toBeDefined();
    expect(marathon?.timeSeconds).toBeGreaterThan(11000);
    expect(marathon?.timeSeconds).toBeLessThan(13000);
    expect(marathon?.formatted).toMatch(/^\d:\d{2}:\d{2}$/);
  });

  it("returns empty array for invalid inputs", () => {
    expect(predictTimes(0, 1200)).toEqual([]);
    expect(predictTimes(5, 0)).toEqual([]);
    expect(predictTimes(-1, 1200)).toEqual([]);
    expect(predictTimes(5, -100)).toEqual([]);
    expect(predictTimes(NaN, 1200)).toEqual([]);
    expect(predictTimes(5, Infinity)).toEqual([]);
  });

  it("produces monotonically increasing times for increasing distances", () => {
    const result = predictTimes(10, 2500);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].timeSeconds).toBeGreaterThan(result[i - 1].timeSeconds);
    }
  });
});

describe("STANDARD_DISTANCES", () => {
  it("has four entries in order", () => {
    expect(STANDARD_DISTANCES).toHaveLength(4);
    expect(STANDARD_DISTANCES[0].label).toBe("5K");
    expect(STANDARD_DISTANCES[3].label).toBe("Marathon");
  });
});
