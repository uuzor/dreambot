import "server-only";
import { promises as fs } from "node:fs";
import { cache } from "react";
import { cookies } from "next/headers";
import { Cipher, createStore, type Store } from "@dreampilot/store";
import { accountOverview, type OpsDeps } from "@dreampilot/ops";
import { DEMO_TELEGRAM_ID, type DashboardData, type JournalLine } from "./types";
import { demoDashboard } from "./demo";
import { botUsername, telegramConnectUrl, telegramReachability } from "./telegram";
import { SESSION_COOKIE, verifySession } from "./session";

/** Which user the dashboard shows when no one is signed in and no id is pinned.
 *  `DASHBOARD_TELEGRAM_ID` remains as a single-user convenience for a local run;
 *  in production the session decides. */
function pinnedTelegramId(): number | null {
  const raw = process.env.DASHBOARD_TELEGRAM_ID;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The Telegram id behind this request, or null when no one is signed in.
 *
 * A signed session always wins. `DASHBOARD_TELEGRAM_ID` is a fallback for a
 * single-user local run only: with sessions configured it is ignored, so a
 * deployment cannot be left readable by anyone who guesses the URL.
 */
export const currentTelegramId = cache(async (): Promise<number | null> => {
  const jar = await cookies();
  const signed = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (signed !== null) return signed;
  return pinnedTelegramId();
});

// One pool per process, reused across requests. Creating a store per render would
// open a new pool every time and never close it, which exhausts Postgres. A
// failed construction clears the cache so the next request retries.
let cached: Promise<Store> | null = null;

export function readStore(): Promise<Store> {
  cached ??= createStore(process.env.DATABASE_URL, { skipMigrate: true }).catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

/**
 * The dependencies the control-plane operations need.
 *
 * The web app is a legitimate caller of the same operations the bot performs, so
 * it builds the same shape of dependencies. `dryRun` is the operator's master
 * switch and is read here exactly as the worker reads it, so paper mode holds on
 * both surfaces.
 */
let cachedDeps: Promise<OpsDeps> | null = null;

export function opsDeps(): Promise<OpsDeps> {
  cachedDeps ??= (async () => {
    const store = await readStore();
    const key = process.env.MASTER_ENCRYPTION_KEY?.trim();
    if (!key) {
      throw new Error("MASTER_ENCRYPTION_KEY is unset, so the dashboard cannot trade.");
    }
    return {
      store,
      cipher: new Cipher(key),
      network: process.env.NETWORK ?? "hideki",
      dryRun: (process.env.AGENTS_DRY_RUN ?? "true") !== "false",
      journalRoot: process.env.JOURNAL_DIR ?? "./.journals",
    } satisfies OpsDeps;
  })().catch((err) => {
    cachedDeps = null;
    throw err;
  });
  return cachedDeps;
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
  const telegramId = await currentTelegramId();

  if (!process.env.DATABASE_URL) {
    const demo = demoDashboard();
    return { ...demo, telegram: await telegramLink(demo.user.telegramId), signedIn: telegramId !== null };
  }

  try {
    const store = await readStore();
    if (telegramId === null) {
      // Nobody is signed in. Show the demo set rather than another user's account.
      const demo = demoDashboard();
      return { ...demo, telegram: await telegramLink(demo.user.telegramId), signedIn: false };
    }

    const user = await store.getUser(telegramId);
    if (!user) {
      const demo = demoDashboard();
      return { ...demo, telegram: await telegramLink(telegramId), signedIn: true };
    }

    const [account, agents, openPositions, pnl, audit] = await Promise.all([
      store.getAccount(telegramId),
      store.listAgents(telegramId),
      store.openPositionsForUser(telegramId),
      store.pnlSummary(telegramId, 24 * 30),
      store.recentAudit(telegramId, 50),
    ]);

    const journal = agents[0] ? await readJournal(agents[0].journal_path) : [];

    // Read the account's real equity, free margin and positions from the chain.
    // Best-effort: a chain hiccup must not blank the dashboard, so a failure
    // leaves liveAccount null and the UI says so rather than showing stale numbers.
    let liveAccount: DashboardData["liveAccount"] = null;
    if (account?.account_address) {
      try {
        const deps = await opsDeps();
        const overview = await accountOverview(deps, telegramId);
        liveAccount = { ...overview, dailyPnlUsd: agents.reduce((s, a) => s + a.daily_pnl_usd, 0) };
      } catch (err) {
        console.warn(`[web] onchain account read failed: ${(err as Error).message}`);
      }
    }

    return {
      source: "live",
      signedIn: true,
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
      liveAccount,
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
    return { ...demo, telegram: await telegramLink(demo.user.telegramId), signedIn: telegramId !== null };
  }
});

export { DEMO_TELEGRAM_ID };
