import type { APIRoute } from "astro";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import {
  deleteUnit,
  editUnit,
  freezeWriteSchema,
  readRevisionStack,
  setFrozen,
  unitEditSchema,
  weekStartSchema,
} from "@/lib/services/plan";
import { utcMondayOf } from "@/lib/dates";

export const prerender = false;

export const PATCH: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = freezeWriteSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid freeze");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await setFrozen(supabase, locals.user.id, parsed.data.date, parsed.data.frozen);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk(result.unit);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update unit";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const PUT: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = unitEditSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid unit");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await editUnit(supabase, locals.user.id, parsed.data);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({
      unit: result.unit,
      units: result.units,
      validation: result.validation,
      undoAvailable: result.undoAvailable,
      revisions: (await readRevisionStack(supabase, locals.user.id, utcMondayOf(parsed.data.date))).revisions,
      changed: result.changed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit unit";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const DELETE: APIRoute = async ({ locals, request, cookies, url }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = weekStartSchema.safeParse(url.searchParams.get("date"));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid date");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    const result = await deleteUnit(supabase, locals.user.id, parsed.data);
    if (!result.ok) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 500;
      return jsonError(status, result.error.code, result.error.message);
    }
    return jsonOk({
      units: result.units,
      validation: result.validation,
      undoAvailable: result.undoAvailable,
      revisions: (await readRevisionStack(supabase, locals.user.id, utcMondayOf(parsed.data))).revisions,
      changed: result.changed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete unit";
    return jsonError(500, "DB_ERROR", message);
  }
};
