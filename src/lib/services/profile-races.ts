import { z } from "zod";
import { WEEKDAYS, type Race, type Weekday } from "@/types";

export type RaceListErrorCode = "DUPLICATE_RACE_DATE" | "SECOND_A_RACE";

export type RaceListResult = { ok: true } | { ok: false; error: { code: RaceListErrorCode; message: string } };

export const RACE_LIST_ERROR_MESSAGES: Record<RaceListErrorCode, string> = {
  DUPLICATE_RACE_DATE: "Two races cannot share a date.",
  SECOND_A_RACE: "At most one A-priority race is allowed.",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function hasAtMostOneDecimal(value: number): boolean {
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-8;
}

function omitEmpty(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
}

export const weeklyKmSchema = z
  .number()
  .gt(0)
  .lte(300)
  .refine(hasAtMostOneDecimal, { message: "weeklyKm must have at most one decimal place" });

export const weekdaySchema = z.enum(WEEKDAYS);

function uniqueWeekdays(value: Weekday[]): boolean {
  return new Set(value).size === value.length;
}

export const longWeekdaysSchema = z
  .array(weekdaySchema)
  .min(1)
  .refine(uniqueWeekdays, { message: "longWeekdays must be unique" });

export const restWeekdaysSchema = z
  .array(weekdaySchema)
  .refine(uniqueWeekdays, { message: "restWeekdays must be unique" });

export const mixPctSchema = z.number().int().min(0).max(100);

export const profileWriteSchema = z
  .object({
    weeklyKm: weeklyKmSchema.nullable(),
    longWeekdays: longWeekdaysSchema,
    restWeekdays: restWeekdaysSchema,
    mixEasy: mixPctSchema,
    mixThreshold: mixPctSchema,
    mixSpeed: mixPctSchema,
    coachNotes: z.string().optional(),
  })
  .refine((value) => value.mixEasy + value.mixThreshold + value.mixSpeed === 100, {
    message: "mixEasy, mixThreshold, and mixSpeed must sum to 100",
  })
  .transform((value) => {
    if (value.coachNotes === undefined) {
      const { coachNotes: _omitted, ...prefs } = value;
      return prefs;
    }
    const trimmed = value.coachNotes.trim();
    return {
      ...value,
      coachNotes: trimmed === "" ? null : trimmed.slice(0, 2000),
    };
  });

export const lastRaceWriteSchema = z.object({
  lastRaceDate: z.string().regex(ISO_DATE, { message: "lastRaceDate must be YYYY-MM-DD" }),
  lastRaceKm: z.number().gt(0).lte(300),
  lastRaceTimeSec: z.number().int().gt(0).lte(172800),
});

const optionalText = z.string().trim().optional().transform(omitEmpty);

export const raceWriteSchema = z.object({
  date: z.string().regex(ISO_DATE, { message: "date must be YYYY-MM-DD" }),
  priority: z.enum(["A", "B", "C", "D"]),
  goal: optionalText,
  name: optionalText,
});

export function validateRaceList(races: Pick<Race, "date" | "priority">[]): RaceListResult {
  const dates = new Set<string>();
  for (const race of races) {
    if (dates.has(race.date)) {
      return {
        ok: false,
        error: { code: "DUPLICATE_RACE_DATE", message: RACE_LIST_ERROR_MESSAGES.DUPLICATE_RACE_DATE },
      };
    }
    dates.add(race.date);
  }

  const aCount = races.filter((race) => race.priority === "A").length;
  if (aCount >= 2) {
    return {
      ok: false,
      error: { code: "SECOND_A_RACE", message: RACE_LIST_ERROR_MESSAGES.SECOND_A_RACE },
    };
  }

  return { ok: true };
}
