import { addUtcDays, utcMondayOf } from "@/lib/dates";
import { roundKm } from "@/lib/km";
import type { TrainingUnit, WorkoutLog, WorkoutType } from "@/types";

export type LoadBucket = "easy" | "threshold" | "speed";

export interface LoadWeek {
  weekStart: string;
  easy: number;
  threshold: number;
  speed: number;
}

export interface ChartWindow {
  from: string;
  to: string;
  weekStarts: string[];
}

export interface DayLoad {
  bucket: LoadBucket;
  distanceKm: number;
}

const WEEK_OFFSETS = [-5, -4, -3, -2, -1, 0, 1, 2] as const;

const BUCKET_BY_TYPE: Record<WorkoutType, LoadBucket> = {
  base: "easy",
  recovery: "easy",
  long: "easy",
  tempo: "threshold",
  threshold: "threshold",
  anaerobic: "speed",
};

export function loadChartWindow(today: string): ChartWindow {
  const current = utcMondayOf(today);
  const weekStarts = WEEK_OFFSETS.map((offset) => addUtcDays(current, offset * 7));
  const from = weekStarts[0] ?? current;
  const lastMonday = weekStarts[weekStarts.length - 1] ?? current;
  return { from, to: addUtcDays(lastMonday, 6), weekStarts };
}

export function bucketWorkoutType(type: WorkoutType): LoadBucket {
  return BUCKET_BY_TYPE[type];
}

export function pickDayLoad(
  date: string,
  today: string,
  unit: TrainingUnit | undefined,
  log: WorkoutLog | undefined,
): DayLoad | null {
  const source = date < today ? (log ?? unit) : unit;
  if (source === undefined) {
    return null;
  }
  return { bucket: bucketWorkoutType(source.type), distanceKm: source.distanceKm };
}

export const DECAY_FACTOR = 0.85;

export interface DailyLoadEntry {
  date: string;
  easy: number;
  threshold: number;
  speed: number;
}

export function nextDailyLoad(
  prev: { easy: number; threshold: number; speed: number },
  todayKm: { easy: number; threshold: number; speed: number },
): { easy: number; threshold: number; speed: number } {
  return {
    easy: prev.easy * DECAY_FACTOR + todayKm.easy,
    threshold: prev.threshold * DECAY_FACTOR + todayKm.threshold,
    speed: prev.speed * DECAY_FACTOR + todayKm.speed,
  };
}

export function aggregateDailyLoad(units: TrainingUnit[], logs: WorkoutLog[], today: string): DailyLoadEntry[] {
  const window = loadChartWindow(today);
  const unitsByDate = new Map(units.map((unit) => [unit.date, unit]));
  const logsByDate = new Map(logs.map((log) => [log.date, log]));

  const entries: DailyLoadEntry[] = [];
  let prev = { easy: 0, threshold: 0, speed: 0 };

  for (let date = window.from; date <= window.to; date = addUtcDays(date, 1)) {
    const picked = pickDayLoad(date, today, unitsByDate.get(date), logsByDate.get(date));
    const km = { easy: 0, threshold: 0, speed: 0 };
    if (picked !== null) {
      km[picked.bucket] = picked.distanceKm;
    }
    prev = nextDailyLoad(prev, km);
    entries.push({
      date,
      easy: roundKm(prev.easy),
      threshold: roundKm(prev.threshold),
      speed: roundKm(prev.speed),
    });
  }

  return entries;
}

export function aggregateLoadWeeks(units: TrainingUnit[], logs: WorkoutLog[], today: string): LoadWeek[] {
  const window = loadChartWindow(today);
  const unitsByDate = new Map(units.map((unit) => [unit.date, unit]));
  const logsByDate = new Map(logs.map((log) => [log.date, log]));
  const totals = new Map(window.weekStarts.map((weekStart) => [weekStart, { easy: 0, threshold: 0, speed: 0 }]));

  for (let date = window.from; date <= window.to; date = addUtcDays(date, 1)) {
    const picked = pickDayLoad(date, today, unitsByDate.get(date), logsByDate.get(date));
    if (picked === null) {
      continue;
    }
    const week = totals.get(utcMondayOf(date));
    if (week === undefined) {
      continue;
    }
    week[picked.bucket] += picked.distanceKm;
  }

  return window.weekStarts.map((weekStart) => {
    const week = totals.get(weekStart) ?? { easy: 0, threshold: 0, speed: 0 };
    return {
      weekStart,
      easy: roundKm(week.easy),
      threshold: roundKm(week.threshold),
      speed: roundKm(week.speed),
    };
  });
}
