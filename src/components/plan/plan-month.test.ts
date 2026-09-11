import { describe, expect, it } from "vitest";
import {
  formatCompactKm,
  generateHorizonPrompt,
  generatePlanButtonLabel,
  generateWeekButtonLabel,
  hasUnitInHorizon,
  mergeItemByDate,
  mergeReturnedUnits,
  mergeWeekSlice,
  weekHasUnits,
  weekUnitsEqual,
} from "./plan-month";
import type { TrainingUnit } from "@/types";

const WEEK_START = "2026-08-31";

function unit(date: string): TrainingUnit {
  return { date, type: "base", distanceKm: 8, frozen: false };
}

describe("weekHasUnits", () => {
  it("is true when any unit date is in the active week", () => {
    expect(weekHasUnits([unit("2026-08-31")], WEEK_START)).toBe(true);
    expect(weekHasUnits([unit("2026-09-07")], WEEK_START)).toBe(false);
    expect(weekHasUnits([], WEEK_START)).toBe(false);
  });
});

describe("hasUnitInHorizon", () => {
  it("is true when any unit date is in the inclusive window", () => {
    expect(hasUnitInHorizon([unit("2026-09-02")], "2026-09-02", "2026-09-15")).toBe(true);
    expect(hasUnitInHorizon([unit("2026-09-15")], "2026-09-02", "2026-09-15")).toBe(true);
    expect(hasUnitInHorizon([unit("2026-08-31")], "2026-09-02", "2026-09-15")).toBe(false);
    expect(hasUnitInHorizon([], "2026-09-02", "2026-09-15")).toBe(false);
  });
});

describe("generatePlanButtonLabel", () => {
  it("returns Working..., Regenerate next 14 days, or Generate next 14 days", () => {
    expect(generatePlanButtonLabel(true, true)).toBe("Working...");
    expect(generatePlanButtonLabel(true, false)).toBe("Working...");
    expect(generatePlanButtonLabel(false, true)).toBe("Regenerate next 14 days");
    expect(generatePlanButtonLabel(false, false)).toBe("Generate next 14 days");
  });
});

describe("generateWeekButtonLabel", () => {
  it("returns Working..., Regenerate week, or Generate week", () => {
    expect(generateWeekButtonLabel(true, true)).toBe("Working...");
    expect(generateWeekButtonLabel(true, false)).toBe("Working...");
    expect(generateWeekButtonLabel(false, true)).toBe("Regenerate week");
    expect(generateWeekButtonLabel(false, false)).toBe("Generate week");
  });
});

describe("generateHorizonPrompt", () => {
  it("lays out or regenerates the UTC window and keeps frozen dates", () => {
    expect(generateHorizonPrompt("2026-09-02", "2026-09-15", false)).toBe(
      "Lay out the next 14 days from 2026-09-02 through 2026-09-15 (UTC), keeping frozen dates.",
    );
    expect(generateHorizonPrompt("2026-09-02", "2026-09-15", true)).toBe(
      "Regenerate the next 14 days from 2026-09-02 through 2026-09-15 (UTC), keeping frozen dates.",
    );
  });
});

describe("formatCompactKm", () => {
  it("drops the decimal for integers and keeps one decimal otherwise", () => {
    expect(formatCompactKm(8)).toBe("8");
    expect(formatCompactKm(8.5)).toBe("8.5");
    expect(formatCompactKm(8.0)).toBe("8");
  });
});

describe("weekUnitsEqual", () => {
  it("compares date, type, km, frozen, and structure", () => {
    const left: TrainingUnit[] = [{ date: "2026-08-31", type: "base", distanceKm: 8, frozen: false }];
    expect(weekUnitsEqual(left, [{ date: "2026-08-31", type: "base", distanceKm: 8, frozen: false }])).toBe(true);
    expect(weekUnitsEqual(left, [{ date: "2026-08-31", type: "tempo", distanceKm: 8, frozen: false }])).toBe(false);
    expect(
      weekUnitsEqual(left, [{ date: "2026-08-31", type: "base", distanceKm: 8, frozen: false, structure: "session" }]),
    ).toBe(false);
  });
});

describe("mergeWeekSlice", () => {
  it("replaces the active week and keeps units outside that week", () => {
    const current: TrainingUnit[] = [unit("2026-08-31"), unit("2026-09-07")];
    const incoming: TrainingUnit[] = [{ date: "2026-08-31", type: "tempo", distanceKm: 10, frozen: false }];
    expect(mergeWeekSlice(current, incoming, WEEK_START)).toEqual([
      { date: "2026-08-31", type: "tempo", distanceKm: 10, frozen: false },
      unit("2026-09-07"),
    ]);
  });

  it("drops incoming dates outside the active week", () => {
    const current: TrainingUnit[] = [unit("2026-08-31"), unit("2026-09-07")];
    const incoming: TrainingUnit[] = [
      { date: "2026-08-31", type: "tempo", distanceKm: 10, frozen: false },
      unit("2026-09-10"),
    ];
    expect(mergeWeekSlice(current, incoming, WEEK_START)).toEqual([
      { date: "2026-08-31", type: "tempo", distanceKm: 10, frozen: false },
      unit("2026-09-07"),
    ]);
  });
});

describe("mergeItemByDate", () => {
  it("replaces the matching date and appends when missing", () => {
    expect(
      mergeItemByDate([unit("2026-08-31"), unit("2026-09-07")], {
        date: "2026-08-31",
        type: "tempo",
        distanceKm: 10,
        frozen: true,
      }),
    ).toEqual([{ date: "2026-08-31", type: "tempo", distanceKm: 10, frozen: true }, unit("2026-09-07")]);
    expect(mergeItemByDate([unit("2026-08-31")], unit("2026-09-02"))).toEqual([unit("2026-08-31"), unit("2026-09-02")]);
  });
});

describe("mergeReturnedUnits", () => {
  it("merges every ISO week present in the payload including the request week", () => {
    const current: TrainingUnit[] = [unit("2026-08-31"), unit("2026-09-07")];
    const incoming: TrainingUnit[] = [
      { date: "2026-09-02", type: "tempo", distanceKm: 10, frozen: false },
      { date: "2026-09-07", type: "long", distanceKm: 16, frozen: false },
    ];
    expect(mergeReturnedUnits(current, incoming, WEEK_START)).toEqual([
      { date: "2026-09-02", type: "tempo", distanceKm: 10, frozen: false },
      { date: "2026-09-07", type: "long", distanceKm: 16, frozen: false },
    ]);
  });

  it("keeps the request week when the payload only contains another ISO week", () => {
    const current: TrainingUnit[] = [unit("2026-08-31"), unit("2026-09-07")];
    const incoming: TrainingUnit[] = [{ date: "2026-09-24", type: "base", distanceKm: 10, frozen: false }];
    expect(mergeReturnedUnits(current, incoming, WEEK_START)).toEqual([
      unit("2026-08-31"),
      unit("2026-09-07"),
      { date: "2026-09-24", type: "base", distanceKm: 10, frozen: false },
    ]);
  });

  it("clears the request week when the payload is empty", () => {
    const current: TrainingUnit[] = [unit("2026-08-31"), unit("2026-09-07")];
    expect(mergeReturnedUnits(current, [], WEEK_START)).toEqual([unit("2026-09-07")]);
  });
});
