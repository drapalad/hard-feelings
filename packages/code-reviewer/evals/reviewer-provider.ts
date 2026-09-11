import { runReview, type ReviewTokenUsage } from "../src/agent";
import { loadLocalEnv } from "../src/load-env";

loadLocalEnv();

interface ProviderOptions {
  id?: string;
  config?: {
    model?: string;
  };
}

export default class ReviewerProvider {
  private readonly model: string;
  private readonly providerId: string;

  constructor(options: ProviderOptions) {
    const model = options.config?.model?.trim();
    if (!model) {
      throw new Error("promptfoo provider config.model is required");
    }
    this.model = model;
    this.providerId = options.id ?? `hf-reviewer:${model}`;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(
    prompt: string,
  ): Promise<{ output?: string; error?: string; tokenUsage?: ReviewTokenUsage; cost?: number }> {
    try {
      const run = await runReview(prompt, { model: this.model });
      return {
        output: JSON.stringify(run.review),
        tokenUsage: run.tokenUsage,
        ...(run.cost !== undefined ? { cost: run.cost } : {}),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { error: message };
    }
  }
}
