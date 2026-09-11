import type { APIRoute } from "astro";
import { jsonError, jsonOk, notFound, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { getProfile, upsertProfile, updateLastRace } from "@/lib/services/profile";
import { lastRaceWriteSchema, profileWriteSchema } from "@/lib/services/profile-races";

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
    const profile = await getProfile(supabase, locals.user.id);
    return jsonOk(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const PUT: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = profileWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid profile");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const profile = await upsertProfile(supabase, locals.user.id, parsed.data);
    return jsonOk(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save profile";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const PATCH: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = lastRaceWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid last race");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await updateLastRace(supabase, locals.user.id, parsed.data);
    if (!result.ok) {
      return notFound();
    }
    return jsonOk(result.profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save last race";
    return jsonError(500, "DB_ERROR", message);
  }
};
