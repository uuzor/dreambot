// @dreampilot/store - persistence.

import { MemoryStore } from "./memory.js";
import { PgStore } from "./postgres.js";
import type { Store } from "./store.js";

export { MemoryStore } from "./memory.js";
export { PgStore } from "./postgres.js";
export { Cipher, generateMasterKey, safeEqual } from "./crypto.js";
export type { Store } from "./store.js";
export * from "./types.js";

export interface CreateStoreOptions {
  /** Skip the schema apply. For read-only consumers that must not run DDL. */
  skipMigrate?: boolean;
}

/**
 * Pick a store from the environment.
 *
 * With DATABASE_URL, Postgres (and the schema is applied). Without it, the
 * in-memory store, which loses state on restart but lets a first run happen with
 * no database at all.
 */
export async function createStore(
  databaseUrl?: string,
  options: CreateStoreOptions = {},
): Promise<Store> {
  const url = (databaseUrl ?? process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    console.warn("[store] DATABASE_URL is unset: using the in-memory store (state is lost on restart).");
    return new MemoryStore();
  }
  const store = new PgStore(url);
  // Read-only consumers (the dashboard) skip this: migrations are the bot's and
  // worker's job, and a read-only process running DDL is both wrong and unable
  // to work — `schema.sql` is not shipped in a bundled serverless build.
  if (!options.skipMigrate) await store.migrate();
  return store;
}
