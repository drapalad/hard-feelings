import { describe, expect, it } from "vitest";
import { roundKm } from "@/lib/km";
import { validatePlan } from "./validate-plan";
import type { BoundCode, Plan, TrainingUnit } from "@/types";

const WEEKLY_KM = 50;

function unit(partial: Partial<TrainingUnit> & Pick<TrainingUnit, "date">): TrainingUnit {
  return {
    type: "base",
    distanceKm: 10,
    frozen: false,
    ...partial,
  };
}

function planOf(units: TrainingUnit[]): Plan {
  return { units };
}

function context(frozenUnits: TrainingUnit[] = []) {
  return { weeklyKm: WEEKLY_KM, frozenUnits };
}

function codes(violations: { code: BoundCode }[]): BoundCode[] {
  return violations.map((violation) => violation.code);
}

describe("roundKm", () => {
  it("maps the 50 km fill-split artifact to 50", () => {
    expect(roundKm(50.00000000000001)).toBe(50);
  });
});

describe("validatePlan volume band", () => {
  it("emits no volume violation for seven copies of 50/7 (IEEE dust)", () => {
    const perDay = 50 / 7;
    const plan = planOf([
      unit({ date: "2026-08-10", distanceKm: perDay }),
      unit({ date: "2026-08-11", distanceKm: perDay }),
      unit({ date: "2026-08-12", distanceKm: perDay }),
      unit({ date: "2026-08-13", distanceKm: perDay }),
      unit({ date: "2026-08-14", distanceKm: perDay }),
      unit({ date: "2026-08-15", distanceKm: perDay }),
      unit({ date: "2026-08-16", distanceKm: perDay }),
    ]);

    const result = validatePlan(plan, context());

    expect(codes(result.hard)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
    expect(codes(result.soft)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
  });

  it("emits no volume violation when total km is at weeklyKm", () => {
    const plan = planOf([
      unit({ date: "2026-08-10", distanceKm: 10 }),
      unit({ date: "2026-08-11", distanceKm: 10 }),
      unit({ date: "2026-08-12", distanceKm: 10 }),
      unit({ date: "2026-08-13", distanceKm: 10 }),
      unit({ date: "2026-08-14", distanceKm: 10 }),
    ]);

    const result = validatePlan(plan, context());

    expect(codes(result.hard)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
    expect(codes(result.soft)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
  });

  it("emits no volume violation when total km is under weeklyKm", () => {
    const plan = planOf([unit({ date: "2026-08-10", distanceKm: 40 })]);

    const result = validatePlan(plan, context());

    expect(codes(result.hard)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
    expect(codes(result.soft)).not.toContain("WEEKLY_VOLUME_EXCEEDED");
  });

  it("emits soft WEEKLY_VOLUME_EXCEEDED when total km is over weeklyKm and at the 120% ceiling", () => {
    const justOver = planOf([unit({ date: "2026-08-10", distanceKm: 50.1 })]);
    const atCeiling = planOf([unit({ date: "2026-08-10", distanceKm: WEEKLY_KM * 1.2 })]);

    const justOverResult = validatePlan(justOver, context());
    const atCeilingResult = validatePlan(atCeiling, context());

    expect(justOverResult.hard).toEqual([]);
    expect(justOverResult.soft).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft" }),
    ]);
    expect(atCeilingResult.hard).toEqual([]);
    expect(atCeilingResult.soft).toEqual([
      expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "soft" }),
    ]);
  });

  it("emits hard WEEKLY_VOLUME_EXCEEDED when total km is over the 120% ceiling", () => {
    const plan = planOf([unit({ date: "2026-08-10", distanceKm: WEEKLY_KM * 1.2 + 0.1 })]);

    const result = validatePlan(plan, context());

    expect(result.soft).toEqual([]);
    expect(result.hard).toEqual([expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED", severity: "hard" })]);
  });

  it("does not print a long binary expansion in a real soft volume message", () => {
    const result = validatePlan(planOf([unit({ date: "2026-08-10", distanceKm: 50.1 })]), context());

    expect(result.soft[0]?.message).toContain("50.1");
    expect(result.soft[0]?.message).not.toContain("000000");
  });
});

describe("validatePlan consecutive longs", () => {
  it("emits hard CONSECUTIVE_LONGS when two longs fall on adjacent calendar dates", () => {
    const plan = planOf([
      unit({ date: "2026-08-12", type: "long", distanceKm: 20 }),
      unit({ date: "2026-08-10", type: "base", distanceKm: 8 }),
      unit({ date: "2026-08-11", type: "long", distanceKm: 18 }),
    ]);

    const result = validatePlan(plan, context());

    expect(result.hard).toEqual([
      expect.objectContaining({
        code: "CONSECUTIVE_LONGS",
        severity: "hard",
        dates: ["2026-08-11", "2026-08-12"],
      }),
    ]);
  });

  it("emits no consecutive-long violation when longs are separated by a day", () => {
    const plan = planOf([
      unit({ date: "2026-08-10", type: "long", distanceKm: 20 }),
      unit({ date: "2026-08-12", type: "long", distanceKm: 18 }),
    ]);

    const result = validatePlan(plan, context());

    expect(codes(result.hard)).not.toContain("CONSECUTIVE_LONGS");
  });
});

describe("validatePlan frozen anchors", () => {
  const frozen = unit({ date: "2026-08-13", type: "tempo", distanceKm: 12, frozen: true });

  it("emits no freeze violation when the frozen unit is preserved", () => {
    const plan = planOf([frozen, unit({ date: "2026-08-14", distanceKm: 10 })]);

    const result = validatePlan(plan, context([frozen]));

    expect(codes(result.hard)).not.toContain("FROZEN_ANCHOR_DROPPED");
  });

  it("emits hard FROZEN_ANCHOR_DROPPED when the frozen unit is missing", () => {
    const plan = planOf([unit({ date: "2026-08-14", distanceKm: 10 })]);

    const result = validatePlan(plan, context([frozen]));

    expect(result.hard).toEqual([
      expect.objectContaining({
        code: "FROZEN_ANCHOR_DROPPED",
        severity: "hard",
        dates: ["2026-08-13"],
      }),
    ]);
  });

  it("emits hard FROZEN_ANCHOR_DROPPED when frozen type or distanceKm changed", () => {
    const typeChanged = planOf([{ ...frozen, type: "base" }]);
    const distanceChanged = planOf([{ ...frozen, distanceKm: 11 }]);

    const typeResult = validatePlan(typeChanged, context([frozen]));
    const distanceResult = validatePlan(distanceChanged, context([frozen]));

    expect(typeResult.hard).toEqual([
      expect.objectContaining({ code: "FROZEN_ANCHOR_DROPPED", severity: "hard", dates: ["2026-08-13"] }),
    ]);
    expect(distanceResult.hard).toEqual([
      expect.objectContaining({ code: "FROZEN_ANCHOR_DROPPED", severity: "hard", dates: ["2026-08-13"] }),
    ]);
  });
});
