import { randomUUID } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to seed the database.");
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const workspaceId = randomUUID();
    const userId = randomUUID();
    await client.query(
      `INSERT INTO workspaces (id, name, slug, plan)
       VALUES ($1, 'Acme AI', 'acme-ai', 'growth')
       ON CONFLICT (slug) DO NOTHING`,
      [workspaceId],
    );
    await client.query(
      `INSERT INTO users (id, workspace_id, email, password_hash, role)
       VALUES ($1, $2, 'owner@acme.ai', '$2b$10$examplehash', 'owner')
       ON CONFLICT (email) DO NOTHING`,
      [userId, workspaceId],
    );
    console.log("Seed completed");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
