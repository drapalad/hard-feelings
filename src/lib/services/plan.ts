import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { utcMondayOf, utcToday, weekDates, inclusiveIsoDates } from "@/lib/dates";
import { defaultGeneratePrefs, generatePlan } from "./generate-plan";
import { applyMutations } from "./plan-adaptation";
import { getProfile } from "./profile";
import { listRaces } from "./races";
import { validatePlan } from "./validate-plan";
import {
  toRaceInput,
  type GenerateInput,
  type GenerateResult,
  type PlanRevisionSummary,
  type Race,
  type TrainingUnit,
  type UnitMutation,
  type UnitStage,
  type ValidateResult,
  type WorkoutType,
} from "@/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const WORKOUT_TYPES: WorkoutType[] = ["base", "recovery", "tempo", "threshold", "anaerobic", "long"];

const WORKOUT_STAGE_KINDS = ["warmup", "work", "recovery", "cooldown"] as const;

const UNIT_COLUMNS = "date, type, distance_km, structure, stages, frozen";

export const weekStartSchema = z.string().regex(ISO_DATE, { message: "date must be YYYY-MM-DD" });

export const MAX_PLAN_GET_RANGE_DAYS = 56;

export const unitStageSchema = z.object({
  kind: z.enum(WORKOUT_STAGE_KINDS),
  label: z.string().max(100),
  duration: z.string().max(100),
  target: z.string().max(100),
});

export const unitStagesSchema = z.array(unitStageSchema).max(20);

export const freezeWriteSchema = z.object({
  date: weekStartSchema,
  frozen: z.boolean(),
});

export const generateBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
});

export const restoreBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
  revisionId: z.uuid(),
});

export const snapshotBodySchema = z.object({
  weekStart: weekStartSchema.optional(),
});

export const unitEditSchema = z.object({
  date: weekStartSchema,
  type: z.enum(["base", "recovery", "tempo", "threshold", "anaerobic", "long"]),
  distanceKm: z.number().nonnegative(),
  structure: z.string().max(500).nullable().optional(),
  stages: unitStagesSchema.nullable().optional(),
});

export interface UnitEditPatch {
  type: WorkoutType;
  distanceKm: number;
  structure?: string | null;
  stages?: UnitStage[] | null;
}

export type ApplyUnitEditResult =
  | { ok: false; code: "NOT_FOUND" }
  | { ok: true; units: TrainingUnit[]; changed: boolean };

function stagesKey(stages: UnitStage[] | undefined): string {
  if (stages === undefined || stages.length === 0) {
    return "";
  }
  return JSON.stringify(stages);
}

function unitsMatch(left: TrainingUnit, right: TrainingUnit): boolean {
  return (
    left.date === right.date &&
    left.type === right.type &&
    left.distanceKm === right.distanceKm &&
    left.frozen === right.frozen &&
    (left.structure ?? undefined) === (right.structure ?? undefined) &&
    stagesKey(left.stages) === stagesKey(right.stages)
  );
}

function weeksEqual(left: TrainingUnit[], right: TrainingUnit[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightByDate = new Map(right.map((unit) => [unit.date, unit]));
  return left.every((unit) => {
    const other = rightByDate.get(unit.date);
    return other !== undefined && unitsMatch(unit, other);
  });
}

export function applyUnitEdit(units: TrainingUnit[], date: string, patch: UnitEditPatch): ApplyUnitEditResult {
  if (!units.some((unit) => unit.date === date)) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const mutation: UnitMutation = { date, type: patch.type, distanceKm: patch.distanceKm };
  if (patch.structure !== undefined) {
    mutation.structure = patch.structure ?? "";
  }
  if (patch.stages !== undefined) {
    mutation.stages = patch.stages === null || patch.stages.length === 0 ? null : patch.stages;
  }
  const next = applyMutations(units, [mutation], { skipFrozen: false }).units;
  return { ok: true, units: next, changed: !weeksEqual(units, next) };
}

export type ResolveWeekStart = { ok: true; weekStart: string } | { ok: false };

export function resolveWeekStart(raw: string | undefined | null): ResolveWeekStart {
  if (raw === undefined || raw === null) {
    return { ok: true, weekStart: utcMondayOf(utcToday()) };
  }
  const parsed = weekStartSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false };
  }
  return { ok: true, weekStart: utcMondayOf(parsed.data) };
}

export type ResolvePlanRange =
  | { ok: true; kind: "week" }
  | { ok: true; kind: "range"; from: string; to: string }
  | { ok: false };

export function resolvePlanRange(fromRaw: string | null, toRaw: string | null): ResolvePlanRange {
  if (fromRaw === null && toRaw === null) {
    return { ok: true, kind: "week" };
  }
  if (fromRaw === null || toRaw === null) {
    return { ok: false };
  }
  const fromParsed = weekStartSchema.safeParse(fromRaw);
  const toParsed = weekStartSchema.safeParse(toRaw);
  if (!fromParsed.success || !toParsed.success) {
    return { ok: false };
  }
  const from = fromParsed.data;
  const to = toParsed.data;
  if (from > to) {
    return { ok: false };
  }
  const dates = inclusiveIsoDates(from, to);
  if (dates.length > MAX_PLAN_GET_RANGE_DAYS) {
    return { ok: false };
  }
  return { ok: true, kind: "range", from, to };
}

export type FrozenUpdateResult =
  | { ok: true; unit: TrainingUnit }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

export interface TrainingUnitRow {
  date: string;
  type: string;
  distance_km: number | string;
  structure: string | null;
  stages: UnitStage[] | null;
  frozen: boolean;
}

function isWorkoutType(value: unknown): value is WorkoutType {
  return typeof value === "string" && WORKOUT_TYPES.includes(value as WorkoutType);
}

function parseDistanceKm(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function omitEmpty(value: string | null | undefined): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return value;
}

function parseRowStages(value: unknown): UnitStage[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = unitStagesSchema.safeParse(value);
  if (!parsed.success || parsed.data.length === 0) {
    return undefined;
  }
  return parsed.data;
}

export function toTrainingUnit(row: TrainingUnitRow): TrainingUnit | null {
  if (!isWorkoutType(row.type)) {
    return null;
  }
  const distanceKm = parseDistanceKm(row.distance_km);
  if (distanceKm === null) {
    return null;
  }
  const unit: TrainingUnit = {
    date: row.date,
    type: row.type,
    distanceKm,
    frozen: row.frozen,
  };
  const structure = omitEmpty(row.structure);
  if (structure !== undefined) {
    unit.structure = structure;
  }
  const stages = parseRowStages(row.stages);
  if (stages !== undefined) {
    unit.stages = stages;
  }
  return unit;
}

export function toTrainingUnitRow(unit: TrainingUnit): TrainingUnitRow {
  return {
    date: unit.date,
    type: unit.type,
    distance_km: unit.distanceKm,
    structure: unit.structure ?? null,
    stages: unit.stages ?? null,
    frozen: unit.frozen,
  };
}

export function buildGenerateInput(args: {
  weeklyKm: number | null;
  races: Race[];
  frozenUnits: TrainingUnit[];
  weekStart: string;
  longWeekdays?: GenerateInput["longWeekdays"];
  restWeekdays?: GenerateInput["restWeekdays"];
  mixEasy?: number;
  mixThreshold?: number;
  mixSpeed?: number;
}): GenerateInput {
  const prefs = defaultGeneratePrefs();
  return {
    weeklyKm: args.weeklyKm ?? Number.NaN,
    races: args.races.map(toRaceInput),
    frozenUnits: args.frozenUnits,
    weekStart: args.weekStart,
    longWeekdays: args.longWeekdays ?? prefs.longWeekdays,
    restWeekdays: args.restWeekdays ?? prefs.restWeekdays,
    mixEasy: args.mixEasy ?? prefs.mixEasy,
    mixThreshold: args.mixThreshold ?? prefs.mixThreshold,
    mixSpeed: args.mixSpeed ?? prefs.mixSpeed,
  };
}

function asTrainingUnitRow(data: unknown): TrainingUnitRow | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("date" in data) || !("type" in data) || !("distance_km" in data) || !("frozen" in data)) {
    return null;
  }
  if (typeof data.date !== "string" || typeof data.type !== "string" || typeof data.frozen !== "boolean") {
    return null;
  }
  const distanceKm = data.distance_km;
  if (typeof distanceKm !== "number" && typeof distanceKm !== "string") {
    return null;
  }
  const structure =
    "structure" in data && (typeof data.structure === "string" || data.structure === null) ? data.structure : null;
  const stages = parseRowStages("stages" in data ? data.stages : undefined) ?? null;
  return { date: data.date, type: data.type, distance_km: distanceKm, structure, stages, frozen: data.frozen };
}

function asUnitList(data: unknown): TrainingUnit[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const mapped = asTrainingUnitRow(row);
    const unit = mapped === null ? null : toTrainingUnit(mapped);
    return unit === null ? [] : [unit];
  });
}

export async function listRange(
  client: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<TrainingUnit[]> {
  const dates = inclusiveIsoDates(from, to);
  if (dates.length === 0) {
    return [];
  }
  const { data, error } = await client
    .from("training_units")
    .select(UNIT_COLUMNS)
    .eq("user_id", userId)
    .in("date", dates)
    .order("date");
  if (error) {
    throw new Error(error.message);
  }
  return asUnitList(data);
}

export async function listWeek(client: SupabaseClient, userId: string, weekStart: string): Promise<TrainingUnit[]> {
  const dates = weekDates(weekStart);
  return listRange(client, userId, dates[0], dates[6]);
}

export async function replaceWeek(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  units: TrainingUnit[],
): Promise<void> {
  const window = new Set(weekDates(weekStart));
  const rows = units
    .filter((unit) => window.has(unit.date))
    .map((unit) => ({
      user_id: userId,
      ...toTrainingUnitRow(unit),
    }));
  const { error } = await client.from("training_units").upsert(rows, { onConflict: "user_id,date" });
  if (error) {
    throw new Error(error.message);
  }
  const incomingDates = new Set(rows.map((row) => row.date));
  const leftover = weekDates(weekStart).filter((date) => !incomingDates.has(date));
  if (leftover.length === 0) {
    return;
  }
  const { error: deleteError } = await client
    .from("training_units")
    .delete()
    .eq("user_id", userId)
    .in("date", leftover);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function setFrozen(
  client: SupabaseClient,
  userId: string,
  date: string,
  frozen: boolean,
): Promise<FrozenUpdateResult> {
  const { data, error } = await client
    .from("training_units")
    .update({ frozen })
    .eq("user_id", userId)
    .eq("date", date)
    .select(UNIT_COLUMNS)
    .maybeSingle();
  if (error) {
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  const mapped = asTrainingUnitRow(data);
  const unit = mapped === null ? null : toTrainingUnit(mapped);
  if (unit === null) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } };
  }
  return { ok: true, unit };
}

export async function generateAndPersist(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<GenerateResult> {
  const monday = utcMondayOf(weekStart);
  const profile = await getProfile(client, userId);
  const races = await listRaces(client, userId);
  const week = await listWeek(client, userId, monday);
  const result = generatePlan(
    buildGenerateInput({
      weeklyKm: profile.weeklyKm,
      races,
      frozenUnits: week.filter((unit) => unit.frozen),
      weekStart: monday,
      longWeekdays: profile.longWeekdays,
      restWeekdays: profile.restWeekdays,
      mixEasy: profile.mixEasy,
      mixThreshold: profile.mixThreshold,
      mixSpeed: profile.mixSpeed,
    }),
  );
  if (!result.ok) {
    return result;
  }
  await replaceWeek(client, userId, monday, result.plan.units);
  return result;
}

const EMPTY_VALIDATION: ValidateResult = { hard: [], soft: [] };
const REVISION_CAP = 10;

export type EditUnitResult =
  | {
      ok: true;
      unit: TrainingUnit;
      units: TrainingUnit[];
      validation: ValidateResult;
      undoAvailable: boolean;
      changed: boolean;
    }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

export type UndoWeekResult =
  | { ok: true; units: TrainingUnit[]; undoAvailable: boolean }
  | { ok: false; error: { code: "NOTHING_TO_UNDO" | "DB_ERROR"; message: string } };

export type RestoreWeekResult =
  | { ok: true; units: TrainingUnit[]; undoAvailable: boolean; revisions: PlanRevisionSummary[] }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

export type SnapshotWeekResult =
  | { ok: true; weekStart: string; revisions: PlanRevisionSummary[]; undoAvailable: boolean }
  | { ok: false; error: { code: "DB_ERROR"; message: string } };

export async function snapshotCurrentWeek(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<SnapshotWeekResult> {
  const monday = utcMondayOf(weekStart);
  try {
    const current = await listWeek(client, userId, monday);
    await insertRevision(client, userId, monday, current);
    await trimRevisions(client, userId, monday);
    const stack = await readRevisionStack(client, userId, monday);
    return {
      ok: true,
      weekStart: monday,
      revisions: stack.revisions,
      undoAvailable: stack.undoAvailable,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save snapshot";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export async function readLatestRevisionUnits(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<TrainingUnit[] | null> {
  const monday = utcMondayOf(weekStart);
  const { data, error } = await client
    .from("plan_revisions")
    .select("units")
    .eq("user_id", userId)
    .eq("week_start", monday)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data === null || typeof data !== "object" || !("units" in data)) {
    return null;
  }
  return parseDtoUnits(data.units);
}

export async function snapshotWeekIfChanged(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  current: TrainingUnit[],
  next: TrainingUnit[],
): Promise<void> {
  const monday = utcMondayOf(weekStart);
  if (weeksEqual(current, next)) {
    return;
  }
  try {
    await insertRevision(client, userId, monday, current);
    await trimRevisions(client, userId, monday);
  } catch {
    // Missing plan_revisions must not fail the persist that follows.
  }
}

export async function hasRevision(client: SupabaseClient, userId: string, weekStart: string): Promise<boolean> {
  const monday = utcMondayOf(weekStart);
  const { count, error } = await client
    .from("plan_revisions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("week_start", monday);
  if (error) {
    throw new Error(error.message);
  }
  return (count ?? 0) > 0;
}

export async function listRevisions(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<PlanRevisionSummary[]> {
  const monday = utcMondayOf(weekStart);
  const { data, error } = await client
    .from("plan_revisions")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("week_start", monday)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const summary = asRevisionSummary(row);
    return summary === null ? [] : [summary];
  });
}

export async function readRevisionStack(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
): Promise<{ undoAvailable: boolean; revisions: PlanRevisionSummary[] }> {
  try {
    const revisions = await listRevisions(client, userId, weekStart);
    return { undoAvailable: revisions.length > 0, revisions };
  } catch {
    return { undoAvailable: false, revisions: [] };
  }
}

export async function restoreWeek(
  client: SupabaseClient,
  userId: string,
  weekStart: string,
  revisionId: string,
): Promise<RestoreWeekResult> {
  const monday = utcMondayOf(weekStart);
  try {
    const { data, error } = await client
      .from("plan_revisions")
      .select("id, units")
      .eq("id", revisionId)
      .eq("user_id", userId)
      .eq("week_start", monday)
      .maybeSingle();
    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }
    if (data === null || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
      return { ok: false, error: { code: "NOT_FOUND", message: "Revision not found" } };
    }
    const units = parseDtoUnits(data.units);
    if (units === null) {
      return { ok: false, error: { code: "DB_ERROR", message: "Stored revision is invalid." } };
    }
    const current = await listWeek(client, userId, monday);
    await snapshotWeekIfChanged(client, userId, monday, current, units);
    await replaceWeek(client, userId, monday, units);
    const stack = await readRevisionStack(client, userId, monday);
    return { ok: true, units, undoAvailable: stack.undoAvailable, revisions: stack.revisions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore week";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export async function editUnit(
  client: SupabaseClient,
  userId: string,
  patch: { date: string } & UnitEditPatch,
): Promise<EditUnitResult> {
  const monday = utcMondayOf(patch.date);
  try {
    const current = await listWeek(client, userId, monday);
    const applied = applyUnitEdit(current, patch.date, {
      type: patch.type,
      distanceKm: patch.distanceKm,
      structure: patch.structure,
      stages: patch.stages,
    });
    if (!applied.ok) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } };
    }
    const nextUnit = applied.units.find((unit) => unit.date === patch.date);
    if (nextUnit === undefined) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } };
    }
    if (applied.changed) {
      const { data, error } = await client
        .from("training_units")
        .update({
          type: nextUnit.type,
          distance_km: nextUnit.distanceKm,
          structure: nextUnit.structure ?? null,
          stages: nextUnit.stages ?? null,
        })
        .eq("user_id", userId)
        .eq("date", patch.date)
        .select(UNIT_COLUMNS)
        .maybeSingle();
      if (error) {
        return { ok: false, error: { code: "DB_ERROR", message: error.message } };
      }
      const mapped = asTrainingUnitRow(data);
      const saved = mapped === null ? null : toTrainingUnit(mapped);
      if (saved === null) {
        return { ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } };
      }
    }
    let validation = EMPTY_VALIDATION;
    let undoAvailable = applied.changed;
    try {
      validation = await validationForWeek(client, userId, applied.units);
    } catch {
      validation = EMPTY_VALIDATION;
    }
    try {
      undoAvailable = await hasRevision(client, userId, monday);
    } catch {
      undoAvailable = applied.changed;
    }
    return {
      ok: true,
      unit: nextUnit,
      units: applied.units,
      validation,
      undoAvailable,
      changed: applied.changed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit unit";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export type DeleteUnitResult =
  | {
      ok: true;
      units: TrainingUnit[];
      validation: ValidateResult;
      undoAvailable: boolean;
      changed: boolean;
    }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

export async function deleteUnit(client: SupabaseClient, userId: string, date: string): Promise<DeleteUnitResult> {
  const monday = utcMondayOf(date);
  try {
    const current = await listWeek(client, userId, monday);
    if (!current.some((unit) => unit.date === date)) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Unit not found" } };
    }
    const next = applyMutations(current, [{ date, delete: true }], { skipFrozen: false }).units;
    const changed = !weeksEqual(current, next);
    if (changed) {
      await replaceWeek(client, userId, monday, next);
    }
    let validation = EMPTY_VALIDATION;
    let undoAvailable = changed;
    try {
      validation = await validationForWeek(client, userId, next);
    } catch {
      validation = EMPTY_VALIDATION;
    }
    try {
      undoAvailable = await hasRevision(client, userId, monday);
    } catch {
      undoAvailable = changed;
    }
    return { ok: true, units: next, validation, undoAvailable, changed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete unit";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

export async function undoWeek(client: SupabaseClient, userId: string, weekStart: string): Promise<UndoWeekResult> {
  const monday = utcMondayOf(weekStart);
  try {
    const { data, error } = await client
      .from("plan_revisions")
      .select("id, units")
      .eq("user_id", userId)
      .eq("week_start", monday)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return { ok: false, error: { code: "DB_ERROR", message: error.message } };
    }
    if (data === null || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
      return { ok: false, error: { code: "NOTHING_TO_UNDO", message: "Nothing to undo" } };
    }
    const units = parseDtoUnits(data.units);
    if (units === null) {
      return { ok: false, error: { code: "DB_ERROR", message: "Stored revision is invalid." } };
    }
    await replaceWeek(client, userId, monday, units);
    const { error: deleteError } = await client.from("plan_revisions").delete().eq("id", data.id).eq("user_id", userId);
    if (deleteError) {
      return { ok: false, error: { code: "DB_ERROR", message: deleteError.message } };
    }
    let undoAvailable = false;
    try {
      undoAvailable = await hasRevision(client, userId, monday);
    } catch {
      undoAvailable = false;
    }
    return { ok: true, units, undoAvailable };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo week";
    return { ok: false, error: { code: "DB_ERROR", message } };
  }
}

async function validationForWeek(
  client: SupabaseClient,
  userId: string,
  units: TrainingUnit[],
): Promise<ValidateResult> {
  const profile = await getProfile(client, userId);
  if (profile.weeklyKm === null || profile.weeklyKm <= 0) {
    return EMPTY_VALIDATION;
  }
  return validatePlan({ units }, { weeklyKm: profile.weeklyKm, frozenUnits: units.filter((unit) => unit.frozen) });
}

async function insertRevision(
  client: SupabaseClient,
  userId: string,
  monday: string,
  units: TrainingUnit[],
): Promise<void> {
  const { error } = await client.from("plan_revisions").insert({
    user_id: userId,
    week_start: monday,
    units,
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function trimRevisions(client: SupabaseClient, userId: string, monday: string): Promise<void> {
  const { data, error } = await client
    .from("plan_revisions")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", monday)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  if (data.length <= REVISION_CAP) {
    return;
  }
  const extra: string[] = [];
  for (const row of data.slice(REVISION_CAP)) {
    if (typeof row.id === "string") {
      extra.push(row.id);
    }
  }
  if (extra.length === 0) {
    return;
  }
  const { error: deleteError } = await client.from("plan_revisions").delete().in("id", extra).eq("user_id", userId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

function asRevisionSummary(data: unknown): PlanRevisionSummary | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("id" in data) || !("created_at" in data)) {
    return null;
  }
  if (typeof data.id !== "string" || typeof data.created_at !== "string") {
    return null;
  }
  return { id: data.id, createdAt: data.created_at };
}

function parseDtoUnits(value: unknown): TrainingUnit[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const units: TrainingUnit[] = [];
  for (const item of value) {
    const unit = asDtoTrainingUnit(item);
    if (unit === null) {
      return null;
    }
    units.push(unit);
  }
  return units;
}

function asDtoTrainingUnit(data: unknown): TrainingUnit | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("date" in data) || !("type" in data) || !("distanceKm" in data) || !("frozen" in data)) {
    return null;
  }
  if (typeof data.date !== "string" || typeof data.frozen !== "boolean") {
    return null;
  }
  if (typeof data.type !== "string" || !WORKOUT_TYPES.includes(data.type as WorkoutType)) {
    return null;
  }
  if (typeof data.distanceKm !== "number" || !Number.isFinite(data.distanceKm)) {
    return null;
  }
  const unit: TrainingUnit = {
    date: data.date,
    type: data.type as WorkoutType,
    distanceKm: data.distanceKm,
    frozen: data.frozen,
  };
  if ("structure" in data && typeof data.structure === "string" && data.structure !== "") {
    unit.structure = data.structure;
  }
  const stages = parseRowStages("stages" in data ? data.stages : undefined);
  if (stages !== undefined) {
    unit.stages = stages;
  }
  return unit;
}
