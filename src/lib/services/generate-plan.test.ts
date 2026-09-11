import { describe, expect, it } from "vitest";
import { roundKm } from "@/lib/km";
import { defaultGeneratePrefs, generatePlan } from "./generate-plan";
import type { GenerateErrorCode, GenerateInput, TrainingUnit } from "@/types";

const WEEK_DATES = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
] as const;

function validInput(overrides: Partial<GenerateInput> = {}): GenerateInput {
  return {
    weeklyKm: 50,
    races: [{ date: "2026-10-04", priority: "A" }],
    frozenUnits: [],
    weekStart: WEEK_DATES[0],
    ...defaultGeneratePrefs(),
    ...overrides,
  };
}

function frozenUnit(partial: Partial<TrainingUnit> & Pick<TrainingUnit, "date">): TrainingUnit {
  return {
    type: "tempo",
    distanceKm: 12,
    frozen: true,
    ...partial,
  };
}

function expectError(input: GenerateInput, code: GenerateErrorCode) {
  const result = generatePlan(input);
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error.code).toBe(code);
}

function expectWeekVolumeMatchesDeclared(units: TrainingUnit[], weeklyKm: number) {
  const totalKm = roundKm(units.reduce((sum, unit) => sum + unit.distanceKm, 0));
  expect(totalKm).toBe(roundKm(weeklyKm));
}

describe("risk #3 volume oracle: generatePlan input errors", () => {
  it("returns MISSING_WEEKLY_KM when weeklyKm is not finite", () => {
    expectError(validInput({ weeklyKm: Number.NaN }), "MISSING_WEEKLY_KM");
    expectError(validInput({ weeklyKm: Number.POSITIVE_INFINITY }), "MISSING_WEEKLY_KM");
  });

  it("returns INVALID_WEEKLY_KM when weeklyKm is finite and <= 0", () => {
    expectError(validInput({ weeklyKm: 0 }), "INVALID_WEEKLY_KM");
    expectError(validInput({ weeklyKm: -10 }), "INVALID_WEEKLY_KM");
  });

  it("returns NO_A_RACE when no race has priority A", () => {
    expectError(validInput({ races: [] }), "NO_A_RACE");
    expectError(validInput({ races: [{ date: "2026-10-04", priority: "B" }] }), "NO_A_RACE");
  });
});

describe("risk #3 volume oracle: generatePlan success path", () => {
  it("returns ok: true with 7 days from weekStart and empty validation.hard", () => {
    const result = generatePlan(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units.map((unit) => unit.date)).toEqual([...WEEK_DATES]);
    expect(result.validation.hard).toEqual([]);
    expect(result.validation.soft).toEqual([]);
    expect(result.plan.units.every((unit) => unit.distanceKm === roundKm(unit.distanceKm))).toBe(true);
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });

  it("hits declared weekly km for a remainder target (40.5)", () => {
    const weeklyKm = 40.5;
    const result = generatePlan(validInput({ weeklyKm }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.validation.hard).toEqual([]);
    expectWeekVolumeMatchesDeclared(result.plan.units, weeklyKm);
  });

  it("hits declared weekly km when one in-week frozen unit is under target", () => {
    const weeklyKm = 50;
    const frozen = frozenUnit({ date: "2026-08-13", type: "tempo", distanceKm: 12 });
    const result = generatePlan(validInput({ weeklyKm, frozenUnits: [frozen] }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units).toContainEqual(frozen);
    expect(result.validation.hard).toEqual([]);
    expectWeekVolumeMatchesDeclared(result.plan.units, weeklyKm);
  });

  it("copies in-week frozen units unchanged and ignores out-of-week frozen units", () => {
    const inWeek = frozenUnit({ date: "2026-08-13", type: "tempo", distanceKm: 12 });
    const outOfWeek = frozenUnit({ date: "2026-08-20", type: "long", distanceKm: 25 });

    const result = generatePlan(validInput({ frozenUnits: [inWeek, outOfWeek] }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units).toContainEqual(inWeek);
    expect(result.plan.units.some((unit) => unit.date === outOfWeek.date)).toBe(false);
    expect(result.validation.hard).toEqual([]);
  });

  it("returns ok: true with soft WEEKLY_VOLUME_EXCEEDED when frozen km is in the 100-120% band", () => {
    const frozen = frozenUnit({ date: "2026-08-13", type: "long", distanceKm: 55 });
    const result = generatePlan(validInput({ frozenUnits: [frozen] }));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.validation.hard).toEqual([]);
    expect(result.validation.soft).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft" }),
    ]);
    const leftover = result.plan.units.filter((unit) => unit.date !== frozen.date);
    expect(leftover).toHaveLength(6);
    expect(leftover.every((unit) => unit.distanceKm === 0)).toBe(true);
  });

  it("returns the same plan for the same valid input twice", () => {
    const input = validInput({
      frozenUnits: [frozenUnit({ date: "2026-08-12", type: "threshold", distanceKm: 8 })],
    });

    expect(generatePlan(input)).toEqual(generatePlan(input));
  });
});

describe("risk #3 generatePlan honors profile prefs and A–D priorities", () => {
  it("omits rest weekdays and puts long on preferred long weekdays", () => {
    const result = generatePlan(
      validInput({
        longWeekdays: ["sat"],
        restWeekdays: ["mon"],
        mixEasy: 70,
        mixThreshold: 20,
        mixSpeed: 10,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units.some((unit) => unit.date === "2026-08-10")).toBe(false);
    expect(result.plan.units.find((unit) => unit.date === "2026-08-15")?.type).toBe("long");
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });

  it("uses a 100% speed mix as anaerobic on every fill day", () => {
    const result = generatePlan(
      validInput({
        longWeekdays: [],
        restWeekdays: [],
        mixEasy: 0,
        mixThreshold: 0,
        mixSpeed: 100,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units.every((unit) => unit.type === "anaerobic")).toBe(true);
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });

  it("leaves an in-week A-race day empty", () => {
    const result = generatePlan(
      validInput({
        races: [{ date: "2026-08-12", priority: "A" }],
        longWeekdays: [],
        restWeekdays: [],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units.some((unit) => unit.date === "2026-08-12")).toBe(false);
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });

  it("pins an in-week B race to tempo and C to recovery, and does not pin D", () => {
    const result = generatePlan(
      validInput({
        races: [
          { date: "2026-10-04", priority: "A" },
          { date: "2026-08-14", priority: "B" },
          { date: "2026-08-11", priority: "C" },
          { date: "2026-08-13", priority: "D" },
        ],
        longWeekdays: [],
        restWeekdays: [],
        mixEasy: 0,
        mixThreshold: 0,
        mixSpeed: 100,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const byDate = Object.fromEntries(result.plan.units.map((unit) => [unit.date, unit.type]));
    expect(byDate["2026-08-14"]).toBe("tempo");
    expect(byDate["2026-08-11"]).toBe("recovery");
    expect(byDate["2026-08-13"]).toBe("anaerobic");
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });

  it("drops speed from the mix when the A race is inside 21 days", () => {
    const result = generatePlan(
      validInput({
        races: [{ date: "2026-08-24", priority: "A" }],
        longWeekdays: [],
        restWeekdays: [],
        mixEasy: 70,
        mixThreshold: 20,
        mixSpeed: 10,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.units.some((unit) => unit.type === "anaerobic")).toBe(false);
    expectWeekVolumeMatchesDeclared(result.plan.units, 50);
  });
});

describe("risk #3 volume oracle: generatePlan unsatisfiable frozen bounds", () => {
  it("returns UNSATISFIABLE_BOUNDS for consecutive frozen longs", () => {
    expectError(
      validInput({
        frozenUnits: [
          frozenUnit({ date: "2026-08-10", type: "long", distanceKm: 20 }),
          frozenUnit({ date: "2026-08-11", type: "long", distanceKm: 18 }),
        ],
      }),
      "UNSATISFIABLE_BOUNDS",
    );
  });

  it("returns UNSATISFIABLE_BOUNDS when frozen km sum is over weeklyKm * 1.2", () => {
    expectError(
      validInput({
        frozenUnits: [frozenUnit({ date: "2026-08-13", type: "long", distanceKm: 61 })],
      }),
      "UNSATISFIABLE_BOUNDS",
    );
  });
});
