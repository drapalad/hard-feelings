import type { APIRoute } from "astro";
import { z } from "zod";
import { jsonError, jsonOk, notFound, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { deleteAgentReport, markAgentReportReviewed } from "@/lib/services/agent-report";

export const prerender = false;

const reviewBodySchema = z.object({
  status: z.literal("reviewed"),
});

export const PATCH: APIRoute = async ({ locals, params, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  if (!locals.isAdmin) {
    return notFound();
  }
  const id = params.id;
  if (!id) {
    return notFound();
  }
  const parsed = reviewBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid status");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await markAgentReportReviewed(supabase, id);
    if (!result.ok) {
      return notFound();
    }
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review report";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const DELETE: APIRoute = async ({ locals, params, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  if (!locals.isAdmin) {
    return notFound();
  }
  const id = params.id;
  if (!id) {
    return notFound();
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await deleteAgentReport(supabase, id);
    if (!result.ok) {
      return notFound();
    }
    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete report";
    return jsonError(500, "DB_ERROR", message);
  }
};
