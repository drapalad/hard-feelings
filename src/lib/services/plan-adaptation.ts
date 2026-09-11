import { validatePlan } from "./validate-plan";
import { utcMondayOf } from "@/lib/dates";
import type { Plan, PlanDiffEntry, TrainingUnit, UnitMutation, UnitStage, ValidateResult } from "@/types";

export type AcceptGate = { ok: true; validation: ValidateResult } | { ok: false; validation: ValidateResult };

export function applyMutations(
  units: TrainingUnit[],
  mutations: UnitMutation[],
  options?: { skipFrozen?: boolean },
): Plan {
  const skipFrozen = options?.skipFrozen !== false;
  const byDate = new Map(units.map((unit) => [unit.date, unit]));

  for (const mutation of mutations) {
    const existing = byDate.get(mutation.date);
    if (skipFrozen && existing?.frozen) {
      continue;
    }
    if (mutation.delete === true) {
      if (existing !== undefined) {
        byDate.delete(mutation.date);
      }
      continue;
    }
    if (existing === undefined) {
      if (mutation.type === undefined || mutation.distanceKm === undefined) {
        continue;
      }
      const created: TrainingUnit = {
        date: mutation.date,
        type: mutation.type,
        distanceKm: mutation.distanceKm,
        frozen: false,
      };
      if (mutation.structure !== undefined && mutation.structure !== "") {
        created.structure = mutation.structure;
      }
      assignStages(created, resolvedStages(mutation.stages, undefined));
      byDate.set(mutation.date, created);
      continue;
    }
    const next: TrainingUnit = {
      date: existing.date,
      type: mutation.type ?? existing.type,
      distanceKm: mutation.distanceKm ?? existing.distanceKm,
      frozen: existing.frozen,
    };
    const structure = mutation.structure ?? existing.structure;
    if (structure !== undefined && structure !== "") {
      next.structure = structure;
    }
    assignStages(next, resolvedStages(mutation.stages, existing.stages));
    byDate.set(mutation.date, next);
  }

  return {
    units: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function diffUnits(current: TrainingUnit[], proposed: TrainingUnit[]): PlanDiffEntry[] {
  const currentByDate = new Map(current.map((unit) => [unit.date, unit]));
  const proposedByDate = new Map(proposed.map((unit) => [unit.date, unit]));
  const dates = [...new Set([...currentByDate.keys(), ...proposedByDate.keys()])].sort((a, b) => a.localeCompare(b));

  return dates.flatMap((date) => {
    const before = currentByDate.get(date) ?? null;
    const after = proposedByDate.get(date) ?? null;
    if (unitsEqual(before, after)) {
      return [];
    }
    return [{ date, before, after }];
  });
}

export function gateAccept(plan: Plan, weeklyKm: number, frozenUnits: TrainingUnit[]): AcceptGate {
  const validation = validatePlan(plan, { weeklyKm, frozenUnits });
  if (validation.hard.length === 0) {
    return { ok: true, validation };
  }
  return { ok: false, validation };
}

export function gateByIsoWeek(units: TrainingUnit[], weeklyKm: number, frozenUnits: TrainingUnit[]): AcceptGate {
  const groups = groupByMonday(units);
  const frozenGroups = groupByMonday(frozenUnits);
  const hard: ValidateResult["hard"] = [];
  const soft: ValidateResult["soft"] = [];
  for (const [monday, group] of groups) {
    const gated = gateAccept({ units: group }, weeklyKm, frozenGroups.get(monday) ?? []);
    hard.push(...gated.validation.hard);
    soft.push(...gated.validation.soft);
  }
  const validation = { hard, soft };
  if (hard.length === 0) {
    return { ok: true, validation };
  }
  return { ok: false, validation };
}

function groupByMonday(units: TrainingUnit[]): Map<string, TrainingUnit[]> {
  const groups = new Map<string, TrainingUnit[]>();
  for (const unit of units) {
    const monday = utcMondayOf(unit.date);
    const group = groups.get(monday);
    if (group === undefined) {
      groups.set(monday, [unit]);
    } else {
      group.push(unit);
    }
  }
  return groups;
}

function unitsEqual(left: TrainingUnit | null, right: TrainingUnit | null): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return (
    left.date === right.date &&
    left.type === right.type &&
    left.distanceKm === right.distanceKm &&
    left.frozen === right.frozen &&
    (left.structure ?? undefined) === (right.structure ?? undefined) &&
    stagesKey(left.stages) === stagesKey(right.stages)
  );
}

function stagesKey(stages: UnitStage[] | undefined): string {
  if (stages === undefined || stages.length === 0) {
    return "";
  }
  return JSON.stringify(stages);
}

function resolvedStages(
  mutationStages: UnitStage[] | null | undefined,
  existingStages: UnitStage[] | undefined,
): UnitStage[] | undefined {
  if (mutationStages === undefined) {
    return existingStages;
  }
  if (mutationStages === null || mutationStages.length === 0) {
    return undefined;
  }
  return mutationStages;
}

function assignStages(unit: TrainingUnit, stages: UnitStage[] | undefined): void {
  if (stages !== undefined && stages.length > 0) {
    unit.stages = stages;
  }
}
