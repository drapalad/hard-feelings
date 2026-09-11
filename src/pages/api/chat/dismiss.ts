import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { chatWeekBodySchema, dismissPendingProfileFreeze } from "@/lib/services/chat";
import { resolveWeekStart } from "@/lib/services/plan";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = chatWeekBodySchema.safeParse((await readJson(request)) ?? {});
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
    const result = await dismissPendingProfileFreeze(supabase, locals.user.id, resolved.weekStart);
    if (!result.ok) {
      const status = result.error.code === "DB_ERROR" ? 500 : 400;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dismiss changes";
    return jsonError(500, "DB_ERROR", message);
  }
};
