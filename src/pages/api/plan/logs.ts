import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { listWeek } from "@/lib/services/plan";
import { deleteLog, upsertLog, workoutLogDateSchema, workoutLogWriteSchema } from "@/lib/services/workout-log";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = workoutLogWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid log");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const units = await listWeek(supabase, locals.user.id, parsed.data.date);
    const result = await upsertLog(supabase, locals.user.id, units, {
      date: parsed.data.date,
      distanceKm: parsed.data.distanceKm,
      avgPaceSecPerKm: parsed.data.avgPaceSecPerKm,
      avgHr: parsed.data.avgHr,
    });
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({ log: result.log, logs: result.logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to log workout";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const DELETE: APIRoute = async ({ locals, request, cookies, url }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = workoutLogDateSchema.safeParse({ date: url.searchParams.get("date") });
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid date");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await deleteLog(supabase, locals.user.id, parsed.data.date);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({ logs: result.logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove log";
    return jsonError(500, "DB_ERROR", message);
  }
};
