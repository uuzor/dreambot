// Strategies: the part that decides WHAT to trade.
//
// A strategy sees market data and account state and returns a proposal, or a
// hold. It never places an order: the tick runner passes the proposal through
// the risk engine first, and only an approved proposal reaches the venue. That
// separation is what makes the limits enforceable rather than advisory.

import type { RiskLimits } from "@dreampilot/risk";
import type { AccountState, MarketInfo, Venue } from "./venue.js";

export interface Proposal {
  market: string;
  side: "long" | "short";
  leverage: number;
  marginUsd: number;
  /** One or two sentences, published in the user's journal. */
  reasoning: string;
  /** The exit the runner will watch, as absolute prices. */
  takeProfit?: number;
  stopLoss?: number;
}

export interface StrategyContext {
  markets: MarketInfo[];
  account: AccountState;
  limits: RiskLimits;
  /** Free-text guidance the user attached to the agent. */
  thesis?: string | null;
}

export interface Strategy {
  readonly name: string;
  /** A one-line description shown in /agents. */
  readonly description: string;
  /**
   * Decide for one tick. Returns a proposal to act on, or undefined to hold.
   * `journal` receives reasoning that is recorded even when the answer is hold.
   */
  decide(ctx: StrategyContext): Promise<Proposal | undefined>;
}

/** The take-profit and stop-loss levels a strategy wants, from its own percent. */
export function bracketAround(
  mark: number,
  side: "long" | "short",
  takeProfitPct: number,
  stopLossPct: number,
): { takeProfit: number; stopLoss: number } {
  const up = mark * (1 + takeProfitPct / 100);
  const down = mark * (1 - stopLossPct / 100);
  return side === "long" ? { takeProfit: up, stopLoss: down } : { takeProfit: down, stopLoss: up };
}

export type { MarketInfo, AccountState, Venue };
