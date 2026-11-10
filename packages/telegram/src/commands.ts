// The user-facing commands.
//
// Every handler reads its dependencies from `ctx.app`, so the same code runs in
// production and under test. Anything the user typed is escaped before it
// reaches HTML mode.

import { InlineKeyboard } from "grammy";
import { STRATEGIES, strategyByKey } from "@dreampilot/agent";
import { RiskLimitsSchema } from "@dreampilot/risk";
import type { Agent } from "@dreampilot/store";
import { buildVenue } from "@dreampilot/agent";
import type { AppCtx } from "./middleware.js";
import { generateBotKey } from "./keys.js";
import {
  bold,
  code,
  escapeHtml,
  fmtNum,
  fmtSignedUsd,
  fmtUsd,
  shortAddr,
} from "./format.js";

const NETWORKS = ["hideki", "testnet"] as const;

/** The journal path for a new agent, under the configured root. */
export function journalPathFor(root: string, telegramId: number, label: string | number): string {
  return `${root}/${telegramId}/${label}.jsonl`;
}

// ── /start ──────────────────────────────────────────────────────────────────

export async function startCmd(ctx: AppCtx): Promise<void> {
  const { user, account } = ctx.state;
  if (!user) return;
  const lines = [
    `${bold("DreamPilot")} - autonomous perps agents on DreamDEX (Somnia).`,
    "",
    "You bring your own trading account. DreamPilot generates a bot key, you link",
    "it in the DreamDEX app, and your agent trades for you inside limits you set.",
    "The bot key cannot withdraw or transfer your funds.",
    "",
    `${bold("Setup")}`,
    "1. /tos - read and accept the risk disclosure",
    "2. /connect - create your bot key and link it in the app",
    "3. /agents - browse strategies",
    "4. /risk - set your limits",
    "5. /deploy - start an agent",
    "",
  ];
  if (!user.tos_accepted_at) lines.push("Next: /tos");
  else if (!account) lines.push("Next: /connect");
  else lines.push(`Account ${code(shortAddr(account.account_address))} is connected. Next: /agents`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ── /help ───────────────────────────────────────────────────────────────────

export async function helpCmd(ctx: AppCtx): Promise<void> {
  await ctx.reply(
    [
      bold("Commands"),
      "",
      `${code("/start")}    Create your profile`,
      `${code("/tos")}      Read and accept the risk disclosure`,
      `${code("/connect")}  Create your bot key and link it in the DreamDEX app`,
      `${code("/fund")}     Show your perps margin, or build a deposit`,
      `${code("/withdraw")} Build a withdrawal from your margin`,
      `${code("/agents")}   Browse available trading agents`,
      `${code("/deploy")}   Activate an autonomous strategy`,
      `${code("/positions")} View open positions`,
      `${code("/risk")}     Configure risk limits`,
      `${code("/notify")}   Choose which events you are messaged about`,
      `${code("/pause")}    Pause autonomous trading`,
      `${code("/resume")}   Resume a paused agent`,
      `${code("/closeall")} Close all positions and stop the agent`,
      `${code("/pnl")}      View performance`,
      `${code("/status")}   Account and agent status`,
      `${code("/journal")}  Audit what your agent decided`,
      `${code("/help")}     This list`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

// ── /tos ────────────────────────────────────────────────────────────────────

export async function tosCmd(ctx: AppCtx): Promise<void> {
  if (!ctx.state.user) return;
  if (ctx.state.user.tos_accepted_at) {
    await ctx.reply("You have already accepted the risk disclosure.");
    return;
  }
  const keyboard = new InlineKeyboard().text("Accept", "tos:accept");
  await ctx.reply(
    [
      bold("Risk disclosure"),
      "",
      "DreamPilot runs autonomous trading agents against perpetual futures on DreamDEX,",
      "a testnet venue on Somnia. Read this before you continue.",
      "",
      "1. Trading perps with leverage can lose more than you deposit.",
      "2. Your agent acts on its own. It may open, close or miss trades without asking.",
      "3. Exit orders (take-profit and stop-loss) are watched by the agent process, not",
      "   armed on the exchange. If the agent is not running, they do not fire.",
      "4. This is a testnet deployment. Do not use funds you cannot afford to lose.",
      "5. You are responsible for the limits you set and the account you link.",
      "",
      "DreamPilot holds a bot key that can trade your account but cannot withdraw from it.",
    ].join("\n"),
    { parse_mode: "HTML", reply_markup: keyboard },
  );
}

export async function onTosCallback(ctx: AppCtx): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!ctx.state.user || !data?.startsWith("tos:")) return;
  await ctx.answerCallbackQuery();
  if (data === "tos:accept") {
    await ctx.app.store.acceptTos(ctx.state.user.telegram_id);
    ctx.state.user.tos_accepted_at = new Date();
    await ctx.editMessageText("Accepted. Next: /connect to create your bot key.", {
      parse_mode: "HTML",
    });
  }
}

// ── /connect ────────────────────────────────────────────────────────────────

export async function connectCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;

  if (!user.tos_accepted_at) {
    await ctx.reply("Accept the risk disclosure first with /tos.");
    return;
  }

  // Reuse an existing bot key so the link in the app keeps working across
  // restarts; only mint a new one when the account is not set up yet.
  const existing = ctx.state.account;
  if (existing) {
    await ctx.reply(
      [
        bold("Your bot key is already created."),
        "",
        `Bot key address: ${code(existing.bot_key_address)}`,
        `Your account:    ${code(existing.account_address)}`,
        existing.linked_at ? "Status: linked" : "Status: not linked yet",
        "",
        "In the DreamDEX app: open your wallet, choose " + bold("Link a bot") + ", tick " + bold("Perps") + ",",
        "and paste the bot key address above. Then run /risk and /deploy.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return;
  }

  const key = generateBotKey();
  const encrypted = ctx.app.cipher.encrypt(key.privateKey);
  await ctx.app.store.saveAccount({
    telegram_id: user.telegram_id,
    account_address: "",
    bot_key_address: key.address,
    bot_key_encrypted: encrypted,
    network: ctx.app.config.NETWORK,
    linked_at: null,
  });

  await ctx.reply(
    [
      bold("Your bot key has been created."),
      "",
      `Bot key address: ${code(key.address)}`,
      "",
      `${bold("Now link it in the DreamDEX app:")}`,
      "1. Open the DreamDEX app and connect your wallet.",
      "2. Open your wallet menu and choose " + bold("Link a bot") + ".",
      "3. Tick " + bold("Perps") + " and paste the bot key address above.",
      "4. Add it, then send the bot key some STT for gas.",
      "",
      "This key can place, cancel and reduce orders on the account you linked it to.",
      "It cannot withdraw or transfer funds.",
      "",
      "When you are done, tell me your account address with:",
      `${code("/connect 0xYourAccountAddress")}`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

/** `/connect 0x...` records the account address the bot key was linked to. */
export async function connectWithAddressCmd(ctx: AppCtx, address: string): Promise<void> {
  const { user, account } = ctx.state;
  if (!user || !account) {
    await ctx.reply("Create your bot key first with /connect.");
    return;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
    await ctx.reply("That does not look like an address. Send /connect 0x followed by 40 hex characters.");
    return;
  }
  const accountAddress = address.trim() as `0x${string}`;

  // Prove the link before recording it. Without this the bot would happily store
  // an address the key has no permission on, and the failure would only surface
  // as a rejected order later.
  try {
    const { createTradingContext, perpMarkets, tradingKeyCheck } = await import("@dreampilot/somnia");
    const privateKey = ctx.app.cipher.decrypt(account.bot_key_encrypted) as `0x${string}`;
    const trading = createTradingContext({
      network: ctx.app.config.NETWORK,
      owner: accountAddress,
      botPrivateKey: privateKey,
    });
    try {
      const markets = await perpMarkets(trading.exchange);
      const first = markets[0];
      if (!first) {
        await ctx.reply("No perp markets were returned, so the link cannot be checked. Try again shortly.");
        return;
      }
      const check = await tradingKeyCheck(trading, first);
      if (!check.ok) {
        await ctx.reply(
          [
            bold("That link is not active yet."),
            check.message ?? "The bot key is not linked to that account.",
            "",
            `In the DreamDEX app, add ${code(account.bot_key_address)} as a bot on that account and tick ${bold("Perps")}, then send /connect again.`,
          ].join("\n"),
          { parse_mode: "HTML" },
        );
        return;
      }
    } finally {
      const { shutdown } = await import("@dreampilot/somnia");
      await shutdown(trading);
    }
  } catch (err) {
    await ctx.reply(
      `Could not reach DreamDEX to check the link: ${escapeHtml(err instanceof Error ? err.message : String(err))}. Try /connect again in a moment.`,
    );
    return;
  }

  await ctx.app.store.saveAccount({
    ...account,
    account_address: accountAddress,
    linked_at: new Date(),
  });
  await ctx.reply(
    [
      bold("Account connected."),
      "",
      `Account: ${code(accountAddress)}`,
      `Bot key: ${code(account.bot_key_address)}`,
      "",
      "Next: /risk to set your limits, then /deploy to start an agent.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

// ── /agents ─────────────────────────────────────────────────────────────────

export async function agentsCmd(ctx: AppCtx): Promise<void> {
  const lines = [bold("Available trading agents"), ""];
  for (const s of STRATEGIES) {
    lines.push(`${bold(s.label)}  ${code(s.key)}`);
    lines.push(`   ${escapeHtml(s.description)}`);
  }
  lines.push("");
  lines.push(`Start one with ${code("/deploy <key> <market>")}, e.g. ${code("/deploy trend-rider BTC-PERP")}`);
  lines.push(`Set limits first with ${code("/risk")}.`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ── /risk ───────────────────────────────────────────────────────────────────

export async function riskCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const agents = await ctx.app.store.listAgents(user.telegram_id);
  if (agents.length === 0) {
    await ctx.reply(
      [
        bold("Default risk limits"),
        "",
        "You have no agent yet, so these defaults apply when you deploy:",
        `  Max leverage:        ${2}x`,
        `  Margin per trade:    $25`,
        `  Max total margin:    $100`,
        `  Max open positions:  1`,
        `  Max daily loss:      $25`,
        "",
        "To change them, send:",
        `${code("/risk <maxLeverage> <marginPerTrade> <maxTotalMargin> <maxPositions> <maxDailyLoss>")}`,
        `e.g. ${code("/risk 3 20 60 2 30")}`,
        "",
        "To set limits on an existing agent, pass its id:",
        `${code("/risk <agentId> <maxLeverage> <marginPerTrade> <maxTotalMargin> <maxPositions> <maxDailyLoss>")}`,
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return;
  }
  const lines = [bold("Risk limits"), ""];
  for (const a of agents) {
    lines.push(
      `Agent ${code(String(a.id))} ${bold(a.strategy)} on ${escapeHtml(a.market)} - ${a.status}\n` +
        `  leverage ${a.max_leverage}x | per trade ${fmtUsd(a.margin_per_trade)} | ` +
        `total ${fmtUsd(a.max_total_margin)} | max ${a.max_open_positions} open | ` +
        `daily loss ${a.max_daily_loss === null ? "none" : fmtUsd(a.max_daily_loss)}`,
    );
  }
  lines.push("");
  lines.push(`${code("/risk <agentId> <lev> <perTrade> <total> <maxOpen> <dailyLoss>")}`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

/** Parse and apply a risk-limits update. Returns an error string, or undefined. */
export async function applyRiskLimits(
  ctx: AppCtx,
  parts: string[],
): Promise<string | undefined> {
  const { user } = ctx.state;
  if (!user) return undefined;
  const agents = await ctx.app.store.listAgents(user.telegram_id);
  if (agents.length === 0) return "You have no agent to configure yet. Deploy one first with /deploy.";

  // With six numbers, the first is the agent id. With five, apply to the newest.
  let agent: Agent | undefined;
  let nums: number[];
  if (parts.length >= 6) {
    agent = agents.find((a) => a.id === Number(parts[0]));
    nums = parts.slice(1).map(Number);
  } else {
    agent = agents[0];
    nums = parts.map(Number);
  }
  if (!agent) return `No agent with that id. Your agents: ${agents.map((a) => a.id).join(", ")}.`;
  if (nums.length < 5 || nums.some((n) => !Number.isFinite(n))) {
    return "Send five numbers: /risk <lev> <perTrade> <total> <maxOpen> <dailyLoss>";
  }
  const [maxLeverage, marginPerTrade, maxTotalMargin, maxOpen, dailyLoss] = nums as [
    number,
    number,
    number,
    number,
    number,
  ];
  const parsed = RiskLimitsSchema.safeParse({
    markets: agent.markets,
    maxLeverage,
    marginPerTradeUsd: marginPerTrade,
    maxTotalMarginUsd: maxTotalMargin,
    maxOpenPositions: maxOpen,
    maxDailyLossUsd: dailyLoss > 0 ? dailyLoss : undefined,
  });
  if (!parsed.success) {
    return `Those limits are not valid: ${parsed.error.issues.map((i) => i.message).join("; ")}`;
  }
  await ctx.app.store.updateAgentLimits(agent.id, {
    max_leverage: maxLeverage,
    margin_per_trade: marginPerTrade,
    max_total_margin: maxTotalMargin,
    max_open_positions: maxOpen,
    max_daily_loss: dailyLoss > 0 ? dailyLoss : null,
  });
  await ctx.reply(
    [
      bold(`Limits updated for agent ${agent.id}.`),
      "",
      `Max leverage:      ${maxLeverage}x`,
      `Margin per trade:  ${fmtUsd(marginPerTrade)}`,
      `Max total margin:  ${fmtUsd(maxTotalMargin)}`,
      `Max open:          ${maxOpen}`,
      `Max daily loss:    ${dailyLoss > 0 ? fmtUsd(dailyLoss) : "none"}`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
  return undefined;
}

// ── /deploy ─────────────────────────────────────────────────────────────────

export async function deployCmd(ctx: AppCtx, parts: string[]): Promise<void> {
  const { user, account } = ctx.state;
  if (!user) return;
  if (!account) {
    await ctx.reply("Connect a trading account first with /connect.");
    return;
  }
  const strategyKey = parts[0];
  const market = parts[1]?.toUpperCase();
  const thesis = parts.slice(2).join(" ") || null;
  if (!strategyKey || !market) {
    await ctx.reply(
      [
        `Usage: ${code("/deploy <strategy> <market> [guidance]")}`,
        `Example: ${code("/deploy trend-rider BTC-PERP")}`,
        "",
        `Strategies: ${STRATEGIES.map((s) => s.key).join(", ")}`,
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return;
  }
  const descriptor = strategyByKey(strategyKey);
  if (!descriptor) {
    await ctx.reply(`Unknown strategy "${strategyKey}". Try one of: ${STRATEGIES.map((s) => s.key).join(", ")}`);
    return;
  }

  const agents = await ctx.app.store.listAgents(user.telegram_id);
  if (agents.some((a) => a.status === "running")) {
    await ctx.reply("You already have a running agent. Pause it with /pause before deploying another.");
    return;
  }

  const created = await ctx.app.store.createAgent({
    telegram_id: user.telegram_id,
    strategy: descriptor.key,
    market: `${market.replace(/-PERP$/, "")}-PERP`,
    max_leverage: 2,
    margin_per_trade: 25,
    max_total_margin: 100,
    max_open_positions: 1,
    max_daily_loss: 25,
    markets: [`${market.replace(/-PERP$/, "")}-PERP`],
    thesis,
    journal_path: journalPathFor(ctx.app.journalRoot, user.telegram_id, `${descriptor.key}-${Date.now()}`),
  });

  await ctx.app.store.setAgentStatus(created.id, "running");
  await ctx.reply(
    [
      bold(`Agent ${created.id} deployed.`),
      "",
      `Strategy: ${descriptor.label}`,
      `Market:   ${escapeHtml(created.market)}`,
      `Limits:   ${created.max_leverage}x | ${fmtUsd(created.margin_per_trade)} per trade | ` +
        `${fmtUsd(created.max_daily_loss)} daily loss cap`,
      "",
      ctx.app.config.AGENTS_DRY_RUN
        ? "The operator has paper mode on, so this agent will simulate fills against real prices."
        : "This agent trades your linked account for real, within the limits above.",
      "",
      "Take-profit and stop-loss are watched by the agent process. If it is not running, they do not fire.",
      "",
      `Change limits with ${code(`/risk ${created.id} <lev> <perTrade> <total> <maxOpen> <dailyLoss>`)}`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

// ── /positions ──────────────────────────────────────────────────────────────

export async function positionsCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const positions = await ctx.app.store.openPositionsForUser(user.telegram_id);
  if (positions.length === 0) {
    await ctx.reply("No open positions.");
    return;
  }
  const lines = [bold("Open positions"), ""];
  for (const p of positions) {
    lines.push(
      `${bold(p.market)} ${p.side === "long" ? "LONG" : "SHORT"}  (agent ${p.id})\n` +
        `  size ${fmtNum(p.size, 6)} @ ${fmtUsd(p.entry_price)}\n` +
        `  margin ${fmtUsd(p.margin_usd)} | ${p.leverage}x\n` +
        `  take-profit ${p.take_profit === null ? "-" : fmtUsd(p.take_profit)} | ` +
        `stop-loss ${p.stop_loss === null ? "-" : fmtUsd(p.stop_loss)}`,
    );
  }
  lines.push("");
  lines.push(`Close everything with ${code("/closeall")}.`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ── /pause, /resume, /closeall ──────────────────────────────────────────────

export async function pauseCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const running = (await ctx.app.store.listAgents(user.telegram_id)).filter((a) => a.status === "running");
  if (running.length === 0) {
    await ctx.reply("You have no running agent.");
    return;
  }
  for (const a of running) await ctx.app.store.setAgentStatus(a.id, "paused");
  await ctx.reply(
    [
      bold(`Paused ${running.length} agent(s).`),
      "",
      "Open positions are left as they are, and their exits are no longer watched.",
      "Close them with /closeall, or resume with /resume.",
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

export async function resumeCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const paused = (await ctx.app.store.listAgents(user.telegram_id)).filter((a) => a.status === "paused");
  if (paused.length === 0) {
    await ctx.reply("You have no paused agent.");
    return;
  }
  for (const a of paused) await ctx.app.store.setAgentStatus(a.id, "running");
  await ctx.reply(bold(`Resumed ${paused.length} agent(s).`), { parse_mode: "HTML" });
}

export async function closeAllCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const agents = await ctx.app.store.listAgents(user.telegram_id);
  const running = agents.filter((a) => a.status === "running");
  for (const a of running) await ctx.app.store.setAgentStatus(a.id, "paused");

  const positions = await ctx.app.store.openPositionsForUser(user.telegram_id);
  if (positions.length === 0) {
    await ctx.reply("No open positions. Running agents are paused.");
    return;
  }

  const account = ctx.state.account;
  if (!account) {
    await ctx.reply("No linked account, so nothing can be closed. Agents are paused.");
    return;
  }

  const lines = [bold(`Closing ${positions.length} position(s).`), ""];
  let live: { account: `0x${string}`; botPrivateKey: `0x${string}`; network: string } | undefined;
  if (!ctx.app.config.AGENTS_DRY_RUN) {
    try {
      const privateKey = ctx.app.cipher.decrypt(account.bot_key_encrypted) as `0x${string}`;
      live = { account: account.account_address as `0x${string}`, botPrivateKey: privateKey, network: account.network };
    } catch (err) {
      await ctx.reply(`Could not read your bot key: ${(err as Error).message}`);
      return;
    }
  }

  const { venue, paper } = buildVenue({
    network: account.network,
    live,
    dryRun: ctx.app.config.AGENTS_DRY_RUN,
  });

  for (const p of positions) {
    try {
      const fill = await venue.close({ market: p.market, fraction: 1, reason: "closeall" });
      await ctx.app.store.closePosition(p.id, "closeall", 0);
      await ctx.app.store.record({
        telegram_id: user.telegram_id,
        agent_id: p.agent_id,
        action: "closeall",
        market: p.market,
        side: p.side,
        status: fill.noFill ? "no_fill" : "ok",
        tx_hash: fill.txHash ?? null,
      });
      lines.push(`${p.market}: ${fill.noFill ? "nothing crossed" : `closed ${fmtNum(fill.size, 6)}`}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ctx.app.store.record({
        telegram_id: user.telegram_id,
        agent_id: p.agent_id,
        action: "closeall",
        market: p.market,
        status: "error",
        error: message,
      });
      lines.push(`${p.market}: failed - ${escapeHtml(message)}`);
    }
  }
  if (paper) lines.push("", "(paper mode: no orders were sent)");
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ── /pnl ────────────────────────────────────────────────────────────────────

export async function pnlCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const day = await ctx.app.store.pnlSummary(user.telegram_id, 24);
  const week = await ctx.app.store.pnlSummary(user.telegram_id, 24 * 7);
  await ctx.reply(
    [
      bold("Performance"),
      "",
      `${bold("Last 24h")}`,
      `  realized ${fmtSignedUsd(day.realizedUsd)} over ${day.trades} trade(s)`,
      `  wins ${day.wins} | losses ${day.losses}`,
      "",
      `${bold("Last 7 days")}`,
      `  realized ${fmtSignedUsd(week.realizedUsd)} over ${week.trades} trade(s)`,
      `  wins ${week.wins} | losses ${week.losses}`,
    ].join("\n"),
    { parse_mode: "HTML" },
  );
}

// ── /fund and /withdraw ─────────────────────────────────────────────────────

/**
 * A deep link that opens MetaMask (or any wallet) with the call ready to sign.
 * The transfer is between the user's wallet and the contract, so the bot key is
 * never involved and cannot be: it has no permission to move collateral.
 */
export function walletDeepLink(call: { to: string; data: string; value?: bigint; chainId: number }): string {
  const value = call.value && call.value > 0n ? `0x${call.value.toString(16)}` : "";
  return `https://metamask.app.link/send/${call.to}@${call.chainId}?value=${value}&data=${call.data}`;
}

/**
 * Report the account's margin state, or say clearly why it cannot be read. Used
 * by /fund, /withdraw and /status so the user sees one consistent picture.
 */
async function marginState(
  ctx: AppCtx,
  address: `0x${string}`,
): Promise<{ ok: true; unlocked: string; withdrawable: string; equity: string; symbol: string } | { ok: false; message: string }> {
  try {
    const { createReadOnly, perpMarkets, marginSnapshot } = await import("@dreampilot/somnia");
    const trading = createReadOnly({ network: ctx.app.config.NETWORK });
    const markets = await perpMarkets(trading.exchange);
    const first = markets[0];
    if (!first) return { ok: false, message: "DreamDEX returned no perp markets, so margin cannot be read right now." };
    const snap = await marginSnapshot(trading.exchange, first, address);
    const decimals = first.info.quoteDecimals;
    const human = (v: bigint) => (Number(v) / 10 ** decimals).toFixed(2);
    return {
      ok: true,
      unlocked: human(snap.unlocked),
      withdrawable: human(snap.withdrawable),
      equity: human(snap.equity),
      symbol: first.info.quoteSymbol,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** `/fund` - show the margin state, and how to add collateral. */
export async function fundCmd(ctx: AppCtx): Promise<void> {
  const { user, account } = ctx.state;
  if (!user || !account) {
    await ctx.reply("Connect a trading account first with /connect.");
    return;
  }
  if (!account.account_address) {
    await ctx.reply("Your account address is not set yet. Finish /connect first.");
    return;
  }
  const state = await marginState(ctx, account.account_address as `0x${string}`);
  const lines = [bold("Perps margin account"), ""];
  const symbol = state.ok ? state.symbol : "USDso";
  if (state.ok) {
    lines.push(`Account:       ${code(shortAddr(account.account_address))}`);
    lines.push(`Unlocked:      ${state.unlocked} ${escapeHtml(state.symbol)}`);
    lines.push(`Withdrawable:  ${state.withdrawable} ${escapeHtml(state.symbol)}`);
    lines.push(`Equity:        ${state.equity} ${escapeHtml(state.symbol)}`);
  } else {
    lines.push(`Could not read margin: ${escapeHtml(state.message)}`);
  }
  lines.push(
    "",
    bold("To add collateral"),
    "Perp orders lock margin from your DreamDEX perps balance, not from your spot wallet.",
    "DreamPilot cannot do this for you: your bot key can trade, but it cannot move funds.",
    "",
    `${bold("In the app:")} open Perps <-> Spot and move ${escapeHtml(symbol)} into the perps account.`,
    "",
    `Then check with ${code("/fund")} again, and ${code("/deploy")} to start an agent.`,
  );
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

/** `/fund <amount>` - build the approve+deposit calls for the user to sign. */
export async function fundBuildCmd(ctx: AppCtx, amount: number): Promise<void> {
  const { user, account } = ctx.state;
  if (!user || !account) {
    await ctx.reply("Connect a trading account first with /connect.");
    return;
  }
  if (!account.account_address) {
    await ctx.reply("Your account address is not set yet. Finish /connect first.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply(`Usage: ${code("/fund <amount>")}, for example ${code("/fund 100")}.`);
    return;
  }

  let plan;
  try {
    const { createReadOnly, perpMarkets, buildFundingPlan, liveReads } = await import("@dreampilot/somnia");
    const trading = createReadOnly({ network: ctx.app.config.NETWORK });
    const markets = await perpMarkets(trading.exchange);
    const first = markets[0];
    if (!first) {
      await ctx.reply("DreamDEX returned no perp markets, so a deposit cannot be built right now.");
      return;
    }
    plan = await buildFundingPlan(
      trading.exchange,
      first,
      account.account_address as `0x${string}`,
      amount,
      liveReads(trading),
    );
  } catch (err) {
    await ctx.reply(`Could not build the deposit: ${escapeHtml(err instanceof Error ? err.message : String(err))}`);
    return;
  }

  const lines = [
    bold(`Fund ${amount} into your perps margin account`),
    "",
    "These calls move your own funds, so only your wallet can sign them. DreamPilot cannot,",
    "and neither can your bot key - it can trade but never move collateral.",
    "",
  ];
  if (plan.approval) {
    lines.push(
      `${bold("Step 1")} - approve the bank to pull your collateral`,
      `${code(plan.approval.to)}`,
      `Calldata: ${code(plan.approval.data)}`,
      "",
    );
  }
  lines.push(
    `${bold(plan.approval ? "Step 2" : "Call")} - deposit`,
    `${code(plan.deposit.to)}`,
    `Calldata: ${code(plan.deposit.data)}`,
    "",
    `Chain id: ${plan.deposit.chainId}`,
  );
  if (plan.approval) {
    lines.push("", `${bold("Open in a wallet:")} ${walletDeepLink(plan.approval)}`);
  }
  lines.push(`${bold("Open in a wallet:")} ${walletDeepLink(plan.deposit)}`);
  lines.push("", `After it confirms, check with ${code("/fund")}.`);
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
}

/** `/withdraw <amount>` - build the withdrawal call for the user to sign. */
export async function withdrawBuildCmd(ctx: AppCtx, amount: number): Promise<void> {
  const { user, account } = ctx.state;
  if (!user || !account) {
    await ctx.reply("Connect a trading account first with /connect.");
    return;
  }
  if (!account.account_address) {
    await ctx.reply("Your account address is not set yet. Finish /connect first.");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply(`Usage: ${code("/withdraw <amount>")}, for example ${code("/withdraw 50")}.`);
    return;
  }

  let plan;
  try {
    const { createReadOnly, perpMarkets, buildWithdrawPlan, liveReads } = await import("@dreampilot/somnia");
    const trading = createReadOnly({ network: ctx.app.config.NETWORK });
    const markets = await perpMarkets(trading.exchange);
    const first = markets[0];
    if (!first) {
      await ctx.reply("DreamDEX returned no perp markets, so a withdrawal cannot be built right now.");
      return;
    }
    plan = await buildWithdrawPlan(trading.exchange, first, amount, liveReads(trading));
  } catch (err) {
    await ctx.reply(`Could not build the withdrawal: ${escapeHtml(err instanceof Error ? err.message : String(err))}`);
    return;
  }

  await ctx.reply(
    [
      bold(`Withdraw ${amount} from your perps margin account`),
      "",
      "The bank checks this on-chain against your open positions, so an amount that would",
      "undermine them will revert. Only your wallet can sign it.",
      "",
      `${code(plan.withdraw.to)}`,
      `Calldata: ${code(plan.withdraw.data)}`,
      `Chain id: ${plan.withdraw.chainId}`,
      "",
      `${bold("Open in a wallet:")} ${walletDeepLink(plan.withdraw)}`,
      "",
      `Free margin right now: ${code("/fund")} shows it.`,
    ].join("\n"),
    { parse_mode: "HTML", link_preview_options: { is_disabled: true } },
  );
}

// ── /notify ─────────────────────────────────────────────────────────────────

/** `/notify` - show or change which events the agent messages the user about. */
export async function notifyCmd(ctx: AppCtx, parts: string[]): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const current = await ctx.app.store.getNotify(user.telegram_id);
  const prefs = {
    onOpen: current?.on_open ?? true,
    onClose: current?.on_close ?? true,
    onRefuse: current?.on_refuse ?? false,
  };

  if (parts.length === 0) {
    const mark = (on: boolean) => (on ? "on" : "off");
    await ctx.reply(
      [
        bold("Notifications"),
        "",
        `Open:    ${mark(prefs.onOpen)}`,
        `Close:   ${mark(prefs.onClose)}`,
        `Refused: ${mark(prefs.onRefuse)}`,
        "",
        "Refusals are off by default: a strategy whose trades keep getting clamped would",
        "otherwise message you every tick.",
        "",
        `Change with ${code("/notify open off")}, ${code("/notify close off")}, ${code("/notify refuse on")}.`,
      ].join("\n"),
      { parse_mode: "HTML" },
    );
    return;
  }

  const field = parts[0]?.toLowerCase();
  const value = parts[1]?.toLowerCase();
  const on = value === "on" || value === "true" || value === "1";
  const off = value === "off" || value === "false" || value === "0";
  if (!field || (!on && !off)) {
    await ctx.reply(`Usage: ${code("/notify <open|close|refuse> <on|off>")}`);
    return;
  }
  const patch: { on_open?: boolean; on_close?: boolean; on_refuse?: boolean } = {};
  if (field === "open") patch.on_open = on;
  else if (field === "close") patch.on_close = on;
  else if (field === "refuse" || field === "refused") patch.on_refuse = on;
  else {
    await ctx.reply(`Unknown setting "${escapeHtml(field)}". Use open, close or refuse.`);
    return;
  }
  await ctx.app.store.saveNotify(user.telegram_id, patch);
  await ctx.reply(bold(`${field} notifications ${on ? "on" : "off"}.`), { parse_mode: "HTML" });
}

// ── /status ─────────────────────────────────────────────────────────────────

export async function statusCmd(ctx: AppCtx): Promise<void> {
  const { user, account } = ctx.state;
  if (!user) return;
  const agents = await ctx.app.store.listAgents(user.telegram_id);
  const positions = await ctx.app.store.openPositionsForUser(user.telegram_id);
  const lines = [
    bold("Status"),
    "",
    `Disclosure: ${user.tos_accepted_at ? "accepted" : "not accepted"}`,
    account
      ? `Account:    ${code(shortAddr(account.account_address || "(not set)"))}\n` +
        `Bot key:    ${code(account.bot_key_address)}\n` +
        `Linked:     ${account.linked_at ? "yes" : "no"}`
      : "Account:    not connected",
    `Agents:     ${agents.length === 0 ? "none" : agents.map((a) => `${a.id} ${a.strategy} (${a.status})`).join(", ")}`,
    `Positions:  ${positions.length}`,
    `Mode:       ${ctx.app.config.AGENTS_DRY_RUN ? "paper (operator)" : "live"}`,
    `Network:    ${ctx.app.config.NETWORK}`,
  ];
  if (account?.account_address) {
    const m = await marginState(ctx, account.account_address as `0x${string}`);
    lines.splice(
      4,
      0,
      m.ok
        ? `Margin:     ${m.unlocked} unlocked, ${m.withdrawable} withdrawable (${escapeHtml(m.symbol)})`
        : `Margin:     unavailable (${escapeHtml(m.message)})`,
    );
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

// ── /journal ────────────────────────────────────────────────────────────────

export async function journalCmd(ctx: AppCtx): Promise<void> {
  const { user } = ctx.state;
  if (!user) return;
  const audit = await ctx.app.store.recentAudit(user.telegram_id, 10);
  if (audit.length === 0) {
    await ctx.reply("No decisions recorded yet.");
    return;
  }
  const lines = [bold("Recent agent decisions"), ""];
  for (const a of audit) {
    lines.push(
      `${a.created_at.toISOString().slice(0, 16).replace("T", " ")}  ${bold(a.action)}` +
        `${a.market ? ` ${escapeHtml(a.market)}` : ""}  [${a.status}]` +
        (a.error ? `\n   ${escapeHtml(a.error.slice(0, 160))}` : ""),
    );
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

export { NETWORKS };
