// Wire the commands to grammY.
//
// The bot is built from an `AppContext`, so a test can construct one with an
// in-memory store and drive the same handlers.

import { Bot } from "grammy";
import type { AppContext } from "./app.js";
import { ensureUser, loadAccount, requireTosAndLinked, type AppCtx } from "./middleware.js";
import {
  agentsCmd,
  applyRiskLimits,
  closeAllCmd,
  connectCmd,
  connectWithAddressCmd,
  deployCmd,
  fundBuildCmd,
  fundCmd,
  helpCmd,
  journalCmd,
  notifyCmd,
  onTosCallback,
  pauseCmd,
  pnlCmd,
  positionsCmd,
  resumeCmd,
  riskCmd,
  startCmd,
  statusCmd,
  tosCmd,
  withdrawBuildCmd,
} from "./commands.js";

export function createBot(token: string, app: AppContext): Bot {
  const bot = new Bot(token);

  // Every update resolves to a user row first, then loads the linked account.
  bot.use((ctx, next) => {
    (ctx as AppCtx).app = app;
    (ctx as AppCtx).state = {};
    return next();
  });
  bot.use(ensureUser);
  bot.use(loadAccount);

  bot.command("start", (ctx) => startCmd(ctx as AppCtx));
  bot.command("help", (ctx) => helpCmd(ctx as AppCtx));
  bot.command("tos", (ctx) => tosCmd(ctx as AppCtx));
  bot.command("agents", (ctx) => agentsCmd(ctx as AppCtx));
  bot.command("status", (ctx) => statusCmd(ctx as AppCtx));
  bot.command("pnl", (ctx) => pnlCmd(ctx as AppCtx));
  bot.command("journal", (ctx) => journalCmd(ctx as AppCtx));
  bot.command("positions", requireTosAndLinked, (ctx) => positionsCmd(ctx as AppCtx));
  bot.command("pause", requireTosAndLinked, (ctx) => pauseCmd(ctx as AppCtx));
  bot.command("resume", requireTosAndLinked, (ctx) => resumeCmd(ctx as AppCtx));
  bot.command("closeall", requireTosAndLinked, (ctx) => closeAllCmd(ctx as AppCtx));
  bot.command("notify", (ctx) => {
    const parts = (ctx.match?.toString() ?? "").trim().split(/\s+/).filter(Boolean);
    return notifyCmd(ctx as AppCtx, parts);
  });
  bot.command("fund", (ctx) => {
    const amount = Number((ctx.match?.toString() ?? "").trim());
    return amount > 0 ? fundBuildCmd(ctx as AppCtx, amount) : fundCmd(ctx as AppCtx);
  });
  bot.command("withdraw", (ctx) => {
    const amount = Number((ctx.match?.toString() ?? "").trim());
    return withdrawBuildCmd(ctx as AppCtx, amount);
  });

  bot.command("connect", async (ctx) => {
    const c = ctx as AppCtx;
    const arg = (ctx.match?.toString() ?? "").trim();
    if (arg) return connectWithAddressCmd(c, arg);
    return connectCmd(c);
  });

  bot.command("risk", async (ctx) => {
    const c = ctx as AppCtx;
    const parts = (ctx.match?.toString() ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return riskCmd(c);
    const err = await applyRiskLimits(c, parts);
    if (err) await ctx.reply(err);
  });

  bot.command("deploy", requireTosAndLinked, (ctx) => {
    const parts = (ctx.match?.toString() ?? "").trim().split(/\s+/).filter(Boolean);
    return deployCmd(ctx as AppCtx, parts);
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data?.startsWith("tos:")) return onTosCallback(ctx as AppCtx);
  });

  bot.catch((err) => {
    console.error("[bot] handler error", err.error);
  });

  return bot;
}

/** The command list Telegram shows in its menu. */
export const COMMANDS = [
  { command: "start", description: "Create your trading profile" },
  { command: "help", description: "List all commands" },
  { command: "tos", description: "Read and accept the risk disclosure" },
  { command: "connect", description: "Create your bot key and link it in DreamDEX" },
  { command: "fund", description: "Show your perps margin, or build a deposit" },
  { command: "withdraw", description: "Build a withdrawal from your margin" },
  { command: "agents", description: "Browse available trading agents" },
  { command: "deploy", description: "Activate an autonomous strategy" },
  { command: "positions", description: "View open positions" },
  { command: "risk", description: "Configure risk limits" },
  { command: "notify", description: "Choose which events you are messaged about" },
  { command: "pause", description: "Pause autonomous trading" },
  { command: "resume", description: "Resume a paused agent" },
  { command: "closeall", description: "Close all positions and pause agents" },
  { command: "pnl", description: "View performance" },
  { command: "status", description: "Account and agent status" },
  { command: "journal", description: "Audit what your agent decided" },
];
