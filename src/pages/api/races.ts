import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { insertRace, listRaces } from "@/lib/services/races";
import { raceWriteSchema } from "@/lib/services/profile-races";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const races = await listRaces(supabase, locals.user.id);
    return jsonOk({ races });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load races";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
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
    const result = await insertRace(supabase, locals.user.id, parsed.data);
    if (!result.ok) {
      const status = result.error.code === "DB_ERROR" ? 500 : 400;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk(result.race, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create race";
    return jsonError(500, "DB_ERROR", message);
  }
};
