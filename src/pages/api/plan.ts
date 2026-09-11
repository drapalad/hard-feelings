import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import {
  generateAndPersist,
  generateBodySchema,
  listRange,
  listWeek,
  readLatestRevisionUnits,
  readRevisionStack,
  resolvePlanRange,
  resolveWeekStart,
} from "@/lib/services/plan";
import { listLogs, listLogsRange } from "@/lib/services/workout-log";
import type { WorkoutLog } from "@/types";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request, cookies, url }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const resolved = resolveWeekStart(url.searchParams.get("weekStart"));
  if (!resolved.ok) {
    return jsonError(400, "VALIDATION_ERROR", "date must be YYYY-MM-DD");
  }
  const range = resolvePlanRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range.ok) {
    return jsonError(400, "VALIDATION_ERROR", "date must be YYYY-MM-DD");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const units =
      range.kind === "range"
        ? await listRange(supabase, locals.user.id, range.from, range.to)
        : await listWeek(supabase, locals.user.id, resolved.weekStart);
    const stack = await readRevisionStack(supabase, locals.user.id, resolved.weekStart);
    let latestSnapshotUnits = null;
    try {
      latestSnapshotUnits = await readLatestRevisionUnits(supabase, locals.user.id, resolved.weekStart);
    } catch {
      latestSnapshotUnits = null;
    }
    let logs: WorkoutLog[] = [];
    try {
      logs =
        range.kind === "range"
          ? await listLogsRange(supabase, locals.user.id, range.from, range.to)
          : await listLogs(supabase, locals.user.id, resolved.weekStart);
    } catch {
      logs = [];
    }
    return jsonOk({
      weekStart: resolved.weekStart,
      units,
      undoAvailable: stack.undoAvailable,
      revisions: stack.revisions,
      latestSnapshotUnits,
      logs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load plan";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = generateBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid weekStart");
  }
  const resolved = resolveWeekStart(parsed.data.weekStart);
  if (!resolved.ok) {
    return jsonError(400, "VALIDATION_ERROR", "date must be YYYY-MM-DD");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await generateAndPersist(supabase, locals.user.id, resolved.weekStart);
    if (!result.ok) {
      return jsonError(400, result.error.code, result.error.message);
    }
    const stack = await readRevisionStack(supabase, locals.user.id, resolved.weekStart);
    return jsonOk({
      weekStart: resolved.weekStart,
      plan: result.plan,
      validation: result.validation,
      undoAvailable: stack.undoAvailable,
      revisions: stack.revisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate plan";
    return jsonError(500, "DB_ERROR", message);
  }
};
