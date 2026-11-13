// The tick runner: one decision cycle for one agent.
//
// This is where a proposal becomes an order, or does not. The order of
// operations is the safety property:
//
//   1. read the market and the account
//   2. run the strategy to get a proposal (or a hold)
//   3. pass the proposal through the risk engine, in code
//   4. journal the verdict, whether it was allowed, clamped or refused
//   5. only then place the order, and only if it was allowed
//
// The strategy has no way to skip step 3, because it never holds a venue.

import { evaluate, Journal, type RiskContext, type RiskLimits } from "@dreampilot/risk";
import type { Agent, Position, Store } from "@dreampilot/store";
import type { Strategy } from "./strategy.js";
import type { Venue } from "./venue.js";

export interface TickDeps {
  venue: Venue;
  strategy: Strategy;
  store: Store;
  journal: Journal;
  /** The agent row: its limits and its journal path. */
  agent: Agent;
  /** Master dry-run switch. When true, nothing is sent, only journaled. */
  dryRun: boolean;
  now?: () => Date;
}

export interface TickOutcome {
  acted: boolean;
  reason: string;
  /**
   * A user-facing summary of anything worth telling the user about, or undefined
   * when the tick did nothing notable. The runner is the only place that knows
   * what really happened, so it describes the event and the worker decides
   * whether to deliver it.
   */
  notice?: TickNotice;
}

export type NoticeKind = "opened" | "closed" | "refused" | "error";

export interface TickNotice {
  kind: NoticeKind;
  market?: string;
  side?: "long" | "short";
  size?: number;
  price?: number;
  leverage?: number;
  marginUsd?: number;
  /** Realized PnL, on a close. */
  pnlUsd?: number;
  /** Why, for a close, a refusal or an error. */
  detail?: string;
}

function limitsOf(agent: Agent): RiskLimits {
  return {
    markets: agent.markets.length > 0 ? agent.markets : [agent.market],
    maxLeverage: agent.max_leverage,
    marginPerTradeUsd: agent.margin_per_trade,
    maxTotalMarginUsd: agent.max_total_margin,
    maxOpenPositions: agent.max_open_positions,
    maxDailyLossUsd: agent.max_daily_loss ?? undefined,
  };
}

/**
 * Watch an open position's take-profit and stop-loss and close it when the mark
 * crosses one.
 *
 * A linked bot key cannot arm exchange-side stop orders: only the account itself
 * can, and DreamPilot holds a bot key. So the exits are the runner's job, and
 * they only act while the runner is alive. That limitation is stated to the user
 * at deploy time rather than hidden.
 */
export async function watchExits(deps: TickDeps, position: Position, markPx: number): Promise<TickOutcome | undefined> {
  const { journal, venue, store, agent } = deps;
  const hitTp = position.take_profit !== null && (position.side === "long" ? markPx >= position.take_profit : markPx <= position.take_profit);
  const hitSl = position.stop_loss !== null && (position.side === "long" ? markPx <= position.stop_loss : markPx >= position.stop_loss);
  if (!hitTp && !hitSl) return undefined;

  const reason = hitTp ? "take-profit" : "stop-loss";
  const pnl = realizedPnl(position, markPx);
  journal.append("action", {
    tool: "close_position",
    market: position.market,
    reason,
    markPx,
    dryRun: deps.dryRun,
  });
  try {
    const fill = await venue.close({ market: position.market, fraction: 1, reason });
    await store.closePosition(position.id, reason, pnl);
    await store.record({
      telegram_id: agent.telegram_id,
      agent_id: agent.id,
      action: reason,
      market: position.market,
      side: position.side,
      status: fill.noFill ? "no_fill" : "ok",
      tx_hash: fill.txHash ?? null,
    });
    journal.append("result", { tool: "close_position", fill });
    return {
      acted: true,
      reason: `closed on ${reason}`,
      notice: {
        kind: "closed",
        market: position.market,
        side: position.side,
        size: position.size,
        price: markPx,
        pnlUsd: pnl,
        detail: reason,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    journal.append("error", { tool: "close_position", message });
    await store.record({
      telegram_id: agent.telegram_id,
      agent_id: agent.id,
      action: reason,
      market: position.market,
      status: "error",
      error: message,
    });
    return {
      acted: false,
      reason: `close failed: ${message}`,
      notice: { kind: "error", market: position.market, detail: `closing on ${reason} failed: ${message}` },
    };
  }
}

/** Realized PnL for a full close at `exitPx`, on the position's own margin. */
export function realizedPnl(position: Position, exitPx: number): number {
  const dir = position.side === "long" ? 1 : -1;
  return dir * (exitPx - position.entry_price) * position.size;
}

/** One decision cycle. Returns after the agent holds, acts, or is refused. */
export async function runTick(deps: TickDeps): Promise<TickOutcome> {
  const { venue, strategy, store, journal, agent, dryRun } = deps;
  const now = deps.now?.() ?? new Date();
  const limits = limitsOf(agent);
  journal.append("tick", { strategy: strategy.name, mode: venue.mode, dryRun });

  const markets = await venue.markets(limits.markets);
  const account = await venue.account();

  // Manage what is already open before considering anything new: an exit that
  // should have fired is worth more than a fresh idea.
  const open = await store.openPositionsFor(agent.id);
  for (const position of open) {
    const info = markets.find((m) => m.market === position.market);
    if (!info || info.markPx === null) continue;
    const exit = await watchExits(deps, position, info.markPx);
    if (exit?.acted) return exit;
  }

  const proposal = await strategy.decide({ markets, account, limits, thesis: agent.thesis });
  if (!proposal) {
    journal.append("thought", { note: "no proposal this tick, holding" });
    return { acted: false, reason: "hold" };
  }
  journal.append("thought", { proposal, reasoning: proposal.reasoning });

  const committed = account.positions.reduce((s, p) => s + p.marginUsd, 0);
  // The live venue cannot derive realized PnL from position reads, so it reports
  // 0. The worker keeps `agent.daily_pnl_usd` from the store's own close records,
  // and in live mode that is the only truthful source: taking the venue's 0 here
  // would make the daily-loss kill switch unreachable on a real account.
  const dailyPnlUsd = venue.mode === "live" ? agent.daily_pnl_usd : account.dailyPnlUsd;
  const riskCtx: RiskContext = {
    openMarkets: account.positions.map((p) => p.market),
    committedMarginUsd: committed,
    availableMarginUsd: account.availableUsd,
    dailyPnlUsd,
    exchangeMaxLeverage: Object.fromEntries(
      markets.map((m) => [m.market, m.maxLeverage]),
    ),
  };
  const verdict = evaluate(
    {
      market: proposal.market,
      side: proposal.side,
      leverage: proposal.leverage,
      marginUsd: proposal.marginUsd,
    },
    riskCtx,
    limits,
  );

  if (!verdict.allowed) {
    journal.append("risk_denied", { proposal, reasons: verdict.reasons });
    return {
      acted: false,
      reason: `risk refused: ${verdict.reasons.join("; ")}`,
      notice: {
        kind: "refused",
        market: proposal.market,
        side: proposal.side,
        detail: verdict.reasons.join("; "),
      },
    };
  }
  if (verdict.reasons.some((r) => r.includes("clamped"))) {
    journal.append("risk_clamped", { proposal, adjusted: verdict.adjusted, reasons: verdict.reasons });
  }

  try {
    const fill = await venue.open({
      market: proposal.market,
      side: proposal.side,
      marginUsd: verdict.adjusted.marginUsd,
      leverage: verdict.adjusted.leverage,
      takeProfit: proposal.takeProfit,
      stopLoss: proposal.stopLoss,
    });
    journal.append("result", { tool: "open_position", fill });

    if (fill.noFill) {
      await store.record({
        telegram_id: agent.telegram_id,
        agent_id: agent.id,
        action: "open",
        market: proposal.market,
        side: proposal.side,
        status: "no_fill",
      });
      return { acted: false, reason: "the book moved; nothing crossed" };
    }

    await store.openPosition({
      agent_id: agent.id,
      telegram_id: agent.telegram_id,
      market: proposal.market,
      side: proposal.side,
      size: fill.size,
      entry_price: fill.avgPx,
      leverage: verdict.adjusted.leverage,
      margin_usd: verdict.adjusted.marginUsd,
      take_profit: proposal.takeProfit ?? null,
      stop_loss: proposal.stopLoss ?? null,
    });
    await store.record({
      telegram_id: agent.telegram_id,
      agent_id: agent.id,
      action: "open",
      market: proposal.market,
      side: proposal.side,
      size: String(fill.size),
      price: String(fill.avgPx),
      tx_hash: fill.txHash ?? null,
      status: "ok",
    });
    return {
      acted: true,
      reason: `opened ${proposal.side} ${proposal.market}`,
      notice: {
        kind: "opened",
        market: proposal.market,
        side: proposal.side,
        size: fill.size,
        price: fill.avgPx,
        leverage: verdict.adjusted.leverage,
        marginUsd: verdict.adjusted.marginUsd,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    journal.append("error", { tool: "open_position", message });
    await store.record({
      telegram_id: agent.telegram_id,
      agent_id: agent.id,
      action: "open",
      market: proposal.market,
      side: proposal.side,
      status: "error",
      error: message,
    });
    return {
      acted: false,
      reason: `open failed: ${message}`,
      notice: { kind: "error", market: proposal.market, side: proposal.side, detail: `opening failed: ${message}` },
    };
  }
}

export { limitsOf };
