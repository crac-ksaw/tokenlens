import IORedisModule from "ioredis";
import { createTraceId, nowIso, type Environment, type IngestEvent, type Provider } from "@tokenlens/shared";
import { AnthropicAdapter } from "./providers/anthropic.js";
import { BedrockAdapter } from "./providers/bedrock.js";
import { GeminiAdapter } from "./providers/gemini.js";
import { OpenAIAdapter } from "./providers/openai.js";
import type { ProviderAdapter } from "./providers/types.js";

export interface KillSwitchStore {
  isEnabled(workspaceId: string, feature: string): Promise<boolean>;
}

export interface EventPublisher {
  publish(event: IngestEvent): void;
}

export interface TokenLensContext {
  feature: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TokenLensConfig extends TokenLensContext {
  apiKey?: string;
  ingestUrl?: string;
  provider: Provider;
  environment: Environment;
  workspaceId: string;
  killSwitchRedisUrl?: string;
  adapter?: ProviderAdapter<any, any>;
  model?: string;
  publisher?: EventPublisher;
  killSwitchStore?: KillSwitchStore;
}

class NullKillSwitchStore implements KillSwitchStore {
  async isEnabled(): Promise<boolean> {
    return false;
  }
}

class RedisKillSwitchStore implements KillSwitchStore {
  private readonly redis: any;

  constructor(url: string) {
    const RedisCtor = IORedisModule as unknown as { new(url: string, options?: Record<string, unknown>): any };
    this.redis = new RedisCtor(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  }

  async isEnabled(workspaceId: string, feature: string): Promise<boolean> {
    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }
      const value = await this.redis.get(`tokenlens:killswitch:${workspaceId}:${feature}`);
      return value === "1" || value === "true";
    } catch (error) {
      console.warn("TokenLens: Redis kill-switch check failed, failing open.", error);
      return false;
    }
  }
}

export class AsyncIngestPublisher implements EventPublisher {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly ingestUrl = process.env.TOKENLENS_INGEST_URL ?? "http://localhost:3001/ingest/event",
    private readonly maxRetries = 3,
  ) {}

  publish(event: IngestEvent): void {
    void this.tryPublish(event, 0);
  }

  private async tryPublish(event: IngestEvent, attempt: number): Promise<void> {
    try {
      await fetch(this.ingestUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey ?? "" },
        body: JSON.stringify(event),
      });
    } catch {
      if (attempt >= this.maxRetries - 1) return;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      await this.tryPublish(event, attempt + 1);
    }
  }
}

function buildAdapter(config: TokenLensConfig): ProviderAdapter<any, any> {
  if (config.adapter) return config.adapter;
  switch (config.provider) {
    case "openai":
      return new OpenAIAdapter(config.apiKey);
    case "anthropic":
      return new AnthropicAdapter(config.apiKey);
    case "gemini":
      return new GeminiAdapter(config.apiKey);
    case "bedrock":
      return new BedrockAdapter();
    default:
      throw new Error(`Unsupported provider: ${String(config.provider)}`);
  }
}

export class TokenLens {
  private readonly adapter: ProviderAdapter<any, any>;
  private readonly publisher: EventPublisher;
  private readonly killSwitchStore: KillSwitchStore;

  public readonly chat: { completions: { create: (request: Record<string, unknown>) => Promise<any> } };
  public readonly messages: { create: (request: Record<string, unknown>) => Promise<any> };
  public readonly models: { generateContent: (request: Record<string, unknown> | string) => Promise<any> };
  public readonly invokeModel: (request: Record<string, unknown>) => Promise<any>;

  constructor(private readonly config: TokenLensConfig) {
    this.adapter = buildAdapter(config);
    this.publisher = config.publisher ?? new AsyncIngestPublisher(config.apiKey, config.ingestUrl);
    this.killSwitchStore = config.killSwitchStore ?? (config.killSwitchRedisUrl ? new RedisKillSwitchStore(config.killSwitchRedisUrl) : new NullKillSwitchStore());
    this.chat = { completions: { create: (request) => this.invoke(request) } };
    this.messages = { create: (request) => this.invoke(request) };
    this.models = { generateContent: (request) => this.invoke(request) };
    this.invokeModel = (request) => this.invoke(request);
  }

  withContext(context: Partial<TokenLensContext>): TokenLens {
    return new TokenLens({
      ...this.config,
      ...context,
      metadata: { ...(this.config.metadata ?? {}), ...(context.metadata ?? {}) },
      adapter: this.adapter,
      publisher: this.publisher,
      killSwitchStore: this.killSwitchStore,
    });
  }

  private async invoke<T>(request: Record<string, unknown> | string): Promise<T> {
    const { workspaceId, feature } = this.config;
    const isBlocked = await this.killSwitchStore.isEnabled(workspaceId, feature);
    if (isBlocked) throw new Error(`TokenLens kill-switch enabled for ${workspaceId}/${feature}`);

    const startedAt = Date.now();
    const result = await this.adapter.execute(request as any);
    const latencyMs = Date.now() - startedAt;
    const modelName = result.model ?? this.config.model ?? (typeof request === "string" ? "unknown" : String(request.model ?? "unknown"));

    const event: IngestEvent = {
      traceId: createTraceId(),
      workspaceId,
      feature,
      userId: this.config.userId,
      sessionId: this.config.sessionId,
      environment: this.config.environment,
      provider: this.config.provider,
      model: modelName,
      timestamp: nowIso(),
      latencyMs,
      tokensPrompt: result.usage.prompt,
      tokensCompletion: result.usage.completion,
      tokensTotal: result.usage.total,
      metadata: { ...(this.config.metadata ?? {}) },
    };

    this.publisher.publish(event);
    return result.raw as T;
  }
}

