import type { APIRoute } from "astro";
import { OPENAI_MODEL } from "astro:env/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jsonError, jsonOk, notFound, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import {
  getStoredCoachNotes,
  getStoredOpenAiModel,
  openaiModelIdSchema,
  resolveOpenAiModel,
  setStoredCoachNotes,
  setStoredOpenAiModel,
} from "@/lib/services/llm-settings";

export const prerender = false;

const patchBodySchema = z
  .object({
    openaiModel: openaiModelIdSchema.nullable(),
    coachNotes: z.string().nullable().optional(),
  })
  .transform((value) => {
    if (value.coachNotes === undefined) {
      const { coachNotes: _omitted, ...rest } = value;
      return rest;
    }
    const trimmed = value.coachNotes?.trim() ?? "";
    return {
      ...value,
      coachNotes: trimmed === "" ? null : trimmed.slice(0, 2000),
    };
  });

function envFallback(envModel: string | undefined): string | null {
  return typeof envModel === "string" && envModel !== "" ? envModel : null;
}

async function settingsPayload(client: SupabaseClient) {
  const openaiModel = await getStoredOpenAiModel(client);
  const coachNotes = await getStoredCoachNotes(client);
  const envModel = typeof OPENAI_MODEL === "string" ? OPENAI_MODEL : undefined;
  return {
    openaiModel,
    resolvedModel: resolveOpenAiModel(openaiModel, envModel),
    envFallback: envFallback(envModel),
    coachNotes,
  };
}

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
    return jsonOk(await settingsPayload(supabase));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings";
    return jsonError(500, "DB_ERROR", message);
  }
};

export const PATCH: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  if (!locals.isAdmin) {
    return notFound();
  }
  const parsed = patchBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid model");
  }
  const supabase = createClient(request.headers, cookies);
  if (!supabase) {
    return jsonError(503, "UNAVAILABLE", "Supabase is not configured");
  }
  try {
    await setStoredOpenAiModel(supabase, parsed.data.openaiModel, locals.user.id);
    if ("coachNotes" in parsed.data) {
      await setStoredCoachNotes(supabase, parsed.data.coachNotes, locals.user.id);
    }
    return jsonOk(await settingsPayload(supabase));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings";
    return jsonError(500, "DB_ERROR", message);
  }
};
