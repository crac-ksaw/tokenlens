export const environments = ["production", "staging", "development"] as const;
export const providers = ["openai", "anthropic", "gemini", "bedrock"] as const;

export type Environment = (typeof environments)[number];
export type Provider = (typeof providers)[number];

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface IngestEvent {
  traceId: string;
  workspaceId: string;
  feature: string;
  userId?: string;
  sessionId?: string;
  environment: Environment;
  provider: Provider;
  model: string;
  timestamp: string;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  metadata?: Record<string, unknown>;
}

export interface EnrichedEvent extends IngestEvent {
  eventId: string;
  usdCost: number;
  costPer1kTokens: number;
  isAnomaly: boolean;
  anomalyScore?: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: string;
}

export interface User {
  id: string;
  workspaceId: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  workspaceId: string;
  feature: string;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  action: "alert" | "block";
  createdAt: string;
}

export interface AlertConfig {
  id: string;
  workspaceId: string;
  channel: "slack" | "pagerduty" | "email" | "webhook";
  webhookUrl: string;
  enabled: boolean;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  workspaceId: string;
  feature: string;
  currentModel: string;
  suggestedModel: string;
  estimatedSavingUsd: number;
  rationale: string;
  createdAt: string;
}

export interface AnomalyRecord {
  id: string;
  workspaceId: string;
  feature: string;
  model: string;
  usdCost: number;
  anomalyScore: number;
  traceId: string;
  createdAt: string;
}

export interface OverviewMetrics {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  avgLatencyMs: number;
}

export interface BreakdownRow {
  key: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface TimeSeriesPoint {
  bucket: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface ForecastPoint {
  date: string;
  projectedCost: number;
  p95Upper: number;
  p95Lower: number;
}

export interface PricingEntry {
  inputPer1M: number;
  outputPer1M: number;
}