import { describe, expect, it } from "vitest";
import { applyMutations, gateAccept } from "./plan-adaptation";
import {
  COACH_UNAVAILABLE_REPLY,
  proposeAdaptation,
  sanitizeProposeResult,
  toRawProposeResult,
} from "./propose-adaptation";
import type { TrainingUnit } from "@/types";

const WEEK_START = "2026-08-10";
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
  unit({ date: "2026-08-11", type: "tempo", distanceKm: 10 }),
  unit({ date: "2026-08-12", type: "recovery", distanceKm: 7 }),
  unit({ date: "2026-08-13", type: "threshold", distanceKm: 7 }),
  unit({ date: "2026-08-14", type: "base", distanceKm: 7 }),
  unit({ date: "2026-08-15", type: "long", distanceKm: 10 }),
  unit({ date: "2026-08-16", type: "recovery", distanceKm: 5 }),
];

describe("proposeAdaptation", () => {
  it("explains Tuesday without mutations", async () => {
    const result = await proposeAdaptation({
      message: "what is Tuesday for",
      weekStart: WEEK_START,
      units: week,
    });

    expect(result.mutations).toEqual([]);
    expect(result.reply).toMatch(/tempo/);
    expect(result.reply).toMatch(/10/);
    expect(result.log).toBeUndefined();
  });

  it("logs Tuesday without a km override or mutations", async () => {
    const result = await proposeAdaptation({
      message: "I completed Tuesday",
      weekStart: WEEK_START,
      units: week,
    });

    expect(result.mutations).toEqual([]);
    expect(result.log).toEqual({ date: "2026-08-11" });
    expect(result.log?.distanceKm).toBeUndefined();
  });

  it("logs Wednesday with an explicit km and no mutations", async () => {
    const result = await proposeAdaptation({
      message: "logged Wednesday 8 km",
      weekStart: WEEK_START,
      units: week,
    });

    expect(result.mutations).toEqual([]);
    expect(result.log).toEqual({ date: "2026-08-12", distanceKm: 8 });
  });

  it("turns the unfrozen long into recovery at half km on poor sleep", async () => {
    const result = await proposeAdaptation({
      message: "poor sleep",
      weekStart: WEEK_START,
      units: week,
    });

    expect(result.mutations).toEqual([{ date: "2026-08-15", type: "recovery", distanceKm: 5 }]);
  });

  it("proposes Wednesday as long; gateAccept is false with CONSECUTIVE_LONGS when Tuesday is already long", async () => {
    const withTuesdayLong = week.map((item) =>
      item.date === "2026-08-11" ? { ...item, type: "long" as const } : item,
    );
    const proposed = await proposeAdaptation({
      message: "make Wednesday a long",
      weekStart: WEEK_START,
      units: withTuesdayLong,
    });

    expect(proposed.mutations).toEqual([{ date: "2026-08-12", type: "long" }]);
    const gated = gateAccept(applyMutations(withTuesdayLong, proposed.mutations), WEEKLY_KM, []);
    expect(gated.ok).toBe(false);
    expect(gated.validation.hard).toEqual([expect.objectContaining({ code: "CONSECUTIVE_LONGS" })]);
  });

  it("proposes Friday 200 km; gateAccept is false with WEEKLY_VOLUME_EXCEEDED", async () => {
    const proposed = await proposeAdaptation({
      message: "make Friday 200 km",
      weekStart: WEEK_START,
      units: week,
    });

    expect(proposed.mutations).toEqual([{ date: "2026-08-14", distanceKm: 200 }]);
    const gated = gateAccept(applyMutations(week, proposed.mutations), WEEKLY_KM, []);
    expect(gated.ok).toBe(false);
    expect(gated.validation.hard).toEqual([expect.objectContaining({ code: "WEEKLY_VOLUME_EXCEEDED" })]);
  });

  it("returns the pinned unavailable reply when complete rejects", async () => {
    const result = await proposeAdaptation(
      { message: "poor sleep", weekStart: WEEK_START, units: week },
      { complete: () => Promise.reject(new Error("timeout")) },
    );

    expect(result.reply).toBe(COACH_UNAVAILABLE_REPLY);
    expect(result.mutations).toEqual([]);
    expect(result.log).toBeUndefined();
  });

  it("keeps log and drops mutations when complete returns both", async () => {
    const result = await proposeAdaptation(
      { message: "I completed Tuesday", weekStart: WEEK_START, units: week },
      {
        complete: () =>
          Promise.resolve({
            reply: "Logged Tuesday and also changed Friday.",
            mutations: [{ date: "2026-08-14", distanceKm: 9 }],
            log: { date: "2026-08-11" },
          }),
      },
    );

    expect(result.log).toEqual({ date: "2026-08-11" });
    expect(result.mutations).toEqual([]);
  });

  it("sanitizes a Thursday recovery mutation from complete", async () => {
    const result = await proposeAdaptation(
      { message: "ease Thursday", weekStart: WEEK_START, units: week },
      {
        complete: () =>
          Promise.resolve({
            reply: "I would turn Thursday into recovery.",
            mutations: [{ date: "2026-08-13", type: "recovery", distanceKm: 3.5 }],
          }),
      },
    );

    expect(result.mutations).toEqual([{ date: "2026-08-13", type: "recovery", distanceKm: 3.5 }]);
    expect(result.log).toBeUndefined();
  });
});

describe("sanitizeProposeResult", () => {
  it("drops unknown dates, drops mutations when log is set, and drops log when the date has no unit", () => {
    const withLog = sanitizeProposeResult(
      {
        reply: "Logged an extra day and also mutated.",
        mutations: [{ date: "2026-08-14", distanceKm: 9, type: null, structure: null }],
        log: { date: "2026-08-11", distanceKm: null },
      },
      week,
    );
    expect(withLog.log).toEqual({ date: "2026-08-11" });
    expect(withLog.mutations).toEqual([]);

    const unknownMutation = sanitizeProposeResult(
      {
        reply: "Invented a day",
        mutations: [{ date: "2026-09-01", type: null, distanceKm: 20, structure: null }],
        log: null,
      },
      week,
    );
    expect(unknownMutation.mutations).toEqual([]);
    expect(unknownMutation.reply).toBe("Invented a day");

    const unknownLog = sanitizeProposeResult(
      {
        reply: "Logged a rest day",
        mutations: [],
        log: { date: "2026-09-01", distanceKm: 5 },
      },
      week,
    );
    expect(unknownLog.log).toBeUndefined();
    expect(unknownLog.mutations).toEqual([]);
    expect(unknownLog.reply).toBe("I don't see a workout on that day.");

    const created = sanitizeProposeResult(
      {
        reply: "Laid out a day",
        mutations: [{ date: "2026-09-03", type: "base", distanceKm: 8, structure: null }],
        log: null,
      },
      week,
      { createFrom: "2026-09-02", createTo: "2026-09-15" },
    );
    expect(created.mutations).toEqual([{ date: "2026-09-03", type: "base", distanceKm: 8 }]);

    const outsideHorizon = sanitizeProposeResult(
      {
        reply: "Too far",
        mutations: [{ date: "2026-09-20", type: "long", distanceKm: 20, structure: null }],
        log: null,
      },
      week,
      { createFrom: "2026-09-02", createTo: "2026-09-15" },
    );
    expect(outsideHorizon.mutations).toEqual([{ date: "2026-09-20", type: "long", distanceKm: 20 }]);
  });

  it("keeps delete, km, and create mutations on dates outside the create window", () => {
    const extra = unit({ date: "2026-09-28", type: "base", distanceKm: 8 });
    const horizon = { createFrom: "2026-09-02", createTo: "2026-09-15" };
    const deleted = sanitizeProposeResult(
      {
        reply: "Removed the far day.",
        mutations: [{ date: "2026-09-28", type: null, distanceKm: null, structure: null, delete: true }],
        log: null,
      },
      [...week, extra],
      horizon,
    );
    expect(deleted.mutations).toEqual([{ date: "2026-09-28", delete: true }]);

    const changed = sanitizeProposeResult(
      {
        reply: "Eased the far day.",
        mutations: [{ date: "2026-09-28", type: null, distanceKm: 4, structure: null }],
        log: null,
      },
      [...week, extra],
      horizon,
    );
    expect(changed.mutations).toEqual([{ date: "2026-09-28", distanceKm: 4 }]);

    const created = sanitizeProposeResult(
      {
        reply: "Invented a far day.",
        mutations: [{ date: "2026-09-30", type: "base", distanceKm: 8, structure: null }],
        log: null,
      },
      [...week, extra],
      horizon,
    );
    expect(created.mutations).toEqual([{ date: "2026-09-30", type: "base", distanceKm: 8 }]);
  });

  it("round-trips delete true and does not treat null type and km as delete", () => {
    const deleted = sanitizeProposeResult(
      {
        reply: "Rest Friday.",
        mutations: [{ date: "2026-08-14", type: null, distanceKm: null, structure: null, delete: true }],
        log: null,
      },
      week,
    );
    expect(deleted.mutations).toEqual([{ date: "2026-08-14", delete: true }]);

    const keep = sanitizeProposeResult(
      {
        reply: "Leave Friday.",
        mutations: [{ date: "2026-08-14", type: null, distanceKm: null, structure: null }],
        log: null,
      },
      week,
    );
    expect(keep.mutations).toEqual([{ date: "2026-08-14" }]);

    const roundTrip = sanitizeProposeResult(toRawProposeResult(deleted), week);
    expect(roundTrip.mutations).toEqual([{ date: "2026-08-14", delete: true }]);
  });

  it("preserves races through sanitize and does not emit calendar mutations from them", () => {
    const races = {
      add: [{ date: "2027-04-12", priority: "A" as const, name: "Spring HM" }],
      remove: [],
      patch: [],
    };
    const result = sanitizeProposeResult(
      {
        reply: "Add Spring HM.",
        mutations: [],
        log: null,
        races,
      },
      week,
    );
    expect(result.races).toEqual(races);
    expect(result.mutations).toEqual([]);

    const roundTrip = sanitizeProposeResult(toRawProposeResult(result), week);
    expect(roundTrip.races).toEqual(races);
  });
});
