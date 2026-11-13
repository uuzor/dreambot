import "server-only";
import { promises as fs } from "node:fs";
import { cache } from "react";
import { createStore, type Store } from "@dreampilot/store";
import { DEMO_TELEGRAM_ID, type DashboardData, type JournalLine } from "./types";
import { demoDashboard } from "./demo";
import { botUsername, telegramConnectUrl, telegramReachability } from "./telegram";

/** Which user the dashboard shows. The bot is the real identity provider, so
 *  the web app renders whichever account it is pointed at. */
function activeTelegramId(): number {
  const raw = process.env.DASHBOARD_TELEGRAM_ID;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEMO_TELEGRAM_ID;
}

// One pool per process, reused across requests. Creating a store per render would
// open a new pool every time and never close it, which exhausts Postgres. A
// failed construction clears the cache so the next request retries.
let cached: Promise<Store> | null = null;

function readStore(): Promise<Store> {
  cached ??= createStore(process.env.DATABASE_URL, { skipMigrate: true }).catch(
    (err) => {
      cached = null;
      throw err;
    },
  );
  return cached;
}

/** Resolve the bot link and, when we can ask Telegram, whether the chat exists. */
async function telegramLink(telegramId: number) {
  return {
    username: botUsername(),
    url: telegramConnectUrl(telegramId),
    reachability: await telegramReachability(telegramId),
  };
}

async function readJournal(journalPath: string): Promise<JournalLine[]> {
  try {
    const raw = await fs.readFile(journalPath, "utf8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as JournalLine);
  } catch {
    return [];
  }
}

/**
 * Load everything the dashboard renders.
 *
 * With DATABASE_URL this reads the same Postgres the bot and worker write to.
 * Without it, or if the read fails, it falls back to the demo set so the UI is
 * still reviewable. The fallback is surfaced in the UI rather than hidden.
 *
 * The store keeps open positions and a PnL aggregate, not a closed-position
 * history, so the live path reports the aggregate rather than inventing rows.
 */
export const loadDashboard = cache(async (): Promise<DashboardData> => {
  if (!process.env.DATABASE_URL) {
    const demo = demoDashboard();
    return { ...demo, telegram: await telegramLink(demo.user.telegramId) };
  }

  try {
    const store = await readStore();
    const telegramId = activeTelegramId();

    const user = await store.getUser(telegramId);
    if (!user) {
      const demo = demoDashboard();
      return { ...demo, telegram: await telegramLink(demo.user.telegramId) };
    }

    const [account, agents, openPositions, pnl, audit] = await Promise.all([
      store.getAccount(telegramId),
      store.listAgents(telegramId),
      store.openPositionsForUser(telegramId),
      store.pnlSummary(telegramId, 24 * 30),
      store.recentAudit(telegramId, 50),
    ]);

    const journal = agents[0] ? await readJournal(agents[0].journal_path) : [];

    return {
      source: "live",
      user: {
        telegramId,
        username: user.username,
        tosAccepted: Boolean(user.tos_accepted_at),
      },
      account: account
        ? {
            address: account.account_address,
            botKeyAddress: account.bot_key_address,
            network: account.network,
            linked: Boolean(account.linked_at),
          }
        : null,
      agents,
      openPositions,
      closedPositions: [],
      pnl,
      equity: [],
      audit,
      journal,
      telegram: await telegramLink(telegramId),
    };
  } catch (err) {
    console.warn(`[web] store read failed, serving demo data: ${(err as Error).message}`);
    const demo = demoDashboard();
    return { ...demo, telegram: await telegramLink(demo.user.telegramId) };
  }
});
