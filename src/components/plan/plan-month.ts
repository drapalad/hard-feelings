import { utcMondayOf, weekDates } from "@/lib/dates";
import { roundKm } from "@/lib/km";
import type { TrainingUnit } from "@/types";

export function weekHasUnits(units: TrainingUnit[], weekStart: string): boolean {
  const window = new Set(weekDates(weekStart));
  return units.some((unit) => window.has(unit.date));
}

export function hasUnitInHorizon(units: TrainingUnit[], from: string, to: string): boolean {
  return units.some((unit) => unit.date >= from && unit.date <= to);
}

export function generatePlanButtonLabel(busy: boolean, hasHorizonUnit: boolean): string {
  if (busy) {
    return "Working...";
  }
  return hasHorizonUnit ? "Regenerate next 14 days" : "Generate next 14 days";
}

export function generateWeekButtonLabel(busy: boolean, hasWeekUnits: boolean): string {
  if (busy) {
    return "Working...";
  }
  return hasWeekUnits ? "Regenerate week" : "Generate week";
}

export function generateHorizonPrompt(from: string, to: string, regenerate: boolean): string {
  if (regenerate) {
    return `Regenerate the next 14 days from ${from} through ${to} (UTC), keeping frozen dates.`;
  }
  return `Lay out the next 14 days from ${from} through ${to} (UTC), keeping frozen dates.`;
}

export function mergeWeekSlice<T extends { date: string }>(current: T[], incoming: T[], weekStart: string): T[] {
  const window = new Set(weekDates(weekStart));
  const kept = current.filter((item) => !window.has(item.date));
  const nextWeek = incoming.filter((item) => window.has(item.date));
  return [...kept, ...nextWeek].sort((left, right) => left.date.localeCompare(right.date));
}

export function mergeReturnedUnits<T extends { date: string }>(
  current: T[],
  incoming: T[],
  requestWeekStart: string,
): T[] {
  const mondays = new Set<string>();
  for (const item of incoming) {
    mondays.add(utcMondayOf(item.date));
  }
  if (mondays.size === 0) {
    mondays.add(requestWeekStart);
  }
  let next = current;
  for (const monday of mondays) {
    next = mergeWeekSlice(next, incoming, monday);
  }
  return next;
}

export function mergeItemByDate<T extends { date: string }>(current: T[], item: T): T[] {
  const kept = current.filter((row) => row.date !== item.date);
  return [...kept, item].sort((left, right) => left.date.localeCompare(right.date));
}

export function formatCompactKm(km: number): string {
  const rounded = roundKm(km);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function unitsMatch(left: TrainingUnit, right: TrainingUnit): boolean {
  return (
    left.date === right.date &&
    left.type === right.type &&
    left.distanceKm === right.distanceKm &&
    left.frozen === right.frozen &&
    (left.structure ?? undefined) === (right.structure ?? undefined)
  );
}

export function weekUnitsEqual(left: TrainingUnit[], right: TrainingUnit[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightByDate = new Map(right.map((unit) => [unit.date, unit]));
  return left.every((unit) => {
    const other = rightByDate.get(unit.date);
    return other !== undefined && unitsMatch(unit, other);
  });
}

export function unitsInWeek<T extends { date: string }>(units: T[], weekStart: string): T[] {
  const window = new Set(weekDates(weekStart));
  return units.filter((unit) => window.has(unit.date));
}
