import type { APIRoute } from "astro";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { resolveWeekStart } from "@/lib/services/plan";
import { listChat } from "@/lib/services/chat";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request, cookies, url }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const resolved = resolveWeekStart(url.searchParams.get("weekStart"));
  if (!resolved.ok) {
    return jsonError(400, "VALIDATION_ERROR", "date must be YYYY-MM-DD");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  const rawThreadId = url.searchParams.get("threadId");
  const threadId = rawThreadId === null || rawThreadId === "" ? undefined : rawThreadId;
  try {
    const chat = await listChat(supabase, locals.user.id, resolved.weekStart, threadId);
    return jsonOk({ weekStart: resolved.weekStart, ...chat });
  } catch (error) {
    if (error instanceof Error && error.message === "THREAD_NOT_FOUND") {
      return jsonError(404, "NOT_FOUND", "Thread not found.");
    }
    const message = error instanceof Error ? error.message : "Failed to load chat";
    return jsonError(500, "DB_ERROR", message);
  }
};
