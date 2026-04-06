import { describe, expect, it, vi } from "vitest";
import type { IngestEvent } from "@tokenlens/shared";
import { TokenLens, type EventPublisher, type KillSwitchStore } from "../src/tokenlens.js";

class TestPublisher implements EventPublisher {
  public readonly events: IngestEvent[] = [];

  publish(event: IngestEvent): void {
    this.events.push(event);
  }
}

class TestKillSwitchStore implements KillSwitchStore {
  constructor(private readonly enabled = false) {}

  async isEnabled(): Promise<boolean> {
    return this.enabled;
  }
}

describe("TokenLens SDK", () => {
  it("publishes an enriched event after a wrapped request", async () => {
    const publisher = new TestPublisher();
    const adapter = {
      execute: vi.fn(async () => ({
        raw: { id: "resp_1" },
        usage: { prompt: 120, completion: 40, total: 160 },
        model: "gpt-4o-mini",
      })),
    };

    const client = new TokenLens({
      apiKey: "tl_test",
      workspaceId: "ws_123",
      feature: "summarization",
      provider: "openai",
      environment: "production",
      adapter,
      publisher,
      killSwitchStore: new TestKillSwitchStore(false),
      userId: "user_1",
      sessionId: "sess_1",
      metadata: { source: "unit-test" },
    });

    const response = await client.chat.completions.create({ model: "gpt-4o-mini", messages: [] });

    expect(response).toEqual({ id: "resp_1" });
    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(publisher.events).toHaveLength(1);
    expect(publisher.events[0]).toMatchObject({
      workspaceId: "ws_123",
      feature: "summarization",
      provider: "openai",
      model: "gpt-4o-mini",
      tokensPrompt: 120,
      tokensCompletion: 40,
      tokensTotal: 160,
      userId: "user_1",
      sessionId: "sess_1",
      metadata: { source: "unit-test" },
    });
  });

  it("supports context overrides without losing the shared adapter", async () => {
    const publisher = new TestPublisher();
    const adapter = {
      execute: vi.fn(async () => ({
        raw: { ok: true },
        usage: { prompt: 20, completion: 5, total: 25 },
        model: "gpt-4o",
      })),
    };

    const base = new TokenLens({
      workspaceId: "ws_321",
      feature: "default",
      provider: "openai",
      environment: "staging",
      adapter,
      publisher,
      killSwitchStore: new TestKillSwitchStore(false),
    });

    await base.withContext({ feature: "translation", userId: "user_2" }).chat.completions.create({ model: "gpt-4o" });

    expect(publisher.events[0]).toMatchObject({
      feature: "translation",
      userId: "user_2",
      environment: "staging",
    });
  });

  it("blocks provider calls when the kill-switch is enabled", async () => {
    const adapter = { execute: vi.fn() };
    const client = new TokenLens({
      workspaceId: "ws_blocked",
      feature: "chat",
      provider: "openai",
      environment: "production",
      adapter,
      publisher: new TestPublisher(),
      killSwitchStore: new TestKillSwitchStore(true),
    });

    await expect(client.chat.completions.create({ model: "gpt-4o-mini" })).rejects.toThrow(/kill-switch/i);
    expect(adapter.execute).not.toHaveBeenCalled();
  });
});