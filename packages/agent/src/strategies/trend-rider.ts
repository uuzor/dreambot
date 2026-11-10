// Trend Rider: trades momentum breakouts.
//
// A pure function of the market snapshot, so it is testable without a network
// and its decisions are reproducible from the journal.

import { bracketAround, type Proposal, type Strategy, type StrategyContext } from "../strategy.js";

export interface TrendRiderOptions {
  /** Momentum at or above this, as a fraction, is a breakout worth taking. */
  threshold?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  /** Leverage the strategy asks for; the risk engine may clamp it. */
  leverage?: number;
}

export class TrendRider implements Strategy {
  readonly name = "trend-rider";
  readonly description = "Identifies momentum and trades breakouts.";

  constructor(private readonly opts: TrendRiderOptions = {}) {}

  async decide(ctx: StrategyContext): Promise<Proposal | undefined> {
    const threshold = this.opts.threshold ?? 0.004;
    const leverage = this.opts.leverage ?? 2;

    // Take the market with the strongest momentum among the allowed set.
    const ranked = ctx.markets
      .filter((m) => m.markPx !== null && m.momentumPct !== null)
      .sort((a, b) => Math.abs(b.momentumPct!) - Math.abs(a.momentumPct!));
    const best = ranked[0];
    if (!best || best.momentumPct === null || best.markPx === null) return undefined;

    // Never stack a second position on a market that is already open.
    if (ctx.account.positions.some((p) => p.market === best.market)) return undefined;
    if (ctx.account.positions.length >= ctx.limits.maxOpenPositions) return undefined;

    const momentum = best.momentumPct;
    if (Math.abs(momentum) < threshold) return undefined;

    const side = momentum > 0 ? "long" : "short";
    const { takeProfit, stopLoss } = bracketAround(
      best.markPx,
      side,
      this.opts.takeProfitPct ?? 2,
      this.opts.stopLossPct ?? 1,
    );
    return {
      market: best.market,
      side,
      leverage,
      marginUsd: ctx.limits.marginPerTradeUsd,
      reasoning:
        `${best.market} moved ${(momentum * 100).toFixed(2)}% over the last hour, ` +
        `clearing the ${(threshold * 100).toFixed(2)}% breakout threshold, so I am riding it ${side}.`,
      takeProfit,
      stopLoss,
    };
  }
}
