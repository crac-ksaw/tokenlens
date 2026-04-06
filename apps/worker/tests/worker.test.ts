import { describe, expect, it } from "vitest";
import type { AlertConfig, Budget, IngestEvent } from "@tokenlens/shared";
import type { AlertDispatcher, BaselineRepository, BudgetRepository, CounterStore, EventSink } from "../src/contracts.js";
import { IngestWorker } from "../src/worker.js";

class MemoryBaselineRepository implements BaselineRepository {
  async getBaseline() {
    return { mean: 0.00001, stdDev: 0.000001 };
  }
}

class MemorySink implements EventSink {
  public readonly writes = [] as any[];

  async write(events: any[]) {
    this.writes.push(...events);
  }
}

class MemoryBudgetRepository implements BudgetRepository {
  public readonly anomalies: any[] = [];

  async getBudgets(): Promise<Budget[]> {
    return [{
      id: "budget_1",
      workspaceId: "ws_1",
      feature: "summaries",
      dailyLimitUsd: 0.0001,
      monthlyLimitUsd: 0.0001,
      action: "block",
      createdAt: new Date().toISOString(),
    }];
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    return [{
      id: "alert_1",
      workspaceId: "ws_1",
      channel: "webhook",
      webhookUrl: "https://example.com/hook",
      enabled: true,
      createdAt: new Date().toISOString(),
    }];
  }

  async saveAnomaly(record: any): Promise<void> {
    this.anomalies.push(record);
  }
}

class MemoryCounterStore implements CounterStore {
  public readonly killSwitches: string[] = [];
  private total = 0;

  async incrementDaily(_: string, __: string, amount: number): Promise<number> {
    this.total += amount;
    return this.total;
  }

  async incrementMonthly(_: string, __: string, amount: number): Promise<number> {
    this.total += amount;
    return this.total;
  }

  async setKillSwitch(workspaceId: string, feature: string): Promise<void> {
    this.killSwitches.push(`${workspaceId}:${feature}`);
  }
}

class MemoryAlertDispatcher implements AlertDispatcher {
  public readonly payloads: Record<string, unknown>[] = [];

  async dispatch(_: AlertConfig[], payload: Record<string, unknown>): Promise<void> {
    this.payloads.push(payload);
  }
}

describe("IngestWorker", () => {
  it("enriches events, flags anomalies, and triggers the kill-switch on budget overflow", async () => {
    const event: IngestEvent = {
      traceId: "trace_1",
      workspaceId: "ws_1",
      feature: "summaries",
      userId: "user_1",
      sessionId: "sess_1",
      environment: "production",
      provider: "openai",
      model: "gpt-4o",
      timestamp: new Date().toISOString(),
      latencyMs: 420,
      tokensPrompt: 400,
      tokensCompletion: 200,
      tokensTotal: 600,
    };

    const sink = new MemorySink();
    const budgetRepository = new MemoryBudgetRepository();
    const counterStore = new MemoryCounterStore();
    const alertDispatcher = new MemoryAlertDispatcher();
    const worker = new IngestWorker({
      baselineRepository: new MemoryBaselineRepository(),
      eventSink: sink,
      budgetRepository,
      counterStore,
      alertDispatcher,
    });

    const result = await worker.process(event);

    expect(result.enriched.usdCost).toBeGreaterThan(0);
    expect(result.enriched.isAnomaly).toBe(true);
    expect(sink.writes).toHaveLength(1);
    expect(budgetRepository.anomalies).toHaveLength(1);
    expect(counterStore.killSwitches).toContain("ws_1:summaries");
    expect(alertDispatcher.payloads).toHaveLength(2);
  });
});