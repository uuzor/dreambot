// Hard limits a user sets once. The agent can never exceed them, because every
// proposal passes through `evaluate` below before it reaches the venue.
//
// Adapted from Perpad (MIT, nirholas), extended with leverage caps per market,
// a per-market allow-list and a kill switch that is separate from the daily
// loss limit.

import { z } from "zod";

export const RiskLimitsSchema = z.object({
  /** App-canonical market names the agent may trade, e.g. ["BTC-PERP"]. */
  markets: z.array(z.string().min(1)).min(1, "at least one market must be allowed"),
  /** Hard ceiling on leverage, before the exchange's own cap is applied. */
  maxLeverage: z.number().int().min(1).max(50),
  /** Collateral the agent may commit to a single position, in USDso. */
  marginPerTradeUsd: z.number().positive(),
  /** Cap on total collateral committed across all open positions, in USDso. */
  maxTotalMarginUsd: z.number().positive(),
  maxOpenPositions: z.number().int().min(1),
  /** Kill switch: no new positions once realized loss today reaches this. */
  maxDailyLossUsd: z.number().positive().optional(),
});
export type RiskLimits = z.infer<typeof RiskLimitsSchema>;

export interface Proposal {
  market: string;
  side: "long" | "short";
  leverage: number;
  marginUsd: number;
}

export interface RiskContext {
  /** Markets the account already has a position in. */
  openMarkets: string[];
  /** Collateral committed to open positions, in USDso. */
  committedMarginUsd: number;
  /** Unlocked collateral the account could commit right now, in USDso. */
  availableMarginUsd: number;
  /** Realized PnL since 00:00 UTC, fees included. Negative is a loss. */
  dailyPnlUsd: number;
  /** Exchange max leverage per market, read live from the pool. */
  exchangeMaxLeverage: Record<string, number>;
}

export interface Verdict {
  allowed: boolean;
  /** Leverage and margin after clamping. Always populated, allowed or not. */
  adjusted: Pick<Proposal, "leverage" | "marginUsd">;
  /** Human-readable reasons, both refusals and clamps. */
  reasons: string[];
}

/** DreamDEX rejects orders below this notional value, in USDso. */
export const MIN_NOTIONAL_USD = 10;

/**
 * A cap above what the exchange allows is clamped to the exchange cap. A market
 * the exchange does not list has no cap, so the user's own limit applies and the
 * listing check below refuses it.
 */
export function effectiveMaxLeverage(
  limits: RiskLimits,
  market: string,
  exchangeMax: Record<string, number>,
): number {
  const ex = exchangeMax[market];
  return ex === undefined || ex <= 0 ? limits.maxLeverage : Math.min(limits.maxLeverage, ex);
}

/**
 * Evaluate a proposal against the limits. Pure and deterministic: same inputs,
 * same verdict, no network, no clock. This is the function the tests pin, and it
 * is the only thing standing between a model's suggestion and a real order.
 */
export function evaluate(p: Proposal, ctx: RiskContext, limits: RiskLimits): Verdict {
  const reasons: string[] = [];
  const deny = (r: string) => reasons.push(r);

  if (!limits.markets.includes(p.market)) {
    deny(`${p.market} is not an allowed market (${limits.markets.join(", ")})`);
  }
  if (ctx.exchangeMaxLeverage[p.market] === undefined) {
    deny(`${p.market} is not listed on the exchange`);
  }
  if (ctx.openMarkets.includes(p.market)) {
    deny(`a ${p.market} position is already open`);
  }
  if (ctx.openMarkets.length >= limits.maxOpenPositions) {
    deny(`max open positions (${limits.maxOpenPositions}) reached`);
  }
  if (limits.maxDailyLossUsd !== undefined && ctx.dailyPnlUsd <= -limits.maxDailyLossUsd) {
    deny(`daily loss limit hit (${ctx.dailyPnlUsd.toFixed(2)} USD <= -${limits.maxDailyLossUsd})`);
  }
  if (p.leverage < 1) deny("leverage must be at least 1");
  if (p.marginUsd <= 0) deny("margin must be positive");

  const cap = effectiveMaxLeverage(limits, p.market, ctx.exchangeMaxLeverage);
  const leverage = Math.max(1, Math.min(Math.floor(p.leverage), cap));

  // Margin is capped three ways: the per-trade limit, what is still free under
  // the total-margin budget, and what the account actually has unlocked.
  const roomUnderTotal = Math.max(0, limits.maxTotalMarginUsd - ctx.committedMarginUsd);
  const marginUsd = Math.min(p.marginUsd, limits.marginPerTradeUsd, roomUnderTotal, ctx.availableMarginUsd);

  if (leverage < Math.floor(p.leverage)) reasons.push(`leverage clamped ${Math.floor(p.leverage)}x -> ${leverage}x`);
  if (marginUsd < p.marginUsd) reasons.push(`margin clamped ${p.marginUsd} -> ${marginUsd.toFixed(2)} USD`);

  if (marginUsd <= 0) {
    deny("no margin available under the configured limits");
  } else if (marginUsd * leverage < MIN_NOTIONAL_USD) {
    deny(`notional ${(marginUsd * leverage).toFixed(2)} USD is below the ${MIN_NOTIONAL_USD} USD minimum`);
  }

  // A clamp is not a refusal: the order may still go through, smaller.
  const denied = reasons.filter((r) => !r.includes("clamped") && !r.includes("no margin available"));
  return { allowed: denied.length === 0 && marginUsd > 0, adjusted: { leverage, marginUsd }, reasons };
}
