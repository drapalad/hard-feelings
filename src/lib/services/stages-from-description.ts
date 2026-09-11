import { z } from "zod";
import { unitStagesSchema } from "./plan";
import type { UnitStage } from "@/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const FETCH_TIMEOUT_MS = 20_000;

export const stagesFromDescriptionBodySchema = z.object({
  structure: z.string().max(500),
});

const stagesResponseSchema = z.object({
  stages: unitStagesSchema,
});

const STAGES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stages"],
  properties: {
    stages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "label", "duration", "target"],
        properties: {
          kind: { type: "string", enum: ["warmup", "work", "recovery", "cooldown"] },
          label: { type: "string" },
          duration: { type: "string" },
          target: { type: "string" },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "You convert a running workout description into an ordered JSON list of stages.",
  "Each stage must have an explicit kind: warmup, work, recovery, or cooldown.",
  'Do not infer kind from vague prose like "easy jog" unless the text uses WU/warm-up, CD/cool-down, recovery/rest, or a work cue (pace, repeats, tempo).',
  'duration is a short string such as "2 km" or "10 min". target is a pace or empty string.',
  'Example: "2km WU, 5km 4:20, 2km CD" becomes warmup 2 km, work 5 km with target 4:20, cooldown 2 km.',
].join(" ");

export interface StagesFromDescriptionOptions {
  apiKey: string;
  model: string;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function completeStagesFromDescription(
  input: { structure: string },
  options: StagesFromDescriptionOptions,
): Promise<{ stages: UnitStage[] }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.structure },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "workout_stages",
          strict: true,
          schema: STAGES_JSON_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await openAiFailureMessage(response));
  }

  const body: unknown = await response.json();
  const message = choiceMessage(body);
  if (message === null) {
    throw new Error("OpenAI response is missing a completion message");
  }
  if (typeof message.refusal === "string" && message.refusal !== "") {
    throw new Error("OpenAI refused the completion");
  }
  if (typeof message.content !== "string" || message.content === "") {
    throw new Error("OpenAI response is missing message content");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(message.content) as unknown;
  } catch {
    throw new Error("OpenAI response content is not JSON");
  }

  const parsed = stagesResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("OpenAI response JSON failed the stages schema");
  }
  return { stages: parsed.data.stages };
}

async function openAiFailureMessage(response: Response): Promise<string> {
  const fallback = `OpenAI request failed with status ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("error" in body)) {
      return fallback;
    }
    const error = body.error;
    if (typeof error !== "object" || error === null) {
      return fallback;
    }
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    const message = "message" in error && typeof error.message === "string" ? error.message : "";
    const detail = [code, message].filter((part) => part !== "").join(" ");
    return detail === "" ? fallback : `${fallback}: ${detail}`;
  } catch {
    return fallback;
  }
}

function choiceMessage(body: unknown): { content?: unknown; refusal?: unknown } | null {
  if (typeof body !== "object" || body === null || !("choices" in body) || !Array.isArray(body.choices)) {
    return null;
  }
  const first: unknown = body.choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) {
    return null;
  }
  const message = first.message;
  if (typeof message !== "object" || message === null) {
    return null;
  }
  return message;
}
