import type { APIRoute } from "astro";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import { resolveWeekStart, readRevisionStack } from "@/lib/services/plan";
import { chatMessageBodySchema, sendMessage } from "@/lib/services/chat";
import { completeOpenAiPropose } from "@/lib/services/openai-chat";
import { loadOpenAiModel } from "@/lib/services/llm-settings";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request, cookies }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = chatMessageBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid message");
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
    const apiKey = OPENAI_API_KEY;
    const model = await loadOpenAiModel(supabase, OPENAI_MODEL);
    const complete =
      apiKey === undefined || apiKey === ""
        ? undefined
        : (req: Parameters<typeof completeOpenAiPropose>[0]) => completeOpenAiPropose(req, { apiKey, model });
    const result = await sendMessage(supabase, locals.user.id, resolved.weekStart, parsed.data.content, {
      complete,
      threadId: parsed.data.threadId,
    });
    if (!result.ok) {
      const status = result.error.code === "DB_ERROR" ? 500 : result.error.code === "NOT_FOUND" ? 404 : 400;
      return jsonError(status, result.error.code, result.error.message);
    }
    if (result.data.units === undefined) {
      return jsonOk({ weekStart: resolved.weekStart, ...result.data });
    }
    const stack = await readRevisionStack(supabase, locals.user.id, resolved.weekStart);
    return jsonOk({
      weekStart: resolved.weekStart,
      ...result.data,
      units: result.data.units,
      validation: result.data.validation,
      undoAvailable: stack.undoAvailable,
      revisions: stack.revisions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message";
    return jsonError(500, "DB_ERROR", message);
  }
};
