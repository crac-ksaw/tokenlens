import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ProviderAdapter, ProviderInvocationResult } from "./types.js";

export interface BedrockLikeClient {
  send(command: InvokeModelCommand): Promise<any>;
}

export class BedrockAdapter implements ProviderAdapter<Record<string, unknown>> {
  private readonly client: BedrockLikeClient;

  constructor(region = process.env.AWS_REGION ?? "us-east-1", client?: BedrockLikeClient) {
    this.client = client ?? new BedrockRuntimeClient({ region });
  }

  async execute(request: Record<string, unknown>): Promise<ProviderInvocationResult> {
    const modelId = String(request.modelId ?? request.model ?? "anthropic.claude-3-haiku-20240307-v1:0");
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      body: JSON.stringify(request.body ?? request),
    });
    const response = await this.client.send(command);
    return {
      raw: response,
      usage: {
        prompt: Number(response.$metadata?.attempts ?? 0),
        completion: 0,
        total: Number(response.$metadata?.attempts ?? 0),
      },
      model: modelId,
    };
  }
}