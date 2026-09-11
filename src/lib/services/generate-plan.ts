import type { GenerateInput, GenerateResult, Plan, RaceInput, TrainingUnit, WorkoutType } from "@/types";
import { roundKm } from "@/lib/km";
import { addUtcDays, utcDayDiff, weekdayOf } from "@/lib/dates";
import { PROFILE_PREF_DEFAULTS } from "./profile";
import { validatePlan } from "./validate-plan";

const EASY_ROTATION: WorkoutType[] = ["base", "recovery"];
const THRESHOLD_ROTATION: WorkoutType[] = ["tempo", "threshold"];

type MixBucket = "easy" | "threshold" | "speed";

export function generatePlan(input: GenerateInput): GenerateResult {
  if (!Number.isFinite(input.weeklyKm)) {
    return { ok: false, error: { code: "MISSING_WEEKLY_KM", message: "weeklyKm must be a finite number." } };
  }
  if (input.weeklyKm <= 0) {
    return { ok: false, error: { code: "INVALID_WEEKLY_KM", message: "weeklyKm must be greater than 0." } };
  }
  if (!input.races.some((race) => race.priority === "A")) {
    return { ok: false, error: { code: "NO_A_RACE", message: "At least one A-priority race is required." } };
  }

  const weekDates = [0, 1, 2, 3, 4, 5, 6].map((n) => addUtcDays(input.weekStart, n));
  const weekDateSet = new Set(weekDates);
  const inWeekFrozen = input.frozenUnits
    .filter((unit) => weekDateSet.has(unit.date))
    .map((unit) => ({ ...unit, frozen: true }));

  const occupiedDates = new Set(inWeekFrozen.map((unit) => unit.date));
  const aRace = input.races.find((race) => race.priority === "A");
  const daysToA = aRace === undefined ? Number.POSITIVE_INFINITY : utcDayDiff(aRace.date, input.weekStart);
  const mix = effectiveMix(input, daysToA);
  const skipDates = new Set(
    weekDates.filter((date) => {
      if (occupiedDates.has(date)) {
        return false;
      }
      if (aRace?.date === date) {
        return true;
      }
      return input.restWeekdays.includes(weekdayOf(date));
    }),
  );
  const emptyDates = weekDates.filter((date) => !occupiedDates.has(date) && !skipDates.has(date));
  const frozenKm = inWeekFrozen.reduce((sum, unit) => sum + unit.distanceKm, 0);
  const remainingKm = roundKm(Math.max(0, input.weeklyKm - frozenKm));
  const fillCount = emptyDates.length;
  const perDay = fillCount === 0 ? 0 : roundKm(remainingKm / fillCount);

  const types = assignFillTypes(emptyDates, input, mix, inWeekFrozen);
  const fillUnits: TrainingUnit[] = emptyDates.map((date, index) => {
    const isLast = index === fillCount - 1;
    const distanceKm = isLast ? roundKm(remainingKm - perDay * (fillCount - 1)) : perDay;
    return {
      date,
      type: types[index],
      distanceKm,
      frozen: false,
    };
  });

  const plan: Plan = {
    units: [...inWeekFrozen, ...fillUnits].sort((a, b) => a.date.localeCompare(b.date)),
  };
  const validation = validatePlan(plan, { weeklyKm: input.weeklyKm, frozenUnits: inWeekFrozen });

  if (validation.hard.length > 0) {
    return {
      ok: false,
      error: { code: "UNSATISFIABLE_BOUNDS", message: "In-week frozen anchors already violate hard bounds." },
    };
  }

  return { ok: true, plan, validation };
}

export function defaultGeneratePrefs(): Pick<
  GenerateInput,
  "longWeekdays" | "restWeekdays" | "mixEasy" | "mixThreshold" | "mixSpeed"
> {
  return { ...PROFILE_PREF_DEFAULTS };
}

function effectiveMix(input: GenerateInput, daysToA: number): { easy: number; threshold: number; speed: number } {
  const easy = input.mixEasy;
  const threshold = input.mixThreshold;
  const speed = input.mixSpeed;
  if (daysToA <= 6) {
    return { easy: 100, threshold: 0, speed: 0 };
  }
  if (daysToA <= 20) {
    return { easy: easy + speed, threshold, speed: 0 };
  }
  if (daysToA >= 56 && easy >= 10) {
    return { easy: easy - 10, threshold, speed: speed + 10 };
  }
  return { easy, threshold, speed };
}

function raceOn(races: RaceInput[], date: string, priority: "B" | "C" | "D"): boolean {
  return races.some((race) => race.date === date && race.priority === priority);
}

function previousDateWasLong(date: string, frozen: TrainingUnit[], assigned: Map<string, WorkoutType>): boolean {
  const previous = addUtcDays(date, -1);
  const frozenHit = frozen.find((unit) => unit.date === previous);
  if (frozenHit !== undefined) {
    return frozenHit.type === "long";
  }
  return assigned.get(previous) === "long";
}

function assignFillTypes(
  dates: string[],
  input: GenerateInput,
  mix: { easy: number; threshold: number; speed: number },
  frozen: TrainingUnit[],
): WorkoutType[] {
  const assigned = new Map<string, WorkoutType>();
  const counts: Record<MixBucket, number> = { easy: 0, threshold: 0, speed: 0 };
  let easyIndex = 0;
  let thresholdIndex = 0;

  for (const date of dates) {
    const consecutiveLong = previousDateWasLong(date, frozen, assigned);
    let type: WorkoutType;
    if (input.longWeekdays.includes(weekdayOf(date)) && !consecutiveLong) {
      type = "long";
    } else if (raceOn(input.races, date, "B")) {
      type = "tempo";
    } else if (raceOn(input.races, date, "C")) {
      type = "recovery";
    } else {
      const bucket = pickBucket(mix, counts, dates.length === 0 ? 0 : assigned.size);
      if (bucket === "speed") {
        type = "anaerobic";
      } else if (bucket === "threshold") {
        type = THRESHOLD_ROTATION[thresholdIndex % THRESHOLD_ROTATION.length];
        thresholdIndex += 1;
      } else {
        type = EASY_ROTATION[easyIndex % EASY_ROTATION.length];
        easyIndex += 1;
      }
    }
    assigned.set(date, type);
    counts[bucketOf(type)] += 1;
  }

  return dates.map((date) => assigned.get(date) ?? "base");
}

function bucketOf(type: WorkoutType): MixBucket {
  if (type === "anaerobic") {
    return "speed";
  }
  if (type === "tempo" || type === "threshold") {
    return "threshold";
  }
  return "easy";
}

function pickBucket(
  mix: { easy: number; threshold: number; speed: number },
  counts: Record<MixBucket, number>,
  filled: number,
): MixBucket {
  const targets: Record<MixBucket, number> = {
    easy: mix.easy,
    threshold: mix.threshold,
    speed: mix.speed,
  };
  const candidates = (["easy", "threshold", "speed"] as const).filter((bucket) => targets[bucket] > 0);
  if (candidates.length === 0) {
    return "easy";
  }
  let best: MixBucket = candidates[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const bucket of candidates) {
    const actual = filled === 0 ? 0 : counts[bucket] / filled;
    const score = targets[bucket] / 100 - actual;
    if (score > bestScore) {
      best = bucket;
      bestScore = score;
    }
  }
  return best;
}
