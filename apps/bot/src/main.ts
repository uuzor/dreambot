// The bot entrypoint.
//
// Reads the environment, opens the store, builds the handlers' dependencies, and
// long-polls. It also owns the outbound notification path the worker and the
// handlers share, so a fill or a refusal reaches the user's chat.

import { mkdirSync } from "node:fs";
import type { Bot } from "grammy";
import { createStore } from "@dreampilot/store";
import { COMMANDS, createBot, loadConfig, makeCipher, type AppContext } from "@dreampilot/telegram";

async function main(): Promise<void> {
  const config = loadConfig();
  const store = await createStore(config.DATABASE_URL);
  const cipher = makeCipher(config);

  const journalRoot = process.env.JOURNAL_DIR ?? "./.journals";
  mkdirSync(journalRoot, { recursive: true });

  // The notifier needs the bot instance, and the bot needs the notifier. The
  // instance is assigned before any update can arrive, so the forward reference
  // is safe.
  let bot: Bot | undefined;
  const app: AppContext = {
    config,
    store,
    cipher,
    journalRoot,
    notify: async (telegramId, text) => {
      try {
        await bot?.api.sendMessage(telegramId, text, { parse_mode: "HTML" });
      } catch (err) {
        console.error(`notify ${telegramId} failed:`, err instanceof Error ? err.message : err);
      }
    },
  };

  bot = createBot(config.TELEGRAM_BOT_TOKEN, app);
  await bot.api.setMyCommands(COMMANDS);
  console.log(
    `bot up (network=${config.NETWORK}, dryRun=${config.AGENTS_DRY_RUN}, ` +
      `store=${config.DATABASE_URL ? "postgres" : "memory"})`,
  );

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, stopping`);
    await bot?.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await bot.start({ onStart: (me) => console.log(`listening as @${me.username}`) });
}

main().catch((err) => {
  console.error("bot failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
