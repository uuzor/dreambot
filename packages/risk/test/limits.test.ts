import { describe, expect, it } from "vitest";
import { evaluate, effectiveMaxLeverage, MIN_NOTIONAL_USD, type RiskContext, type RiskLimits } from "../src/limits.js";

const limits: RiskLimits = {
  markets: ["BTC-PERP", "ETH-PERP"],
  maxLeverage: 5,
  marginPerTradeUsd: 25,
  maxTotalMarginUsd: 100,
  maxOpenPositions: 2,
  maxDailyLossUsd: 30,
};

const ctx = (over: Partial<RiskContext> = {}): RiskContext => ({
  openMarkets: [],
  committedMarginUsd: 0,
  availableMarginUsd: 500,
  dailyPnlUsd: 0,
  exchangeMaxLeverage: { "BTC-PERP": 20, "ETH-PERP": 10 },
  ...over,
});

describe("effectiveMaxLeverage", () => {
  it("uses the exchange cap when it is tighter than the user limit", () => {
    expect(effectiveMaxLeverage(limits, "ETH-PERP", { "ETH-PERP": 3 })).toBe(3);
  });

  it("uses the user limit when the exchange allows more", () => {
    expect(effectiveMaxLeverage(limits, "BTC-PERP", { "BTC-PERP": 50 })).toBe(5);
  });

  it("falls back to the user limit for an unlisted market", () => {
    expect(effectiveMaxLeverage(limits, "DOGE-PERP", {})).toBe(5);
  });
});

describe("evaluate", () => {
  it("allows a proposal that fits every limit", () => {
    const v = evaluate({ market: "BTC-PERP", side: "long", leverage: 3, marginUsd: 20 }, ctx(), limits);
    expect(v.allowed).toBe(true);
    expect(v.adjusted).toEqual({ leverage: 3, marginUsd: 20 });
  });

  it("refuses a market the user did not allow", () => {
    const v = evaluate({ market: "SOL-PERP", side: "long", leverage: 2, marginUsd: 20 }, ctx(), limits);
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("not an allowed market");
  });

  it("refuses a market the exchange does not list", () => {
    const v = evaluate({ market: "ETH-PERP", side: "long", leverage: 2, marginUsd: 20 }, ctx({ exchangeMaxLeverage: {} }), limits);
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("not listed on the exchange");
  });

  it("refuses a second position on a market that is already open", () => {
    const v = evaluate({ market: "BTC-PERP", side: "short", leverage: 2, marginUsd: 20 }, ctx({ openMarkets: ["BTC-PERP"] }), limits);
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("already open");
  });

  it("refuses when the open-position cap is reached", () => {
    const v = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 20 },
      ctx({ openMarkets: ["ETH-PERP", "SOL-PERP"] }),
      limits,
    );
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("max open positions");
  });

  it("refuses once the daily loss limit is hit, and not one cent before", () => {
    const atLimit = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 20 },
      ctx({ dailyPnlUsd: -30 }),
      limits,
    );
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.reasons.join(" ")).toContain("daily loss limit");

    const justUnder = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 20 },
      ctx({ dailyPnlUsd: -29.99 }),
      limits,
    );
    expect(justUnder.allowed).toBe(true);
  });

  it("clamps leverage to the exchange cap instead of refusing", () => {
    const v = evaluate({ market: "ETH-PERP", side: "long", leverage: 10, marginUsd: 20 }, ctx(), limits);
    expect(v.allowed).toBe(true);
    expect(v.adjusted.leverage).toBe(5);
    expect(v.reasons.join(" ")).toContain("clamped");
  });

  it("clamps margin to the per-trade limit instead of refusing", () => {
    const v = evaluate({ market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 80 }, ctx(), limits);
    expect(v.allowed).toBe(true);
    expect(v.adjusted.marginUsd).toBe(25);
  });

  it("clamps margin to what remains under the total-margin budget", () => {
    const v = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25 },
      ctx({ committedMarginUsd: 90 }),
      limits,
    );
    expect(v.allowed).toBe(true);
    expect(v.adjusted.marginUsd).toBe(10);
  });

  it("clamps margin to the available balance", () => {
    const v = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25 },
      ctx({ availableMarginUsd: 7 }),
      limits,
    );
    expect(v.allowed).toBe(true);
    expect(v.adjusted.marginUsd).toBe(7);
  });

  it("refuses when nothing is left to commit", () => {
    const v = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25 },
      ctx({ committedMarginUsd: 100 }),
      limits,
    );
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("no margin available");
  });

  it("refuses a notional below the exchange minimum", () => {
    const v = evaluate(
      { market: "BTC-PERP", side: "long", leverage: 1, marginUsd: 25 },
      ctx({ availableMarginUsd: MIN_NOTIONAL_USD - 1 }),
      limits,
    );
    expect(v.allowed).toBe(false);
    expect(v.reasons.join(" ")).toContain("minimum");
  });

  it("is deterministic: the same inputs give the same verdict", () => {
    const p = { market: "BTC-PERP", side: "long" as const, leverage: 9, marginUsd: 80 };
    const a = evaluate(p, ctx(), limits);
    const b = evaluate(p, ctx(), limits);
    expect(a).toEqual(b);
  });
});
