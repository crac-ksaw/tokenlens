import { createDatabase } from "./db/client.js";
import { buildApp } from "./app.js";
import { ClickHouseAnalyticsRepository } from "./services/analytics.js";
import { DatabaseRepository } from "./services/database-repository.js";
import { RedisEventQueue } from "./services/event-queue.js";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("FATAL: JWT_SECRET environment variable is missing.");
}

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const db = createDatabase(databaseUrl);
const app = await buildApp({
  repository: new DatabaseRepository(db),
  eventQueue: new RedisEventQueue(),
  analytics: new ClickHouseAnalyticsRepository(),
  jwtSecret,
});

await app.listen({ port, host: "0.0.0.0" });