import { boolean, numeric, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(),
  label: text("label").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  dailyLimitUsd: numeric("daily_limit_usd", { precision: 12, scale: 2 }).notNull(),
  monthlyLimitUsd: numeric("monthly_limit_usd", { precision: 12, scale: 2 }).notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceFeatureUnique: uniqueIndex("budgets_workspace_feature_idx").on(table.workspaceId, table.feature),
}));

export const alertConfigs = pgTable("alert_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workspaceChannelUnique: uniqueIndex("alerts_workspace_channel_idx").on(table.workspaceId, table.channel),
}));

export const recommendations = pgTable("recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  currentModel: text("current_model").notNull(),
  suggestedModel: text("suggested_model").notNull(),
  estimatedSavingUsd: numeric("estimated_saving_usd", { precision: 12, scale: 2 }).notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const anomalies = pgTable("anomalies", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  feature: text("feature").notNull(),
  model: text("model").notNull(),
  usdCost: numeric("usd_cost", { precision: 12, scale: 6 }).notNull(),
  anomalyScore: numeric("anomaly_score", { precision: 12, scale: 4 }).notNull(),
  traceId: text("trace_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});