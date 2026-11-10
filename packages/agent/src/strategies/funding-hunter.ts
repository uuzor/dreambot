// Funding Hunter: holds whichever side funding pays.
//
// The exit has to sit below the entry or the agent opens and closes on
// alternate polls, paying the spread twice for nothing.

import { bracketAround, type Proposal, type Strategy, type StrategyContext } from "../strategy.js";

export interface FundingHunterOptions {
  /** Minimum annualised funding to open, as a fraction. 0.1 is 10% APR. */
  entryApr?: number;
  /** Below this annualised funding, step aside. Must be under `entryApr`. */
  exitApr?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
}

export class FundingHunter implements Strategy {
  readonly name = "funding-hunter";
  readonly description = "Evaluates funding rates and holds the side that gets paid.";

  constructor(private readonly opts: FundingHunterOptions = {}) {}

  async decide(ctx: StrategyContext): Promise<Proposal | undefined> {
    const entry = this.opts.entryApr ?? 0.1;
    const exit = this.opts.exitApr ?? 0.03;
    const leverage = this.opts.leverage ?? 2;
    if (exit >= entry) {
      // A misconfiguration would open and close on alternate polls. Refusing to
      // act is better than churning the account.
      return undefined;
    }

    const candidates = ctx.markets.filter((m) => m.markPx !== null);
    const best = candidates.sort((a, b) => Math.abs(b.fundingApr) - Math.abs(a.fundingApr))[0];
    if (!best || best.markPx === null) return undefined;
    if (ctx.account.positions.some((p) => p.market === best.market)) return undefined;
    if (ctx.account.positions.length >= ctx.limits.maxOpenPositions) return undefined;
    if (Math.abs(best.fundingApr) < entry) return undefined;

    // Positive funding means longs pay shorts, so the paid side is the short.
    const side: "long" | "short" = best.fundingApr > 0 ? "short" : "long";
    const { takeProfit, stopLoss } = bracketAround(
      best.markPx,
      side,
      this.opts.takeProfitPct ?? 3,
      this.opts.stopLossPct ?? 1.5,
    );
    return {
      market: best.market,
      side,
      leverage,
      marginUsd: ctx.limits.marginPerTradeUsd,
      reasoning:
        `${best.market} funding is ${(best.fundingApr * 100).toFixed(1)}% APR, above the ` +
        `${(entry * 100).toFixed(1)}% entry threshold. Funding pays the ${side}, so I am holding it.`,
      takeProfit,
      stopLoss,
    };
  }
}
