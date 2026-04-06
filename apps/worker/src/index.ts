import { createClient } from "@clickhouse/client";
import IORedisModule from "ioredis";
import { Client as PgClient } from "pg";
import type { AlertConfig, Budget, EnrichedEvent, IngestEvent } from "@tokenlens/shared";
import { MultiChannelAlertDispatcher } from "./alert-dispatcher.js";
import type { BaselineRepository, BudgetRepository, CounterStore, EventSink } from "./contracts.js";
import { IngestWorker } from "./worker.js";

const streamName = process.env.TOKENLENS_STREAM_NAME ?? "tokenlens:events";
const consumerGroup = process.env.TOKENLENS_CONSUMER_GROUP ?? "enrichment-workers";
const consumerName = `${process.env.HOSTNAME ?? "worker"}-${Math.random().toString(36).slice(2, 8)}`;

class ClickHouseSink implements EventSink {
  constructor(private readonly client = createClient({ url: process.env.CLICKHOUSE_URL })) {}

  async write(events: EnrichedEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.client.insert({
      table: "llm_events",
      values: events.map((event) => ({
        event_id: event.eventId,
        workspace_id: event.workspaceId,
        feature: event.feature,
        user_id: event.userId ?? "",
        session_id: event.sessionId ?? "",
        environment: event.environment,
        provider: event.provider,
        model: event.model,
        tokens_prompt: event.tokensPrompt,
        tokens_completion: event.tokensCompletion,
        tokens_total: event.tokensTotal,
        usd_cost: event.usdCost,
        latency_ms: event.latencyMs,
        created_at: event.timestamp.slice(0, 19).replace("T", " "),
      })),
      format: "JSONEachRow",
    });
  }
}

class ClickHouseBaselineRepository implements BaselineRepository {
  constructor(private readonly client = createClient({ url: process.env.CLICKHOUSE_URL })) {}

  async getBaseline(workspaceId: string, feature: string) {
    const result = await this.client.query({
      query: `
        SELECT avg(usd_cost) AS mean, stddevPop(usd_cost) AS std_dev
        FROM llm_events
        WHERE workspace_id = {workspaceId:String}
          AND feature = {feature:String}
          AND created_at >= now() - INTERVAL 7 DAY
      `,
      format: "JSONEachRow",
      query_params: { workspaceId, feature },
    });
    const rows = await result.json<{ mean: number | null; std_dev: number | null }>();
    const row = rows[0];
    if (!row || row.mean === null || row.std_dev === null) return null;
    return { mean: Number(row.mean), stdDev: Number(row.std_dev) };
  }
}

class PostgresBudgetRepository implements BudgetRepository {
  constructor(private readonly client: PgClient) {}

  async getBudgets(workspaceId: string, feature: string): Promise<Budget[]> {
    const result = await this.client.query(
      `SELECT id, workspace_id, feature, daily_limit_usd, monthly_limit_usd, action, created_at FROM budgets WHERE workspace_id = $1 AND feature = $2`,
      [workspaceId, feature],
    );
    return result.rows.map((row: Record<string, any>) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      feature: row.feature,
      dailyLimitUsd: Number(row.daily_limit_usd),
      monthlyLimitUsd: Number(row.monthly_limit_usd),
      action: row.action,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async getAlertConfigs(workspaceId: string): Promise<AlertConfig[]> {
    const result = await this.client.query(
      `SELECT id, workspace_id, channel, webhook_url, enabled, created_at FROM alert_configs WHERE workspace_id = $1`,
      [workspaceId],
    );
    return result.rows.map((row: Record<string, any>) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      channel: row.channel,
      webhookUrl: row.webhook_url,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async saveAnomaly(record: { workspaceId: string; feature: string; model: string; usdCost: number; anomalyScore: number; traceId: string; }): Promise<void> {
    await this.client.query(
      `INSERT INTO anomalies (workspace_id, feature, model, usd_cost, anomaly_score, trace_id) VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.workspaceId, record.feature, record.model, record.usdCost, record.anomalyScore, record.traceId],
    );
  }
}

class RedisCounterStore implements CounterStore {
  constructor(private readonly redis: any) {}

  async incrementDaily(workspaceId: string, feature: string, amount: number): Promise<number> {
    const key = `tokenlens:budget:${workspaceId}:${feature}:${new Date().toISOString().slice(0, 10)}`;
    const total = await this.redis.incrbyfloat(key, amount);
    await this.redis.expire(key, 60 * 60 * 24 * 35);
    return Number(total);
  }

  async incrementMonthly(workspaceId: string, feature: string, amount: number): Promise<number> {
    const month = new Date().toISOString().slice(0, 7);
    const key = `tokenlens:budget:${workspaceId}:${feature}:${month}`;
    const total = await this.redis.incrbyfloat(key, amount);
    await this.redis.expire(key, 60 * 60 * 24 * 400);
    return Number(total);
  }

  async setKillSwitch(workspaceId: string, feature: string): Promise<void> {
    await this.redis.set(`tokenlens:killswitch:${workspaceId}:${feature}`, "1");
  }
}

function decodeEvent(fields: string[]): IngestEvent {
  return JSON.parse(fields[1]) as IngestEvent;
}

async function main() {
  const RedisCtor = IORedisModule as unknown as { new(url: string): any };
  const redis: any = new RedisCtor(process.env.REDIS_URL ?? "redis://localhost:6379");
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  try {
    await redis.xgroup("CREATE", streamName, consumerGroup, "0", "MKSTREAM");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error;
  }

  const worker = new IngestWorker({
    baselineRepository: new ClickHouseBaselineRepository(),
    eventSink: new ClickHouseSink(),
    budgetRepository: new PostgresBudgetRepository(pg),
    counterStore: new RedisCounterStore(redis),
    alertDispatcher: new MultiChannelAlertDispatcher(process.env.RESEND_API_KEY),
  });

  while (true) {
    const response = await redis.xreadgroup("GROUP", consumerGroup, consumerName, "COUNT", 10, "BLOCK", 5000, "STREAMS", streamName, ">") as any;
    if (!response) continue;
    for (const [, entries] of response as [string, [string, string[]][]][]) {
      for (const [id, fields] of entries) {
        const event = decodeEvent(fields);
        await worker.process(event);
        await redis.xack(streamName, consumerGroup, id);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

