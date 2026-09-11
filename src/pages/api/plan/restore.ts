import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { resolveWeekStart, restoreBodySchema, restoreWeek } from "@/lib/services/plan";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = restoreBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid restore");
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
    const result = await restoreWeek(supabase, locals.user.id, resolved.weekStart, parsed.data.revisionId);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({
      weekStart: resolved.weekStart,
      units: result.units,
      undoAvailable: result.undoAvailable,
      revisions: result.revisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore week";
    return jsonError(500, "DB_ERROR", message);
  }
};
