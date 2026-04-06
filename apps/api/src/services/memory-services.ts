import { randomUUID } from "node:crypto";
import type {
  AlertConfig,
  AnomalyRecord,
  BreakdownRow,
  Budget,
  ForecastPoint,
  IngestEvent,
  OverviewMetrics,
  Recommendation,
  TimeSeriesPoint,
  User,
  Workspace,
} from "@tokenlens/shared";
import type { AnalyticsRepository, AppRepository, EventQueue, RegisterInput } from "./contracts.js";

export class MemoryEventQueue implements EventQueue {
  public readonly events: IngestEvent[] = [];

  async publish(event: IngestEvent): Promise<void> {
    this.events.push(event);
  }
}

export class MemoryRepository implements AppRepository {
  public readonly workspaces = new Map<string, Workspace>();
  public readonly users = new Map<string, User>();
  public readonly apiKeys = new Map<string, { id: string; workspaceId: string; label: string; keyHash: string }>();
  public readonly budgets = new Map<string, Budget>();
  public readonly alerts = new Map<string, AlertConfig>();
  public readonly recommendations = new Map<string, Recommendation>();
  public readonly anomalies = new Map<string, AnomalyRecord>();

  async registerWorkspaceAndUser(input: RegisterInput) {
    const workspace: Workspace = { id: randomUUID(), name: input.workspaceName, slug: input.workspaceSlug, plan: "growth", createdAt: new Date().toISOString() };
    const user: User = { id: randomUUID(), workspaceId: workspace.id, email: input.email, passwordHash: input.passwordHash, role: "owner", createdAt: new Date().toISOString() };
    this.workspaces.set(workspace.id, workspace);
    this.users.set(user.id, user);
    return { workspace, user };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createApiKey(workspaceId: string, label: string, keyHash: string) {
    const record = { id: randomUUID(), workspaceId, label, keyHash };
    this.apiKeys.set(record.id, record);
    return { id: record.id, label: record.label, createdAt: new Date().toISOString() };
  }

  async findApiKeyByHash(keyHash: string) {
    const match = [...this.apiKeys.values()].find((record) => record.keyHash === keyHash);
    return match ? { id: match.id, workspaceId: match.workspaceId, label: match.label } : null;
  }

  async touchApiKey(): Promise<void> {}

  async listBudgets(workspaceId: string): Promise<Budget[]> {
    return [...this.budgets.values()].filter((budget) => budget.workspaceId === workspaceId);
  }

  async upsertBudget(workspaceId: string, input: Omit<Budget, "id" | "workspaceId" | "createdAt">): Promise<Budget> {
    const existing = [...this.budgets.values()].find((budget) => budget.workspaceId === workspaceId && budget.feature === input.feature);
    const budget: Budget = existing ?? { id: randomUUID(), workspaceId, createdAt: new Date().toISOString(), ...input };
    budget.dailyLimitUsd = input.dailyLimitUsd;
    budget.monthlyLimitUsd = input.monthlyLimitUsd;
    budget.action = input.action;
    budget.feature = input.feature;
    this.budgets.set(budget.id, budget);
    return budget;
  }

  async deleteBudget(workspaceId: string, id: string): Promise<void> {
    const budget = this.budgets.get(id);
    if (budget?.workspaceId === workspaceId) {
      this.budgets.delete(id);
    }
  }

  async listAlertConfigs(workspaceId: string): Promise<AlertConfig[]> {
    return [...this.alerts.values()].filter((config) => config.workspaceId === workspaceId);
  }

  async upsertAlertConfig(workspaceId: string, input: Omit<AlertConfig, "id" | "workspaceId" | "createdAt">): Promise<AlertConfig> {
    const existing = [...this.alerts.values()].find((config) => config.workspaceId === workspaceId && config.channel === input.channel);
    const config: AlertConfig = existing ?? { id: randomUUID(), workspaceId, createdAt: new Date().toISOString(), ...input };
    config.channel = input.channel;
    config.webhookUrl = input.webhookUrl;
    config.enabled = input.enabled;
    this.alerts.set(config.id, config);
    return config;
  }

  async listRecommendations(workspaceId: string): Promise<Recommendation[]> {
    return [...this.recommendations.values()].filter((record) => record.workspaceId === workspaceId);
  }

  async listAnomalies(workspaceId: string): Promise<AnomalyRecord[]> {
    return [...this.anomalies.values()].filter((record) => record.workspaceId === workspaceId);
  }
}

export class MemoryAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly points: TimeSeriesPoint[] = [], private readonly breakdowns: Record<string, BreakdownRow[]> = {}) {}

  async getOverview(): Promise<OverviewMetrics> {
    return {
      totalCost: this.points.reduce((sum, point) => sum + point.cost, 0),
      totalTokens: this.points.reduce((sum, point) => sum + point.tokens, 0),
      totalCalls: this.points.reduce((sum, point) => sum + point.calls, 0),
      avgLatencyMs: 240,
    };
  }

  async getBreakdown(_: string, __: string, ___: string, groupBy: "feature" | "user" | "model"): Promise<BreakdownRow[]> {
    return this.breakdowns[groupBy] ?? [];
  }

  async getTimeseries(): Promise<TimeSeriesPoint[]> {
    return this.points;
  }

  async getForecast(): Promise<ForecastPoint[]> {
    return this.points.slice(-7).map((point, index) => ({
      date: new Date(new Date(point.bucket).getTime() + ((index + 1) * 86400000)).toISOString(),
      projectedCost: point.cost,
      p95Upper: point.cost * 1.2,
      p95Lower: point.cost * 0.8,
    }));
  }
}