import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import mercurius from "mercurius";
import jwt from "jsonwebtoken";
import {
  alertConfigSchema,
  analyticsQuerySchema,
  budgetSchema,
  createApiKeySchema,
  ingestEventSchema,
  loginSchema,
  registerSchema,
} from "@tokenlens/shared";
import { hashPassword, requireAuth, signAccessToken, verifyPassword } from "./services/auth.js";
import { generatePlaintextApiKey, hashApiKey } from "./services/database-repository.js";
import type { AppServices } from "./services/contracts.js";

function parseBody<T>(schema: { safeParse(value: unknown): { success: boolean; data?: T; error?: { flatten(): { fieldErrors: Record<string, string[]> } } } }, value: unknown, reply: any): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    reply.code(400).send({ message: "Validation error", errors: result.error?.flatten().fieldErrors });
    return null;
  }
  return result.data as T;
}

export async function buildApp(services: AppServices): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 1000, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/auth/register", async (request, reply) => {
    const body = parseBody(registerSchema, request.body, reply);
    if (!body) return;
    const passwordHash = await hashPassword(body.password);
    const { workspace, user } = await services.repository.registerWorkspaceAndUser({
      workspaceName: body.workspaceName,
      workspaceSlug: body.workspaceSlug,
      email: body.email,
      passwordHash,
    });
    const token = signAccessToken({ userId: user.id, workspaceId: workspace.id, email: user.email, role: user.role }, services.jwtSecret);
    reply.code(201).send({ token, workspace, user: { id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId } });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = parseBody(loginSchema, request.body, reply);
    if (!body) return;
    const user = await services.repository.findUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      reply.code(401).send({ message: "Invalid credentials" });
      return;
    }
    const token = signAccessToken({ userId: user.id, workspaceId: user.workspaceId, email: user.email, role: user.role }, services.jwtSecret);
    reply.send({ token, user: { id: user.id, email: user.email, role: user.role, workspaceId: user.workspaceId } });
  });

  app.post("/auth/api-keys", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const body = parseBody(createApiKeySchema, request.body, reply);
    if (!body) return;
    const plaintext = generatePlaintextApiKey();
    const record = await services.repository.createApiKey(auth.workspaceId, body.label, hashApiKey(plaintext));
    reply.code(201).send({ apiKey: plaintext, ...record });
  });

  app.post("/ingest/event", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      reply.code(401).send({ message: "Missing API key" });
      return;
    }
    const record = await services.repository.findApiKeyByHash(hashApiKey(apiKey));
    if (!record) {
      reply.code(401).send({ message: "Invalid API key" });
      return;
    }
    const body = parseBody(ingestEventSchema, request.body, reply);
    if (!body) return;
    await services.repository.touchApiKey(record.id);
    await services.eventQueue.publish({ ...body, workspaceId: record.workspaceId });
    reply.code(202).send({ accepted: true });
  });

  app.get("/analytics/overview", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getOverview(auth.workspaceId, query.from, query.to));
  });

  app.get("/analytics/by-feature", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getBreakdown(auth.workspaceId, query.from, query.to, "feature"));
  });

  app.get("/analytics/by-user", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getBreakdown(auth.workspaceId, query.from, query.to, "user"));
  });

  app.get("/analytics/by-model", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getBreakdown(auth.workspaceId, query.from, query.to, "model"));
  });

  app.get("/analytics/timeseries", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getTimeseries(auth.workspaceId, query.from, query.to, query.granularity));
  });

  app.get("/analytics/anomalies", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    reply.send(await services.repository.listAnomalies(auth.workspaceId));
  });

  app.get("/analytics/forecast", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const query = parseBody(analyticsQuerySchema, request.query, reply);
    if (!query) return;
    reply.send(await services.analytics.getForecast(auth.workspaceId, query.from, query.to));
  });

  app.get("/budgets", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    reply.send(await services.repository.listBudgets(auth.workspaceId));
  });

  app.post("/budgets", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const body = parseBody(budgetSchema, request.body, reply);
    if (!body) return;
    reply.code(201).send(await services.repository.upsertBudget(auth.workspaceId, body));
  });

  app.delete("/budgets/:id", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const id = (request.params as { id: string }).id;
    await services.repository.deleteBudget(auth.workspaceId, id);
    reply.code(204).send();
  });

  app.get("/alerts/config", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    reply.send(await services.repository.listAlertConfigs(auth.workspaceId));
  });

  app.put("/alerts/config", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    const body = parseBody(alertConfigSchema, request.body, reply);
    if (!body) return;
    reply.send(await services.repository.upsertAlertConfig(auth.workspaceId, body));
  });

  app.get("/recommendations", async (request, reply) => {
    const auth = requireAuth(request, reply, services.jwtSecret);
    if (!auth) return;
    reply.send(await services.repository.listRecommendations(auth.workspaceId));
  });

  await app.register(mercurius as any, {
    schema: `
      type OverviewMetrics {
        totalCost: Float!
        totalTokens: Float!
        totalCalls: Float!
        avgLatencyMs: Float!
      }
      type Recommendation {
        id: ID!
        feature: String!
        currentModel: String!
        suggestedModel: String!
        estimatedSavingUsd: Float!
        rationale: String!
        createdAt: String!
      }
      type Query {
        overview(from: String!, to: String!): OverviewMetrics!
        recommendations: [Recommendation!]!
      }
    `,
    resolvers: {
      Query: {
        overview: async (_: unknown, args: { from: string; to: string }, context: { auth: any }) => {
          if (!context.auth) throw new Error("Unauthorized");
          return services.analytics.getOverview(context.auth.workspaceId, args.from, args.to);
        },
        recommendations: async (_: unknown, __: unknown, context: { auth: any }) => {
          if (!context.auth) throw new Error("Unauthorized");
          return services.repository.listRecommendations(context.auth.workspaceId);
        },
      },
    },
    context: async (request: any) => {
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith("Bearer ")) return { auth: null };
      try {
        const token = authorization.slice("Bearer ".length);
        return { auth: jwt.verify(token, services.jwtSecret) };
      } catch {
        return { auth: null };
      }
    },
    graphiql: true,
  } as any);

  return app;
}
