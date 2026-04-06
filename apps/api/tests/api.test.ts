import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/services/auth.js";
import { buildApp } from "../src/app.js";
import { hashApiKey } from "../src/services/database-repository.js";
import { MemoryAnalyticsRepository, MemoryEventQueue, MemoryRepository } from "../src/services/memory-services.js";

const now = new Date();
const timeseries = Array.from({ length: 7 }, (_, index) => ({
  bucket: new Date(now.getTime() - ((6 - index) * 86400000)).toISOString(),
  cost: 10 + index,
  tokens: 1000 + (index * 100),
  calls: 5 + index,
}));

describe("TokenLens API", () => {
  it("registers, logs in, creates an API key, ingests an event, and manages budgets", async () => {
    const repository = new MemoryRepository();
    const eventQueue = new MemoryEventQueue();
    const analytics = new MemoryAnalyticsRepository(timeseries, {
      feature: [{ key: "summaries", cost: 120, tokens: 4200, calls: 31 }],
      user: [{ key: "user_1", cost: 120, tokens: 4200, calls: 31 }],
      model: [{ key: "gpt-4o-mini", cost: 120, tokens: 4200, calls: 31 }],
    });
    const app = await buildApp({ repository, eventQueue, analytics, jwtSecret: "test-secret" });

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        workspaceName: "Acme AI",
        workspaceSlug: "acme-ai",
        email: "owner@acme.ai",
        password: "supersecret",
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    const registered = registerResponse.json();
    const token = registered.token as string;

    const apiKeyResponse = await app.inject({
      method: "POST",
      url: "/auth/api-keys",
      headers: { authorization: `Bearer ${token}` },
      payload: { label: "SDK key" },
    });
    expect(apiKeyResponse.statusCode).toBe(201);
    const plaintextApiKey = apiKeyResponse.json().apiKey as string;

    const ingestResponse = await app.inject({
      method: "POST",
      url: "/ingest/event",
      headers: { "x-api-key": plaintextApiKey },
      payload: {
        traceId: "trace_1",
        workspaceId: "ignored",
        feature: "summaries",
        userId: "user_1",
        sessionId: "sess_1",
        environment: "production",
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: new Date().toISOString(),
        latencyMs: 120,
        tokensPrompt: 100,
        tokensCompletion: 60,
        tokensTotal: 160,
      },
    });
    expect(ingestResponse.statusCode).toBe(202);
    expect(eventQueue.events).toHaveLength(1);
    expect(eventQueue.events[0].workspaceId).toBe(registered.workspace.id);

    const budgetResponse = await app.inject({
      method: "POST",
      url: "/budgets",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        feature: "summaries",
        dailyLimitUsd: 25,
        monthlyLimitUsd: 400,
        action: "alert",
      },
    });
    expect(budgetResponse.statusCode).toBe(201);

    const listBudgetResponse = await app.inject({
      method: "GET",
      url: "/budgets",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listBudgetResponse.json()).toHaveLength(1);

    const overviewResponse = await app.inject({
      method: "GET",
      url: `/analytics/overview?from=${encodeURIComponent(timeseries[0].bucket)}&to=${encodeURIComponent(new Date().toISOString())}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(overviewResponse.statusCode).toBe(200);
    expect(overviewResponse.json().totalCost).toBeGreaterThan(0);

    await app.close();
  });

  it("logs in an existing user", async () => {
    const repository = new MemoryRepository();
    const workspace = (await repository.registerWorkspaceAndUser({
      workspaceName: "Existing",
      workspaceSlug: "existing",
      email: "dev@example.com",
      passwordHash: await hashPassword("supersecret"),
    })).workspace;
    await repository.createApiKey(workspace.id, "seed", hashApiKey("tl_seed"));

    const app = await buildApp({
      repository,
      eventQueue: new MemoryEventQueue(),
      analytics: new MemoryAnalyticsRepository(),
      jwtSecret: "test-secret",
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "dev@example.com", password: "supersecret" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeTruthy();
    await app.close();
  });
});