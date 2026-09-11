import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { utcMondayOf, weekDates, inclusiveIsoDates } from "@/lib/dates";
import { weekStartSchema } from "./plan";
import type { TrainingUnit, WorkoutLog, WorkoutType } from "@/types";

const WORKOUT_TYPES: WorkoutType[] = ["base", "recovery", "tempo", "threshold", "anaerobic", "long"];

const LOG_COLUMNS = "date, type, distance_km, avg_pace_sec_per_km, avg_hr";

export const workoutLogWriteSchema = z.object({
  date: weekStartSchema,
  distanceKm: z.number().nonnegative().optional(),
  avgPaceSecPerKm: z.number().int().min(120).max(900).optional(),
  avgHr: z.number().int().min(60).max(220).optional(),
});

export const workoutLogDateSchema = z.object({
  date: weekStartSchema,
});

export type ResolveWorkoutLogResult = { ok: false; code: "NOT_FOUND" } | { ok: true; log: WorkoutLog };

export type UpsertLogResult =
  | { ok: true; log: WorkoutLog; logs: WorkoutLog[] }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

export type DeleteLogResult =
  | { ok: true; logs: WorkoutLog[] }
  | { ok: false; error: { code: "NOT_FOUND" | "DB_ERROR"; message: string } };

interface WorkoutLogRow {
  date: string;
  type: string;
  distance_km: number | string;
  avg_pace_sec_per_km: number | string | null;
  avg_hr: number | string | null;
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

function parseOptionalInt(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return undefined;
}

function toWorkoutLog(row: WorkoutLogRow): WorkoutLog | null {
  if (!isWorkoutType(row.type)) {
    return null;
  }
  const distanceKm = parseDistanceKm(row.distance_km);
  if (distanceKm === null) {
    return null;
  }
  const log: WorkoutLog = { date: row.date, type: row.type, distanceKm };
  const avgPaceSecPerKm = parseOptionalInt(row.avg_pace_sec_per_km);
  if (avgPaceSecPerKm !== undefined) {
    log.avgPaceSecPerKm = avgPaceSecPerKm;
  }
  const avgHr = parseOptionalInt(row.avg_hr);
  if (avgHr !== undefined) {
    log.avgHr = avgHr;
  }
  return log;
}

function asWorkoutLogRow(data: unknown): WorkoutLogRow | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  if (!("date" in data) || !("type" in data) || !("distance_km" in data)) {
    return null;
  }
  if (typeof data.date !== "string" || typeof data.type !== "string") {
    return null;
  }
  const distanceKm = data.distance_km;
  if (typeof distanceKm !== "number" && typeof distanceKm !== "string") {
    return null;
  }
  const pace = "avg_pace_sec_per_km" in data ? (data.avg_pace_sec_per_km as number | string | null) : null;
  const hr = "avg_hr" in data ? (data.avg_hr as number | string | null) : null;
  return { date: data.date, type: data.type, distance_km: distanceKm, avg_pace_sec_per_km: pace, avg_hr: hr };
}

function asLogList(data: unknown): WorkoutLog[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((row) => {
    const mapped = asWorkoutLogRow(row);
    const log = mapped === null ? null : toWorkoutLog(mapped);
    return log === null ? [] : [log];
  });
}

export function resolveWorkoutLog(
  units: TrainingUnit[],
  date: string,
  distanceKm?: number,
  avgPaceSecPerKm?: number,
  avgHr?: number,
): ResolveWorkoutLogResult {
  const unit = units.find((item) => item.date === date);
  if (unit === undefined) {
    return { ok: false, code: "NOT_FOUND" };
  }
  const log: WorkoutLog = {
    date: unit.date,
    type: unit.type,
    distanceKm: distanceKm ?? unit.distanceKm,
  };
  if (avgPaceSecPerKm !== undefined) {
    log.avgPaceSecPerKm = avgPaceSecPerKm;
  }
  if (avgHr !== undefined) {
    log.avgHr = avgHr;
  }
  return { ok: true, log };
}

export async function listLogsRange(
  client: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<WorkoutLog[]> {
  const dates = inclusiveIsoDates(from, to);
  if (dates.length === 0) {
    return [];
  }
  const { data, error } = await client
    .from("workout_logs")
    .select(LOG_COLUMNS)
    .eq("user_id", userId)
    .in("date", dates)
    .order("date");
  if (error) {
    throw new Error(error.message);
  }
  return asLogList(data);
}

export async function listLogs(client: SupabaseClient, userId: string, weekStart: string): Promise<WorkoutLog[]> {
  const dates = weekDates(weekStart);
  return listLogsRange(client, userId, dates[0], dates[6]);
}

export async function upsertLog(
  client: SupabaseClient,
  userId: string,
  units: TrainingUnit[],
  patch: { date: string; distanceKm?: number; avgPaceSecPerKm?: number; avgHr?: number },
): Promise<UpsertLogResult> {
  const resolved = resolveWorkoutLog(units, patch.date, patch.distanceKm, patch.avgPaceSecPerKm, patch.avgHr);
  if (!resolved.ok) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Workout not found" } };
  }
  const { error } = await client.from("workout_logs").upsert(
    {
      user_id: userId,
      date: resolved.log.date,
      type: resolved.log.type,
      distance_km: resolved.log.distanceKm,
      avg_pace_sec_per_km: resolved.log.avgPaceSecPerKm ?? null,
      avg_hr: resolved.log.avgHr ?? null,
    },
    { onConflict: "user_id,date" },
  );
  if (error) {
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  try {
    const logs = await listLogs(client, userId, utcMondayOf(patch.date));
    return { ok: true, log: resolved.log, logs };
  } catch {
    return { ok: true, log: resolved.log, logs: [] };
  }
}

export async function deleteLog(client: SupabaseClient, userId: string, date: string): Promise<DeleteLogResult> {
  const { data, error } = await client
    .from("workout_logs")
    .delete()
    .eq("user_id", userId)
    .eq("date", date)
    .select("date");
  if (error) {
    return { ok: false, error: { code: "DB_ERROR", message: error.message } };
  }
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Log not found" } };
  }
  try {
    const logs = await listLogs(client, userId, utcMondayOf(date));
    return { ok: true, logs };
  } catch {
    return { ok: true, logs: [] };
  }
}
