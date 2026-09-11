import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { generateBodySchema, readRevisionStack, resolveWeekStart, undoWeek } from "@/lib/services/plan";

export const prerender = false;

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
    const result = await undoWeek(supabase, locals.user.id, resolved.weekStart);
    if (!result.ok) {
      const status = result.error.code === "NOTHING_TO_UNDO" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    const stack = await readRevisionStack(supabase, locals.user.id, resolved.weekStart);
    return jsonOk({
      weekStart: resolved.weekStart,
      units: result.units,
      undoAvailable: stack.undoAvailable,
      revisions: stack.revisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo week";
    return jsonError(500, "DB_ERROR", message);
  }
};
