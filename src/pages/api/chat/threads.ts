import type { APIRoute } from "astro";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { createThread, listThreads } from "@/lib/services/chat";

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
    const threads = await listThreads(supabase, locals.user.id);
    return jsonOk({ threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load threads";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const thread = await createThread(supabase, locals.user.id);
    return jsonOk(thread);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create thread";
    return jsonError(500, "DB_ERROR", message);
  }
};
