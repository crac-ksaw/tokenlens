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

export interface AuthClaims {
  userId: string;
  workspaceId: string;
  email: string;
  role: string;
}

export interface RegisterInput {
  workspaceName: string;
  workspaceSlug: string;
  email: string;
  passwordHash: string;
}

export interface AppRepository {
  registerWorkspaceAndUser(input: RegisterInput): Promise<{ workspace: Workspace; user: User }>;
  findUserByEmail(email: string): Promise<User | null>;
  createApiKey(workspaceId: string, label: string, keyHash: string): Promise<{ id: string; label: string; createdAt: string }>;
  findApiKeyByHash(keyHash: string): Promise<{ id: string; workspaceId: string; label: string } | null>;
  touchApiKey(id: string): Promise<void>;
  listBudgets(workspaceId: string): Promise<Budget[]>;
  upsertBudget(workspaceId: string, input: Omit<Budget, "id" | "workspaceId" | "createdAt">): Promise<Budget>;
  deleteBudget(workspaceId: string, id: string): Promise<void>;
  listAlertConfigs(workspaceId: string): Promise<AlertConfig[]>;
  upsertAlertConfig(workspaceId: string, input: Omit<AlertConfig, "id" | "workspaceId" | "createdAt">): Promise<AlertConfig>;
  listRecommendations(workspaceId: string): Promise<Recommendation[]>;
  listAnomalies(workspaceId: string): Promise<AnomalyRecord[]>;
}

export interface EventQueue {
  publish(event: IngestEvent): Promise<void>;
}

export interface AnalyticsRepository {
  getOverview(workspaceId: string, from: string, to: string): Promise<OverviewMetrics>;
  getBreakdown(workspaceId: string, from: string, to: string, groupBy: "feature" | "user" | "model"): Promise<BreakdownRow[]>;
  getTimeseries(workspaceId: string, from: string, to: string, granularity: "hour" | "day"): Promise<TimeSeriesPoint[]>;
  getForecast(workspaceId: string, from: string, to: string): Promise<ForecastPoint[]>;
}

export interface AppServices {
  repository: AppRepository;
  eventQueue: EventQueue;
  analytics: AnalyticsRepository;
  jwtSecret: string;
}