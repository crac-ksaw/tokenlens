import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProviderAdapter, ProviderInvocationResult } from "./types.js";

export class GeminiAdapter implements ProviderAdapter<Record<string, unknown> | string> {
  private readonly client: any;

  constructor(apiKey?: string, client?: any) {
    this.client = client ?? new GoogleGenerativeAI(apiKey ?? "");
  }

  async execute(request: Record<string, unknown> | string): Promise<ProviderInvocationResult> {
    const modelName = typeof request === "string" ? "gemini-1.5-flash" : String(request.model ?? "gemini-1.5-flash");
    const model = this.client.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(request as any);
    const usage = response.response?.usageMetadata;
    return {
      raw: response,
      usage: {
        prompt: usage?.promptTokenCount ?? 0,
        completion: usage?.candidatesTokenCount ?? 0,
        total: usage?.totalTokenCount ?? ((usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0)),
      },
      model: modelName,
    };
  }
}
