// @dreampilot/store - persistence.

import { MemoryStore } from "./memory.js";
import { PgStore } from "./postgres.js";
import type { Store } from "./store.js";

export { MemoryStore } from "./memory.js";
export { PgStore } from "./postgres.js";
export { Cipher, generateMasterKey, safeEqual } from "./crypto.js";
export type { Store } from "./store.js";
export * from "./types.js";

/**
 * Pick a store from the environment.
 *
 * With DATABASE_URL, Postgres (and the schema is applied). Without it, the
 * in-memory store, which loses state on restart but lets a first run happen with
 * no database at all.
 */
export async function createStore(databaseUrl?: string): Promise<Store> {
  const url = (databaseUrl ?? process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    console.warn("[store] DATABASE_URL is unset: using the in-memory store (state is lost on restart).");
    return new MemoryStore();
  }
  const store = new PgStore(url);
  await store.migrate();
  return store;
}
