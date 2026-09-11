import { describe, expect, it } from "vitest";
import { toRaceInput, type Race } from "@/types";
import {
  raceWriteSchema,
  profileWriteSchema,
  lastRaceWriteSchema,
  validateRaceList,
  weeklyKmSchema,
} from "./profile-races";

function race(partial: Partial<Race> & Pick<Race, "date" | "priority">): Race {
  return {
    id: "race-id",
    ...partial,
  };
}

describe("weeklyKmSchema", () => {
  it("accepts 47.5", () => {
    expect(weeklyKmSchema.safeParse(47.5)).toEqual({ success: true, data: 47.5 });
  });

  it("rejects 0, -1, 300.1, 47.55, and non-finite values", () => {
    expect(weeklyKmSchema.safeParse(0).success).toBe(false);
    expect(weeklyKmSchema.safeParse(-1).success).toBe(false);
    expect(weeklyKmSchema.safeParse(300.1).success).toBe(false);
    expect(weeklyKmSchema.safeParse(47.55).success).toBe(false);
    expect(weeklyKmSchema.safeParse(Number.NaN).success).toBe(false);
    expect(weeklyKmSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

const VALID_PROFILE = {
  weeklyKm: 47.5,
  longWeekdays: ["sat"],
  restWeekdays: [] as string[],
  mixEasy: 70,
  mixThreshold: 20,
  mixSpeed: 10,
};

describe("profileWriteSchema", () => {
  it("accepts defaults and unique rest days", () => {
    expect(profileWriteSchema.safeParse(VALID_PROFILE)).toEqual({ success: true, data: VALID_PROFILE });
    expect(
      profileWriteSchema.safeParse({ ...VALID_PROFILE, restWeekdays: ["mon", "fri"], mixEasy: 60, mixThreshold: 30 }),
    ).toMatchObject({ success: true });
  });

  it("accepts weeklyKm null and still rejects 0 and negatives", () => {
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, weeklyKm: null })).toEqual({
      success: true,
      data: { ...VALID_PROFILE, weeklyKm: null },
    });
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, weeklyKm: 0 }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, weeklyKm: -1 }).success).toBe(false);
  });

  it("rejects empty or duplicate long weekdays, unknown days, and mix that does not sum to 100", () => {
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, longWeekdays: [] }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, longWeekdays: ["sat", "sat"] }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, longWeekdays: ["saturday"] }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, restWeekdays: ["mon", "mon"] }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, mixEasy: 70.5 }).success).toBe(false);
    expect(profileWriteSchema.safeParse({ ...VALID_PROFILE, mixSpeed: 11 }).success).toBe(false);
  });

  it("strips extra keys", () => {
    const parsed = profileWriteSchema.safeParse({ ...VALID_PROFILE, userId: "other" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data).toEqual(VALID_PROFILE);
    expect(parsed.data).not.toHaveProperty("userId");
    expect(parsed.data).not.toHaveProperty("coachNotes");
  });

  it("omits coachNotes when the body omitted the key", () => {
    const parsed = profileWriteSchema.safeParse(VALID_PROFILE);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data).not.toHaveProperty("coachNotes");
  });

  it("trims, clamps, and stores empty coachNotes as null", () => {
    const trimmed = profileWriteSchema.safeParse({ ...VALID_PROFILE, coachNotes: "  hi  " });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) {
      expect(trimmed.data).toMatchObject({ coachNotes: "hi" });
    }

    const empty = profileWriteSchema.safeParse({ ...VALID_PROFILE, coachNotes: "" });
    expect(empty.success).toBe(true);
    if (empty.success) {
      expect(empty.data).toHaveProperty("coachNotes", null);
    }

    const whitespace = profileWriteSchema.safeParse({ ...VALID_PROFILE, coachNotes: "   " });
    expect(whitespace.success).toBe(true);
    if (whitespace.success) {
      expect(whitespace.data).toHaveProperty("coachNotes", null);
    }

    const long = "a".repeat(2001);
    const clamped = profileWriteSchema.safeParse({ ...VALID_PROFILE, coachNotes: long });
    expect(clamped.success).toBe(true);
    if (clamped.success) {
      expect(clamped.data).toHaveProperty("coachNotes", "a".repeat(2000));
    }
  });
});

describe("lastRaceWriteSchema", () => {
  const validLastRace = {
    lastRaceDate: "2026-04-12",
    lastRaceKm: 10,
    lastRaceTimeSec: 2490,
  };

  it("accepts a 10K 41:30 body", () => {
    expect(lastRaceWriteSchema.safeParse(validLastRace)).toEqual({ success: true, data: validLastRace });
  });

  it("strips extra userId", () => {
    const parsed = lastRaceWriteSchema.safeParse({ ...validLastRace, userId: "other" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data).toEqual(validLastRace);
    expect(parsed.data).not.toHaveProperty("userId");
  });

  it("rejects missing field, bad date, and non-positive time", () => {
    expect(lastRaceWriteSchema.safeParse({ lastRaceKm: 10, lastRaceTimeSec: 2490 }).success).toBe(false);
    expect(lastRaceWriteSchema.safeParse({ ...validLastRace, lastRaceDate: "12 Apr 2026" }).success).toBe(false);
    expect(lastRaceWriteSchema.safeParse({ ...validLastRace, lastRaceTimeSec: 0 }).success).toBe(false);
    expect(lastRaceWriteSchema.safeParse({ ...validLastRace, lastRaceTimeSec: -1 }).success).toBe(false);
  });
});

describe("validateRaceList", () => {
  it("rejects duplicate dates", () => {
    const result = validateRaceList([
      race({ date: "2026-10-04", priority: "A" }),
      race({ id: "other", date: "2026-10-04", priority: "B" }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("DUPLICATE_RACE_DATE");
  });

  it("rejects two A races", () => {
    const result = validateRaceList([
      race({ date: "2026-10-04", priority: "A" }),
      race({ id: "other", date: "2026-11-01", priority: "A" }),
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("SECOND_A_RACE");
  });

  it("accepts one A plus B/C/D", () => {
    const result = validateRaceList([
      race({ date: "2026-10-04", priority: "A" }),
      race({ id: "b", date: "2026-09-06", priority: "B" }),
      race({ id: "c", date: "2026-08-16", priority: "C" }),
      race({ id: "d", date: "2026-07-12", priority: "D" }),
    ]);

    expect(result).toEqual({ ok: true });
  });

  it("accepts an empty race list", () => {
    expect(validateRaceList([])).toEqual({ ok: true });
  });
});

describe("toRaceInput", () => {
  it("drops id and name and keeps date, priority, and optional goal", () => {
    const withGoal = toRaceInput(
      race({
        id: "keep-out",
        date: "2026-10-04",
        priority: "A",
        goal: "sub-3",
        name: "Berlin",
      }),
    );
    const withoutGoal = toRaceInput(
      race({
        id: "keep-out",
        date: "2026-10-04",
        priority: "B",
        name: "Local 10k",
      }),
    );

    expect(withGoal).toEqual({ date: "2026-10-04", priority: "A", goal: "sub-3" });
    expect(withoutGoal).toEqual({ date: "2026-10-04", priority: "B" });
    expect("id" in withGoal).toBe(false);
    expect("name" in withGoal).toBe(false);
    expect("id" in withoutGoal).toBe(false);
    expect("name" in withoutGoal).toBe(false);
  });
});

describe("raceWriteSchema", () => {
  it("trims optional name and goal and omits empty strings", () => {
    const parsed = raceWriteSchema.parse({
      date: "2026-10-04",
      priority: "A",
      name: "  Berlin  ",
      goal: "   ",
    });

    expect(parsed).toEqual({ date: "2026-10-04", priority: "A", name: "Berlin", goal: undefined });
  });
});
