import type { BoundViolation, Plan, TrainingUnit, ValidateResult } from "@/types";
import { roundKm } from "@/lib/km";

const MS_PER_DAY = 86_400_000;

export function validatePlan(plan: Plan, context: { weeklyKm: number; frozenUnits: TrainingUnit[] }): ValidateResult {
  const hard: BoundViolation[] = [];
  const soft: BoundViolation[] = [];

  const totalKm = roundKm(plan.units.reduce((sum, unit) => sum + unit.distanceKm, 0));
  const weeklyKm = roundKm(context.weeklyKm);
  const hardCeiling = roundKm(context.weeklyKm * 1.2);

  if (totalKm > hardCeiling) {
    hard.push({
      code: "WEEKLY_VOLUME_EXCEEDED",
      severity: "hard",
      message: `Weekly volume ${totalKm} km exceeds the hard ceiling of ${hardCeiling} km.`,
    });
  } else if (totalKm > weeklyKm) {
    soft.push({
      code: "WEEKLY_VOLUME_EXCEEDED",
      severity: "soft",
      message: `Weekly volume ${totalKm} km is over the ${weeklyKm} km target (up to ${hardCeiling} km is a soft warning).`,
    });
  }

  const longDates = uniqueSortedDates(plan.units.filter((unit) => unit.type === "long").map((unit) => unit.date));

  for (let i = 0; i < longDates.length - 1; i++) {
    const earlier = longDates[i];
    const later = longDates[i + 1];
    if (utcDayNumber(later) - utcDayNumber(earlier) === 1) {
      hard.push({
        code: "CONSECUTIVE_LONGS",
        severity: "hard",
        message: `Long workouts fall on consecutive days (${earlier}, ${later}).`,
        dates: [earlier, later],
      });
    }
  }

  for (const anchor of context.frozenUnits) {
    const preserved = plan.units.some(
      (unit) =>
        unit.date === anchor.date && unit.type === anchor.type && unit.distanceKm === anchor.distanceKm && unit.frozen,
    );
    if (!preserved) {
      hard.push({
        code: "FROZEN_ANCHOR_DROPPED",
        severity: "hard",
        message: `Frozen unit on ${anchor.date} is missing or mutated.`,
        dates: [anchor.date],
      });
    }
  }

  return { hard, soft };
}

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => utcDayNumber(a) - utcDayNumber(b));
}

function utcDayNumber(isoDate: string): number {
  const [yearText, monthText, dayText] = isoDate.split("-");
  return Math.trunc(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)) / MS_PER_DAY);
}
