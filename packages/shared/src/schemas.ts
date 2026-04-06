import { z } from "zod";
import { environments, providers } from "./types.js";

export const ingestEventSchema = z.object({
  traceId: z.string().min(1),
  workspaceId: z.string().min(1),
  feature: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  environment: z.enum(environments),
  provider: z.enum(providers),
  model: z.string().min(1),
  timestamp: z.string().datetime(),
  latencyMs: z.number().int().nonnegative(),
  tokensPrompt: z.number().int().nonnegative(),
  tokensCompletion: z.number().int().nonnegative(),
  tokensTotal: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const registerSchema = z.object({
  workspaceName: z.string().min(2),
  workspaceSlug: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const createApiKeySchema = z.object({
  label: z.string().min(2)
});

export const budgetSchema = z.object({
  feature: z.string().min(1),
  dailyLimitUsd: z.number().nonnegative(),
  monthlyLimitUsd: z.number().nonnegative(),
  action: z.enum(["alert", "block"])
});

export const alertConfigSchema = z.object({
  channel: z.enum(["slack", "pagerduty", "email", "webhook"]),
  webhookUrl: z.string().url(),
  enabled: z.boolean()
});

export const analyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  granularity: z.enum(["hour", "day"]).optional().default("day")
});
