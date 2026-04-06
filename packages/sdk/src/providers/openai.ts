import OpenAI from "openai";
import type { ProviderAdapter, ProviderInvocationResult } from "./types.js";

export class OpenAIAdapter implements ProviderAdapter<Record<string, unknown>> {
  private readonly client: any;

  constructor(apiKey?: string, client?: any) {
    this.client = client ?? new OpenAI({ apiKey });
  }

  async execute(request: Record<string, unknown>): Promise<ProviderInvocationResult> {
    const response = await this.client.chat.completions.create(request as any);
    return {
      raw: response,
      usage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
      model: response.model ?? String(request.model ?? "unknown"),
    };
  }
}
