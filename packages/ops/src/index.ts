// @dreampilot/ops - the control plane.
//
// The bot and the dashboard perform the same operations on the same data, and
// this is the one place they are implemented. The bot wraps these in chat
// formatting; the web app wraps them in HTTP. Neither reimplements the rules,
// so a limit that holds in Telegram holds in the browser.
//
// Nothing here talks to grammY or to HTTP, which is what lets both callers share
// it and lets the tests drive it with an in-memory store and no network.

import { buildVenue, SomniaVenue, strategyByKey, STRATEGIES, type Venue } from "@dreampilot/agent";
import { RiskLimitsSchema } from "@dreampilot/risk";
import {
  createReadOnly,
  createTradingContext,
  perpMarkets,
  shutdown,
  tradingKeyCheck,
} from "@dreampilot/somnia";
import type { Agent, AgentStatus, Cipher, Store } from "@dreampilot/store";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface OpsDeps {
  store: Store;
  cipher: Cipher;
  /** Which Somnia perp deployment to read and trade. */
  network: string;
  /** Operator master switch. True means every agent simulates fills. */
  dryRun: boolean;
  /** Journal root; one file per agent lives under it. */
  journalRoot: string;
  /**
   * The live market list, for validating a deploy. Injected so the tests do not
   * need the network; the default reads the chain.
   */
  listMarkets?: () => Promise<string[]>;
}

export interface OpResult {
  ok: boolean;
  /** A line for a human, and the reason when ok is false. */
  message: string;
  /** Present when the operation produced or touched an agent. */
  agent?: Agent;
}

/** The market list the venue reports, for deploy validation. */
export async function liveMarkets(deps: OpsDeps): Promise<string[]> {
  if (deps.listMarkets) return deps.listMarkets();
  const ctx = createReadOnly({ network: deps.network });
  try {
    const markets = await perpMarkets(ctx.exchange);
    return markets.map((m) => m.display);
  } finally {
    await shutdown(ctx);
  }
}

// ── bot keys and account linking ────────────────────────────────────────────

export interface BotKey {
  address: `0x${string}`;
  /** True when the key already existed, so the UI can say "already created". */
  existing: boolean;
}

/**
 * Create the user's bot key if they do not have one, and return its address.
 *
 * Idempotent: an existing key is reused rather than replaced, because replacing
 * it would silently break the link the user already added in the DreamDEX app.
 */
export async function ensureBotKey(deps: OpsDeps, telegramId: number): Promise<BotKey> {
  const existing = await deps.store.getAccount(telegramId);
  if (existing) return { address: existing.bot_key_address as `0x${string}`, existing: true };

  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  await deps.store.saveAccount({
    telegram_id: telegramId,
    account_address: "",
    bot_key_address: address,
    bot_key_encrypted: deps.cipher.encrypt(privateKey),
    network: deps.network,
    linked_at: null,
  });
  return { address, existing: false };
}

/**
 * Record the account a bot key was linked to, after proving the link is live.
 *
 * The check matters: without it the store would hold an address the key has no
 * permission on, and the failure would only surface later as a rejected order.
 */
export async function linkAccount(
  deps: OpsDeps,
  telegramId: number,
  address: string,
): Promise<OpResult> {
  const account = await deps.store.getAccount(telegramId);
  if (!account) return { ok: false, message: "Create a bot key first." };
  if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
    return { ok: false, message: "That is not an address: it must be 0x followed by 40 hex characters." };
  }
  const accountAddress = address.trim() as `0x${string}`;

  const ctx = createTradingContext({
    network: deps.network,
    owner: accountAddress,
    botPrivateKey: deps.cipher.decrypt(account.bot_key_encrypted) as `0x${string}`,
  });
  try {
    const markets = await perpMarkets(ctx.exchange);
    const first = markets[0];
    if (!first) return { ok: false, message: "No perp markets were returned, so the link cannot be checked." };
    const check = await tradingKeyCheck(ctx, first);
    if (!check.ok) {
      return {
        ok: false,
        message: `${check.message ?? "The bot key is not linked to that account."} Add ${account.bot_key_address} as a bot on that account and tick Perps, then try again.`,
      };
    }
  } catch (err) {
    return { ok: false, message: `Could not reach DreamDEX to check the link: ${err instanceof Error ? err.message : String(err)}` };
  } finally {
    await shutdown(ctx);
  }

  await deps.store.saveAccount({ ...account, account_address: accountAddress, linked_at: new Date() });
  return { ok: true, message: `Linked to ${accountAddress}.` };
}

// ── agents ──────────────────────────────────────────────────────────────────

/** The five numbers that describe an agent's risk limits. */
export interface Limits {
  maxLeverage: number;
  marginPerTrade: number;
  maxTotalMargin: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
}

/** The default limits a new agent starts with, before the user tunes them. */
export const DEFAULT_LIMITS: Limits = {
  maxLeverage: 2,
  marginPerTrade: 25,
  maxTotalMargin: 100,
  maxOpenPositions: 1,
  maxDailyLoss: 25,
};

export interface DeployInput {
  telegramId: number;
  strategy: string;
  market: string;
  limits?: Partial<Limits>;
  thesis?: string | null;
  /** Skip the live listing check. Used by tests. */
  skipMarketCheck?: boolean;
}

/** "btc" and "btc-perp" both become "BTC-PERP". */
export function normalizeMarket(raw: string): string {
  return `${raw.trim().toUpperCase().replace(/-PERP$/, "")}-PERP`;
}

/**
 * Create and start an agent, inside the limits it will be held to.
 *
 * The market is checked against the live list so a typo cannot produce an agent
 * that silently never trades. One running agent per user is the current rule:
 * two would race on the same margin budget.
 */
export async function deployAgent(deps: OpsDeps, input: DeployInput): Promise<OpResult> {
  const account = await deps.store.getAccount(input.telegramId);
  if (!account || !account.account_address) {
    return { ok: false, message: "Connect a trading account first." };
  }

  const descriptor = strategyByKey(input.strategy);
  if (!descriptor) {
    return { ok: false, message: `Unknown strategy "${input.strategy}". Try one of: ${STRATEGIES.map((s) => s.key).join(", ")}` };
  }

  const market = normalizeMarket(input.market);
  if (!input.skipMarketCheck) {
    try {
      const listed = await liveMarkets(deps);
      if (listed.length > 0 && !listed.includes(market)) {
        return { ok: false, message: `${market} is not a listed perp market. Try one of: ${listed.slice(0, 8).join(", ")}...` };
      }
    } catch (err) {
      return { ok: false, message: `Could not read the market list: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  const agents = await deps.store.listAgents(input.telegramId);
  if (agents.some((a) => a.status === "running")) {
    return { ok: false, message: "You already have a running agent. Pause it before deploying another." };
  }

  const limits = { ...DEFAULT_LIMITS, ...input.limits };
  const parsed = RiskLimitsSchema.safeParse({
    markets: [market],
    maxLeverage: limits.maxLeverage,
    marginPerTradeUsd: limits.marginPerTrade,
    maxTotalMarginUsd: limits.maxTotalMargin,
    maxOpenPositions: limits.maxOpenPositions,
    maxDailyLossUsd: limits.maxDailyLoss > 0 ? limits.maxDailyLoss : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: `Those limits are not valid: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }

  const created = await deps.store.createAgent({
    telegram_id: input.telegramId,
    strategy: descriptor.key,
    market,
    max_leverage: limits.maxLeverage,
    margin_per_trade: limits.marginPerTrade,
    max_total_margin: limits.maxTotalMargin,
    max_open_positions: limits.maxOpenPositions,
    max_daily_loss: limits.maxDailyLoss > 0 ? limits.maxDailyLoss : null,
    markets: [market],
    thesis: input.thesis ?? null,
    journal_path: journalPathFor(deps.journalRoot, input.telegramId, `${descriptor.key}-${Date.now()}`),
  });
  await deps.store.setAgentStatus(created.id, "running");
  const agent = (await deps.store.getAgent(created.id))!;
  return {
    ok: true,
    message: deps.dryRun
      ? `Agent ${agent.id} deployed on ${market}. The operator has paper mode on, so it will simulate fills against real prices.`
      : `Agent ${agent.id} deployed on ${market}. It trades your linked account for real, inside the limits you set.`,
    agent,
  };
}

/** The journal path for a new agent, under the configured root. */
export function journalPathFor(root: string, telegramId: number, label: string | number): string {
  return `${root}/${telegramId}/${label}.jsonl`;
}

/**
 * Pause, resume or stop one of the user's agents.
 *
 * Scoped by telegram_id: an agent id from another account resolves to nothing
 * rather than being acted on, so a guessed id cannot touch someone else's agent.
 */
export async function setAgentStatus(
  deps: OpsDeps,
  telegramId: number,
  agentId: number,
  status: AgentStatus,
): Promise<OpResult> {
  const agent = await deps.store.getAgent(agentId);
  if (!agent || agent.telegram_id !== telegramId) {
    return { ok: false, message: "No agent with that id." };
  }
  await deps.store.setAgentStatus(agentId, status);
  const verb = status === "running" ? "Resumed" : status === "paused" ? "Paused" : "Stopped";
  return { ok: true, message: `${verb} agent ${agentId}.`, agent: { ...agent, status } };
}

export interface LimitsInput {
  maxLeverage: number;
  marginPerTrade: number;
  maxTotalMargin: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
}

/** Update an agent's limits, validated against the same schema the engine uses. */
export async function setAgentLimits(
  deps: OpsDeps,
  telegramId: number,
  agentId: number,
  limits: LimitsInput,
): Promise<OpResult> {
  const agent = await deps.store.getAgent(agentId);
  if (!agent || agent.telegram_id !== telegramId) {
    return { ok: false, message: "No agent with that id." };
  }
  const parsed = RiskLimitsSchema.safeParse({
    markets: agent.markets.length > 0 ? agent.markets : [agent.market],
    maxLeverage: limits.maxLeverage,
    marginPerTradeUsd: limits.marginPerTrade,
    maxTotalMarginUsd: limits.maxTotalMargin,
    maxOpenPositions: limits.maxOpenPositions,
    maxDailyLossUsd: limits.maxDailyLoss > 0 ? limits.maxDailyLoss : undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: `Those limits are not valid: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  await deps.store.updateAgentLimits(agentId, {
    max_leverage: limits.maxLeverage,
    margin_per_trade: limits.marginPerTrade,
    max_total_margin: limits.maxTotalMargin,
    max_open_positions: limits.maxOpenPositions,
    max_daily_loss: limits.maxDailyLoss > 0 ? limits.maxDailyLoss : null,
  });
  return { ok: true, message: `Limits updated for agent ${agentId}.`, agent: (await deps.store.getAgent(agentId))! };
}

/** The venue an account trades through, live or paper, exactly as the worker builds it. */
export function venueFor(deps: OpsDeps, account: { account_address: string; bot_key_encrypted: Buffer; network: string } | undefined): { venue: Venue; paper: boolean } {
  let live: { account: `0x${string}`; botPrivateKey: `0x${string}`; network: string } | undefined;
  if (account && account.account_address && !deps.dryRun) {
    live = {
      account: account.account_address as `0x${string}`,
      botPrivateKey: deps.cipher.decrypt(account.bot_key_encrypted) as `0x${string}`,
      network: account.network,
    };
  }
  return buildVenue({ network: account?.network ?? deps.network, live, dryRun: deps.dryRun });
}

export interface CloseAllResult {
  ok: boolean;
  message: string;
  /** One line per position, for the UI's detail list. */
  lines: string[];
  paused: number;
  closed: number;
  paper: boolean;
}

/**
 * Pause every running agent and close every open position.
 *
 * Pausing comes first and is unconditional: if a close fails, the agents are
 * still stopped, which is the state the user asked for.
 */
export async function closeAll(deps: OpsDeps, telegramId: number): Promise<CloseAllResult> {
  const agents = await deps.store.listAgents(telegramId);
  const running = agents.filter((a) => a.status === "running");
  for (const a of running) await deps.store.setAgentStatus(a.id, "paused");

  const positions = await deps.store.openPositionsForUser(telegramId);
  if (positions.length === 0) {
    return { ok: true, message: "No open positions. Running agents are paused.", lines: [], paused: running.length, closed: 0, paper: deps.dryRun };
  }

  const account = await deps.store.getAccount(telegramId);
  if (!account) {
    return { ok: false, message: "No linked account, so nothing can be closed. Agents are paused.", lines: [], paused: running.length, closed: 0, paper: deps.dryRun };
  }

  const { venue, paper } = venueFor(deps, account);
  const lines: string[] = [];
  let closed = 0;
  for (const p of positions) {
    try {
      const fill = await venue.close({ market: p.market, fraction: 1, reason: "closeall" });
      await deps.store.closePosition(p.id, "closeall", 0);
      await deps.store.record({
        telegram_id: telegramId,
        agent_id: p.agent_id,
        action: "closeall",
        market: p.market,
        side: p.side,
        status: fill.noFill ? "no_fill" : "ok",
        tx_hash: fill.txHash ?? null,
      });
      closed++;
      lines.push(`${p.market}: ${fill.noFill ? "nothing crossed" : `closed ${fill.size}`}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.store.record({
        telegram_id: telegramId,
        agent_id: p.agent_id,
        action: "closeall",
        market: p.market,
        status: "error",
        error: message,
      });
      lines.push(`${p.market}: failed - ${message}`);
    }
  }
  return {
    ok: closed > 0,
    message: `Closed ${closed} of ${positions.length} position(s). Agents paused.`,
    lines,
    paused: running.length,
    closed,
    paper,
  };
}

// ── live account state ──────────────────────────────────────────────────────

export interface AccountOverview {
  /** True when the numbers came from the chain rather than a paper simulation. */
  live: boolean;
  equityUsd: number;
  availableUsd: number;
  dailyPnlUsd: number;
  positions: Array<{
    market: string;
    side: "long" | "short";
    size: number;
    entryPrice: number;
    leverage: number;
    marginUsd: number;
    unrealizedPnlUsd: number;
    liquidationPx: number | null;
  }>;
}

/**
 * Read the account's equity, free margin and open positions.
 *
 * With a linked account and live mode this is the real DreamDEX state. Otherwise
 * it is a paper account, and `live` says so, so the UI never presents a
 * simulation as a balance.
 */
export async function accountOverview(deps: OpsDeps, telegramId: number): Promise<AccountOverview> {
  const account = await deps.store.getAccount(telegramId);
  const { venue, paper } = venueFor(deps, account);
  const state = await venue.account();
  return {
    live: !paper,
    equityUsd: state.equityUsd,
    availableUsd: state.availableUsd,
    dailyPnlUsd: state.dailyPnlUsd,
    positions: state.positions.map((p) => ({
      market: p.market,
      side: p.side,
      size: p.size,
      entryPrice: p.entryPrice,
      leverage: p.leverage,
      marginUsd: p.marginUsd,
      unrealizedPnlUsd: p.unrealizedPnlUsd,
      liquidationPx: p.liquidationPx,
    })),
  };
}

/** Mark prices for a set of markets, for showing live PnL on stored positions. */
export async function markPrices(deps: OpsDeps, markets: string[]): Promise<Record<string, number | null>> {
  if (markets.length === 0) return {};
  const ctx = createReadOnly({ network: deps.network });
  try {
    const reader = new SomniaVenue({ ctx, account: "0x0000000000000000000000000000000000000000", dryRun: true });
    const infos = await reader.markets(markets);
    return Object.fromEntries(infos.map((m) => [m.market, m.markPx]));
  } finally {
    await shutdown(ctx);
  }
}

export { perpMarkets };
