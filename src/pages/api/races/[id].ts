import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { deleteRace, updateRace } from "@/lib/services/races";
import { raceWriteSchema } from "@/lib/services/profile-races";

export const prerender = false;

export const PATCH: APIRoute = async ({ locals, params, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const id = params.id;
  if (!id) {
    return jsonError(404, "NOT_FOUND", "Race not found");
  }
  const parsed = raceWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid race");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await updateRace(supabase, locals.user.id, id, parsed.data);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : result.error.code === "DB_ERROR" ? 500 : 400;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk(result.race);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update race";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const DELETE: APIRoute = async ({ locals, params, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const id = params.id;
  if (!id) {
    return jsonError(404, "NOT_FOUND", "Race not found");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await deleteRace(supabase, locals.user.id, id);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete race";
    return jsonError(500, "DB_ERROR", message);
  }
};
