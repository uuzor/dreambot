// Mean Reversion: fades a stretched move, betting on a return to the average.
//
// It only fires when the recent move is large but the funding is not, which is
// the case where the move looks like noise rather than a repricing.

import { bracketAround, type Proposal, type Strategy, type StrategyContext } from "../strategy.js";

export interface MeanReversionOptions {
  /** Minimum recent move to fade, as a fraction. */
  minDeviation?: number;
  /** Skip a move this large: at some point it is news, not noise. */
  maxDeviation?: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
}

export class MeanReversion implements Strategy {
  readonly name = "mean-reversion";
  readonly description = "Trades deviations from the recent average, fading stretched moves.";

  constructor(private readonly opts: MeanReversionOptions = {}) {}

  async decide(ctx: StrategyContext): Promise<Proposal | undefined> {
    const min = this.opts.minDeviation ?? 0.006;
    const max = this.opts.maxDeviation ?? 0.05;
    const leverage = this.opts.leverage ?? 2;

    const stretched = ctx.markets
      .filter((m) => m.markPx !== null && m.momentumPct !== null)
      .map((m) => ({ m, dev: Math.abs(m.momentumPct!) }))
      .filter((x) => x.dev >= min && x.dev <= max)
      .sort((a, b) => b.dev - a.dev);
    const pick = stretched[0];
    if (!pick || pick.m.markPx === null || pick.m.momentumPct === null) return undefined;
    if (ctx.account.positions.some((p) => p.market === pick.m.market)) return undefined;
    if (ctx.account.positions.length >= ctx.limits.maxOpenPositions) return undefined;

    // Fade the move: a stretched-up market is a short, and the reverse.
    const side: "long" | "short" = pick.m.momentumPct > 0 ? "short" : "long";
    const { takeProfit, stopLoss } = bracketAround(
      pick.m.markPx,
      side,
      this.opts.takeProfitPct ?? 1,
      this.opts.stopLossPct ?? 2,
    );
    return {
      market: pick.m.market,
      side,
      leverage,
      marginUsd: ctx.limits.marginPerTradeUsd,
      reasoning:
        `${pick.m.market} moved ${(pick.m.momentumPct * 100).toFixed(2)}%, which is stretched but not ` +
        `news-sized, so I am fading it ${side} and betting on a return to the recent average.`,
      takeProfit,
      stopLoss,
    };
  }
}
