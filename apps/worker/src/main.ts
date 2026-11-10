// The worker entrypoint.
//
// Reads the environment, opens the store, and starts the scheduler. The interval
// defaults to a minute; DreamPilot's strategies work on minute-scale moves, so a
// faster loop buys nothing but RPC load.

import { Cipher, createStore } from "@dreampilot/store";
import { createScheduler } from "./scheduler.js";
import type { WorkerDeps } from "./tick.js";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/**
 * Build the outbound message path for this process.
 *
 * The worker sends with `bot.api.sendMessage` directly, which needs only the
 * token, not a polling loop. `bot.init()` resolves the bot's identity so the API
 * is usable without `bot.start()`, and nothing here consumes updates - that is
 * the bot process's job. One token, two processes, no Redis.
 */
async function makeNotifier(log: (line: string) => void): Promise<WorkerDeps["notify"]> {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    log("notify: TELEGRAM_BOT_TOKEN unset, so users will not be messaged about fills or refusals");
    return undefined;
  }
  const { Bot } = await import("grammy");
  const bot = new Bot(token);
  await bot.init();
  log(`notify: enabled as @${bot.botInfo.username}`);
  return async (telegramId: number, text: string) => {
    try {
      await bot.api.sendMessage(telegramId, text, { parse_mode: "HTML" });
    } catch (err) {
      // A user who blocked the bot is not a worker failure.
      log(`notify ${telegramId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
}

async function main(): Promise<void> {
  const dryRun = (process.env.AGENTS_DRY_RUN ?? "true") !== "false";
  const intervalMs = Number(process.env.AGENT_TICK_MS ?? 60_000);
  const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

  const store = await createStore(process.env.DATABASE_URL);
  const cipher = new Cipher(requireEnv("MASTER_ENCRYPTION_KEY"));
  const notify = await makeNotifier(log);

  const deps: WorkerDeps = {
    store,
    cipher,
    dryRun,
    network: process.env.NETWORK ?? "hideki",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.DREAMPILOT_MODEL,
    log,
    notify,
  };

  const scheduler = createScheduler({
    deps,
    redisUrl: process.env.REDIS_URL,
    intervalMs,
    log,
  });

  await scheduler.start();
  log(`worker up (dryRun=${dryRun}, tick=${intervalMs}ms)`);

  const shutdown = async (signal: string) => {
    log(`${signal} received, stopping`);
    await scheduler.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("worker failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
