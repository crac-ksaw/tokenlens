import { createClient } from "@clickhouse/client";
import type { BreakdownRow, ForecastPoint, OverviewMetrics, TimeSeriesPoint } from "@tokenlens/shared";
import type { AnalyticsRepository } from "./contracts.js";

function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function computeForecast(points: TimeSeriesPoint[]): ForecastPoint[] {
  if (points.length === 0) return [];
  const xMean = (points.length - 1) / 2;
  const yMean = points.reduce((sum, point) => sum + point.cost, 0) / points.length;
  const numerator = points.reduce((sum, point, index) => sum + ((index - xMean) * (point.cost - yMean)), 0);
  const denominator = points.reduce((sum, _, index) => sum + ((index - xMean) ** 2), 0) || 1;
  const slope = numerator / denominator;
  const intercept = yMean - (slope * xMean);
  const variance = points.reduce((sum, point, index) => {
    const predicted = intercept + (slope * index);
    return sum + ((point.cost - predicted) ** 2);
  }, 0) / points.length;
  const stdDev = Math.sqrt(variance);
  const lastDate = new Date(points[points.length - 1].bucket);
  return Array.from({ length: 30 }, (_, offset) => {
    const date = new Date(lastDate);
    date.setUTCDate(date.getUTCDate() + offset + 1);
    const projectedCost = Math.max(0, intercept + (slope * (points.length + offset)));
    return {
      date: date.toISOString(),
      projectedCost: Number(projectedCost.toFixed(4)),
      p95Upper: Number((projectedCost + (1.96 * stdDev)).toFixed(4)),
      p95Lower: Number(Math.max(0, projectedCost - (1.96 * stdDev)).toFixed(4)),
    };
  });
}

export class ClickHouseAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly client = createClient({ url: process.env.CLICKHOUSE_URL })) {}

  async getOverview(workspaceId: string, from: string, to: string): Promise<OverviewMetrics> {
    const result = await this.client.query({
      query: `SELECT sum(usd_cost) AS total_cost, sum(tokens_total) AS total_tokens, count() AS total_calls, avg(latency_ms) AS avg_latency_ms FROM llm_events WHERE workspace_id = {workspaceId:String} AND created_at BETWEEN {from:DateTime} AND {to:DateTime}`,
      format: "JSONEachRow",
      query_params: { workspaceId, from, to },
    });
    const rows = await result.json();
    const row = (rows as Array<Record<string, unknown>>)[0] ?? {};
    return {
      totalCost: toNumber(row.total_cost),
      totalTokens: toNumber(row.total_tokens),
      totalCalls: toNumber(row.total_calls),
      avgLatencyMs: toNumber(row.avg_latency_ms),
    };
  }

  async getBreakdown(workspaceId: string, from: string, to: string, groupBy: "feature" | "user" | "model"): Promise<BreakdownRow[]> {
    const column = groupBy === "user" ? "user_id" : groupBy;
    const result = await this.client.query({
      query: `SELECT ${column} AS key, sum(usd_cost) AS cost, sum(tokens_total) AS tokens, count() AS calls FROM llm_events WHERE workspace_id = {workspaceId:String} AND created_at BETWEEN {from:DateTime} AND {to:DateTime} GROUP BY key ORDER BY cost DESC LIMIT 100`,
      format: "JSONEachRow",
      query_params: { workspaceId, from, to },
    });
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({ key: String(row.key ?? "unknown"), cost: toNumber(row.cost), tokens: toNumber(row.tokens), calls: toNumber(row.calls) }));
  }

  async getTimeseries(workspaceId: string, from: string, to: string, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]> {
    const bucket = granularity === "hour" ? "toStartOfHour(created_at)" : "toStartOfDay(created_at)";
    const result = await this.client.query({
      query: `SELECT ${bucket} AS bucket, sum(usd_cost) AS cost, sum(tokens_total) AS tokens, count() AS calls FROM llm_events WHERE workspace_id = {workspaceId:String} AND created_at BETWEEN {from:DateTime} AND {to:DateTime} GROUP BY bucket ORDER BY bucket ASC`,
      format: "JSONEachRow",
      query_params: { workspaceId, from, to },
    });
    const rows = (await result.json()) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      bucket: new Date(String(row.bucket)).toISOString(),
      cost: toNumber(row.cost),
      tokens: toNumber(row.tokens),
      calls: toNumber(row.calls),
    }));
  }

  async getForecast(workspaceId: string, from: string, to: string): Promise<ForecastPoint[]> {
    return computeForecast(await this.getTimeseries(workspaceId, from, to, "day"));
  }
}
