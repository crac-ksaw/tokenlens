import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

import { sha256, type AlertConfig, type AnomalyRecord, type Budget, type Recommendation, type User, type Workspace } from "@tokenlens/shared";
import { alertConfigs, anomalies, apiKeys, budgets, recommendations, users, workspaces } from "../db/schema.js";
import type { AppRepository, RegisterInput } from "./contracts.js";

function mapWorkspace(row: InferSelectModel<typeof workspaces>): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapUser(row: InferSelectModel<typeof users>): User {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DatabaseRepository implements AppRepository {
  constructor(private readonly db: any) {}

  async registerWorkspaceAndUser(input: RegisterInput) {
    const [workspace] = await this.db.insert(workspaces).values({
      name: input.workspaceName,
      slug: input.workspaceSlug,
      plan: "growth",
    }).returning();

    const [user] = await this.db.insert(users).values({
      workspaceId: workspace.id,
      email: input.email,
      passwordHash: input.passwordHash,
      role: "owner",
    }).returning();

    return { workspace: mapWorkspace(workspace), user: mapUser(user) };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({ where: eq(users.email, email) });
    return row ? mapUser(row) : null;
  }

  async createApiKey(workspaceId: string, label: string, keyHash: string) {
    const [row] = await this.db.insert(apiKeys).values({ workspaceId, label, keyHash }).returning();
    return { id: row.id, label: row.label, createdAt: row.createdAt.toISOString() };
  }

  async findApiKeyByHash(keyHash: string) {
    const row = await this.db.query.apiKeys.findFirst({ where: eq(apiKeys.keyHash, keyHash) });
    return row ? { id: row.id, workspaceId: row.workspaceId, label: row.label } : null;
  }

  async touchApiKey(id: string): Promise<void> {
    await this.db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async listBudgets(workspaceId: string): Promise<Budget[]> {
    const rows = await this.db.select().from(budgets).where(eq(budgets.workspaceId, workspaceId));
    return rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      feature: row.feature,
      dailyLimitUsd: Number(row.dailyLimitUsd),
      monthlyLimitUsd: Number(row.monthlyLimitUsd),
      action: row.action as Budget["action"],
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async upsertBudget(workspaceId: string, input: Omit<Budget, "id" | "workspaceId" | "createdAt">): Promise<Budget> {
    const [row] = await this.db.insert(budgets).values({
      workspaceId,
      feature: input.feature,
      dailyLimitUsd: input.dailyLimitUsd.toFixed(2),
      monthlyLimitUsd: input.monthlyLimitUsd.toFixed(2),
      action: input.action,
    }).onConflictDoUpdate({
      target: [budgets.workspaceId, budgets.feature],
      set: {
        dailyLimitUsd: input.dailyLimitUsd.toFixed(2),
        monthlyLimitUsd: input.monthlyLimitUsd.toFixed(2),
        action: input.action,
      },
    }).returning();

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      feature: row.feature,
      dailyLimitUsd: Number(row.dailyLimitUsd),
      monthlyLimitUsd: Number(row.monthlyLimitUsd),
      action: row.action as Budget["action"],
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deleteBudget(workspaceId: string, id: string): Promise<void> {
    await this.db.delete(budgets).where(and(eq(budgets.workspaceId, workspaceId), eq(budgets.id, id)));
  }

  async listAlertConfigs(workspaceId: string): Promise<AlertConfig[]> {
    const rows = await this.db.select().from(alertConfigs).where(eq(alertConfigs.workspaceId, workspaceId));
    return rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      channel: row.channel as AlertConfig["channel"],
      webhookUrl: row.webhookUrl,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async upsertAlertConfig(workspaceId: string, input: Omit<AlertConfig, "id" | "workspaceId" | "createdAt">): Promise<AlertConfig> {
    const [row] = await this.db.insert(alertConfigs).values({
      workspaceId,
      channel: input.channel,
      webhookUrl: input.webhookUrl,
      enabled: input.enabled,
    }).onConflictDoUpdate({
      target: [alertConfigs.workspaceId, alertConfigs.channel],
      set: { webhookUrl: input.webhookUrl, enabled: input.enabled },
    }).returning();

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      channel: row.channel as AlertConfig["channel"],
      webhookUrl: row.webhookUrl,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listRecommendations(workspaceId: string): Promise<Recommendation[]> {
    const rows = await this.db.select().from(recommendations).where(eq(recommendations.workspaceId, workspaceId)).orderBy(desc(recommendations.createdAt));
    return rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      feature: row.feature,
      currentModel: row.currentModel,
      suggestedModel: row.suggestedModel,
      estimatedSavingUsd: Number(row.estimatedSavingUsd),
      rationale: row.rationale,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listAnomalies(workspaceId: string): Promise<AnomalyRecord[]> {
    const rows = await this.db.select().from(anomalies).where(eq(anomalies.workspaceId, workspaceId)).orderBy(desc(anomalies.createdAt));
    return rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      feature: row.feature,
      model: row.model,
      usdCost: Number(row.usdCost),
      anomalyScore: Number(row.anomalyScore),
      traceId: row.traceId,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

export function generatePlaintextApiKey(): string {
  return `tl_${randomUUID().replace(/-/g, "")}`;
}

export function hashApiKey(apiKey: string): string {
  return sha256(apiKey);
}



