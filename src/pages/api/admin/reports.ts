import type { APIRoute } from "astro";
import { jsonError, jsonOk, notFound, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { listAgentReports } from "@/lib/services/agent-report";

export const prerender = false;

export const GET: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  if (!locals.isAdmin) {
    return notFound();
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const reports = await listAgentReports(supabase);
    return jsonOk({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list reports";
    return jsonError(500, "DB_ERROR", message);
  }
};
