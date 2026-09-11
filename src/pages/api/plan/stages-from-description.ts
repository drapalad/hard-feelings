import type { APIRoute } from "astro";
import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { jsonError, jsonOk, readJson, unauthorized } from "@/lib/api";
import { resolveOpenAiModel } from "@/lib/services/llm-settings";
import { completeStagesFromDescription, stagesFromDescriptionBodySchema } from "@/lib/services/stages-from-description";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.user) {
    return unauthorized();
  }
  const parsed = stagesFromDescriptionBodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid structure");
  }
  const structure = parsed.data.structure.trim();
  if (structure === "") {
    return jsonError(400, "VALIDATION_ERROR", "structure is required");
  }
  const apiKey = OPENAI_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    return jsonError(503, "UNAVAILABLE", "OpenAI is not configured");
  }
  const model = resolveOpenAiModel(null, OPENAI_MODEL);
  try {
    const result = await completeStagesFromDescription({ structure }, { apiKey, model });
    return jsonOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse stages";
    return jsonError(502, "UPSTREAM_ERROR", message);
  }
};
