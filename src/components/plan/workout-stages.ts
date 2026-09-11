import type { UnitStage, WorkoutStageKind, WorkoutType } from "@/types";

export type { WorkoutStageKind } from "@/types";

export interface WorkoutStage {
  kind: WorkoutStageKind;
  label: string;
  weight: number;
}

export interface ParseWorkoutStagesInput {
  structure?: string;
  stages?: UnitStage[];
  distanceKm: number;
  type: WorkoutType;
}

const SESSION_PREFIX = /^\s*\d+(?:\.\d+)?\s*km\s*[:—-]\s*/i;

const INTERVAL = /(\d+)\s*[×xX]\s*(\d+(?:\.\d+)?)(?:\s*(km|k|m|meters?|min|minutes?))?/i;

const DISTANCE_KM = /(\d+(?:\.\d+)?)\s*(km|kilometers?|k)\b/i;
const DISTANCE_M = /(\d+(?:\.\d+)?)\s*m(?:eters?)?\b/i;
const DURATION_MIN = /(\d+(?:\.\d+)?)\s*(min|minutes?)\b/i;

const WARMUP = /\b(warm-?up|wu)\b/i;
const COOLDOWN = /\b(cool-?down|cd)\b/i;
const RECOVERY = /\b(recovery|rest|jog)\b/i;
const WORK_HINT = /[×@]|(\btempo\b|\bthreshold\b|\binterval\b|\brepeat\b|\d+\s*[xX]\s*\d)/i;

/** Easy-pace km/min until profile pace estimates exist — see FU-132. */
const MIN_PER_KM = 5;

function unitToKm(amount: number, unit: string | undefined): number {
  const key = (unit ?? "km").toLowerCase();
  if (key === "m" || key.startsWith("meter")) {
    return amount / 1000;
  }
  if (key === "min" || key.startsWith("minute")) {
    return amount / MIN_PER_KM;
  }
  return amount;
}

function clauseWeight(clause: string): number | undefined {
  const interval = INTERVAL.exec(clause);
  if (interval) {
    const repeats = Number(interval[1]);
    const amount = Number(interval[2]);
    return repeats * unitToKm(amount, interval[3]);
  }
  const km = DISTANCE_KM.exec(clause);
  if (km) {
    return unitToKm(Number(km[1]), km[2]);
  }
  const meters = DISTANCE_M.exec(clause);
  if (meters) {
    return unitToKm(Number(meters[1]), "m");
  }
  const minutes = DURATION_MIN.exec(clause);
  if (minutes) {
    return unitToKm(Number(minutes[1]), "min");
  }
  return undefined;
}

export function durationToWeight(duration: string): number {
  const weight = clauseWeight(duration.trim());
  if (weight !== undefined && weight > 0) {
    return weight;
  }
  return 1;
}

export function formatStructureFromStages(stages: UnitStage[]): string {
  return stages
    .map((stage) => {
      const parts: string[] = [];
      const duration = stage.duration.trim();
      if (duration !== "") {
        parts.push(duration);
      }
      const label = stage.label.trim();
      if (label !== "") {
        parts.push(label);
      }
      const target = stage.target.trim();
      if (target !== "") {
        parts.push(`@ ${target}`);
      }
      return parts.join(" ");
    })
    .filter((part) => part !== "")
    .join(", ");
}

function clauseKind(clause: string): WorkoutStageKind | undefined {
  if (WARMUP.test(clause)) {
    return "warmup";
  }
  if (COOLDOWN.test(clause)) {
    return "cooldown";
  }
  if (RECOVERY.test(clause)) {
    return "recovery";
  }
  if (WORK_HINT.test(clause) || clauseWeight(clause) !== undefined) {
    return "work";
  }
  return undefined;
}

function fallbackStage(input: ParseWorkoutStagesInput, structure: string): WorkoutStage {
  const label = structure !== "" ? structure : `${input.distanceKm} km ${input.type}`;
  return { kind: "work", label, weight: Math.max(input.distanceKm, 1) };
}

function stagesFromPersisted(stages: UnitStage[]): WorkoutStage[] {
  return stages.map((stage) => ({
    kind: stage.kind,
    label: stage.label,
    weight: durationToWeight(stage.duration),
  }));
}

export function parseWorkoutStages(input: ParseWorkoutStagesInput): WorkoutStage[] {
  if (input.stages !== undefined && input.stages.length > 0) {
    return stagesFromPersisted(input.stages);
  }

  const raw = input.structure?.trim() ?? "";
  if (raw === "") {
    return [fallbackStage(input, raw)];
  }

  const body = raw.replace(SESSION_PREFIX, "");
  const clauses = body
    .split(",")
    .map((clause) => clause.trim())
    .filter((clause) => clause !== "");

  const stages: WorkoutStage[] = [];
  let sawSignal = false;

  for (const clause of clauses) {
    const kind = clauseKind(clause);
    const weight = clauseWeight(clause);
    if (kind !== undefined || weight !== undefined) {
      sawSignal = true;
    }
    if (kind === undefined) {
      continue;
    }
    stages.push({
      kind,
      label: clause,
      weight: weight !== undefined && weight > 0 ? weight : 1,
    });
  }

  if (!sawSignal || stages.length === 0) {
    return [fallbackStage(input, raw)];
  }

  return stages;
}
