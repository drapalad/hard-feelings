import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isStepCount, Output, ToolLoopAgent, type LanguageModelUsage } from "ai";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { reviewOutputSchema, type ReviewOutput } from "./schema";

const DEFAULT_MODEL = "openai/gpt-4o-mini";

export interface ReviewerOptions {
  apiKey?: string;
  model?: string;
}

export interface ReviewTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ReviewRun {
  review: ReviewOutput;
  tokenUsage: ReviewTokenUsage;
  cost?: number;
}

export function createCodeReviewer(options: ReviewerOptions = {}) {
  const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Set it in .dev.vars (local) or the environment.");
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId = options.model ?? process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  return new ToolLoopAgent({
    model: openrouter(modelId, { usage: { include: true } }),
    instructions: SYSTEM_PROMPT,
    tools: {},
    stopWhen: isStepCount(2),
    maxOutputTokens: 2048,
    output: Output.object({
      schema: reviewOutputSchema,
    }),
  });
}

function openRouterStepCost(metadata: unknown): number | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }
  const cost = (metadata as { openrouter?: { usage?: { cost?: unknown } } }).openrouter?.usage?.cost;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : undefined;
}

function tokenUsageFrom(usage: LanguageModelUsage): ReviewTokenUsage {
  const prompt = usage.inputTokens ?? 0;
  const completion = usage.outputTokens ?? 0;
  return {
    prompt,
    completion,
    total: usage.totalTokens ?? prompt + completion,
  };
}

function costFromSteps(steps: { providerMetadata?: unknown }[]): number | undefined {
  let total = 0;
  let found = false;
  for (const step of steps) {
    const cost = openRouterStepCost(step.providerMetadata);
    if (cost !== undefined) {
      total += cost;
      found = true;
    }
  }
  return found ? total : undefined;
}

export async function runReview(diff: string, options: ReviewerOptions = {}): Promise<ReviewRun> {
  const agent = createCodeReviewer(options);
  const result = await agent.generate({
    prompt: buildUserPrompt(diff),
  });

  const parsed = reviewOutputSchema.safeParse(result.output);
  if (!parsed.success) {
    throw new Error(`Model output failed schema validation: ${parsed.error.message}`);
  }

  const cost = costFromSteps(result.steps);
  return {
    review: parsed.data,
    tokenUsage: tokenUsageFrom(result.usage),
    ...(cost !== undefined ? { cost } : {}),
  };
}

export async function reviewDiff(diff: string, options: ReviewerOptions = {}): Promise<ReviewOutput> {
  const { review } = await runReview(diff, options);
  return review;
}
