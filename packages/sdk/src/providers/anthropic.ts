import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, ProviderInvocationResult } from "./types.js";

export class AnthropicAdapter implements ProviderAdapter<Record<string, unknown>> {
  private readonly client: any;

  constructor(apiKey?: string, client?: any) {
    this.client = client ?? new Anthropic({ apiKey });
  }

  async execute(request: Record<string, unknown>): Promise<ProviderInvocationResult> {
    const response = await this.client.messages.create(request as any);
    return {
      raw: response,
      usage: {
        prompt: response.usage?.input_tokens ?? 0,
        completion: response.usage?.output_tokens ?? 0,
        total: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      },
      model: response.model ?? String(request.model ?? "unknown"),
    };
  }
}
