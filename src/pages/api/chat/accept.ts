import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { readRevisionStack, resolveWeekStart } from "@/lib/services/plan";
import { acceptProposition, chatWeekBodySchema } from "@/lib/services/chat";
import type { ValidateResult } from "@/types";

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
    const result = await acceptProposition(supabase, locals.user.id, resolved.weekStart);
    if (!result.ok) {
      if (result.error.code === "HARD_BOUNDS") {
        return hardBounds(result.error.message, result.validation);
      }
      const status = result.error.code === "DB_ERROR" ? 500 : 400;
      return jsonError(status, result.error.code, result.error.message);
    }
    const stack = await readRevisionStack(supabase, locals.user.id, result.weekStart);
    return jsonOk({
      weekStart: result.weekStart,
      units: result.units,
      validation: result.validation,
      undoAvailable: stack.undoAvailable,
      revisions: stack.revisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept proposition";
    return jsonError(500, "DB_ERROR", message);
  }
};

function hardBounds(message: string, validation: ValidateResult | undefined): Response {
  return new Response(JSON.stringify({ error: { code: "HARD_BOUNDS", message }, validation }), {
    status: 409,
    headers: { "Content-Type": "application/json" },
  });
}
