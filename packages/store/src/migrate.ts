// Apply the schema to DATABASE_URL. Run with: npm run migrate
import { PgStore } from "./postgres.js";

const url = (process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL is unset. Set it to your Postgres connection string, then run this again.");
  process.exit(1);
}

const store = new PgStore(url);
try {
  await store.migrate();
  console.log("schema applied");
} catch (err) {
  console.error("migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await store.close();
}
