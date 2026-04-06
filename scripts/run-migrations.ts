import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const migrations = [join(process.cwd(), "infra", "postgres", "migrations", "0001_initial.sql")];

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const migration of migrations) {
      const sql = await readFile(migration, "utf8");
      await client.query(sql);
      console.log(`Applied migration: ${migration}`);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
