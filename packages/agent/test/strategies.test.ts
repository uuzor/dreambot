import { describe, expect, it } from "vitest";
import { FundingHunter } from "../src/strategies/funding-hunter.js";
import { MeanReversion } from "../src/strategies/mean-reversion.js";
import { TrendRider } from "../src/strategies/trend-rider.js";
import type { StrategyContext } from "../src/strategy.js";
import type { MarketInfo } from "../src/venue.js";

function market(over: Partial<MarketInfo> & { market: string }): MarketInfo {
  return {
    markPx: 100,
    bid: 99.9,
    ask: 100.1,
    maxLeverage: 20,
    fundingApr: 0,
    momentumPct: 0,
    minQuantity: 0.001,
    baseDecimals: 8,
    ...over,
  };
}

const ctx = (markets: MarketInfo[], over: Partial<StrategyContext> = {}): StrategyContext => ({
  markets,
  account: { equityUsd: 1000, availableUsd: 1000, positions: [], dailyPnlUsd: 0 },
  limits: {
    markets: markets.map((m) => m.market),
    maxLeverage: 5,
    marginPerTradeUsd: 25,
    maxTotalMarginUsd: 100,
    maxOpenPositions: 2,
  },
  ...over,
});

describe("TrendRider", () => {
  it("goes long the strongest positive mover", async () => {
    const p = await new TrendRider().decide(
      ctx([market({ market: "BTC-PERP", momentumPct: 0.01 }), market({ market: "ETH-PERP", momentumPct: 0.002 })]),
    );
    expect(p?.market).toBe("BTC-PERP");
    expect(p?.side).toBe("long");
    expect(p?.takeProfit).toBeGreaterThan(p!.stopLoss!);
  });

  it("goes short the strongest negative mover", async () => {
    const p = await new TrendRider().decide(ctx([market({ market: "ETH-PERP", momentumPct: -0.02 })]));
    expect(p?.side).toBe("short");
    // A short's take-profit sits below entry and its stop above.
    expect(p?.takeProfit).toBeLessThan(p!.stopLoss!);
  });

  it("holds when nothing clears the threshold", async () => {
    const p = await new TrendRider({ threshold: 0.05 }).decide(ctx([market({ market: "BTC-PERP", momentumPct: 0.01 })]));
    expect(p).toBeUndefined();
  });

  it("holds rather than doubling up on an open market", async () => {
    const c = ctx([market({ market: "BTC-PERP", momentumPct: 0.01 })], {
      account: {
        equityUsd: 1000,
        availableUsd: 900,
        dailyPnlUsd: 0,
        positions: [
          { market: "BTC-PERP", side: "long", size: 1, entryPrice: 99, leverage: 2, marginUsd: 50, unrealizedPnlUsd: 1, liquidationPx: 50 },
        ],
      },
    });
    expect(await new TrendRider().decide(c)).toBeUndefined();
  });

  it("holds when the open-position cap is reached", async () => {
    const c = ctx([market({ market: "BTC-PERP", momentumPct: 0.01 })], {
      limits: { markets: ["BTC-PERP"], maxLeverage: 5, marginPerTradeUsd: 25, maxTotalMarginUsd: 100, maxOpenPositions: 1 },
      account: {
        equityUsd: 1000,
        availableUsd: 900,
        dailyPnlUsd: 0,
        positions: [
          { market: "ETH-PERP", side: "long", size: 1, entryPrice: 99, leverage: 2, marginUsd: 50, unrealizedPnlUsd: 1, liquidationPx: 50 },
        ],
      },
    });
    expect(await new TrendRider().decide(c)).toBeUndefined();
  });
});

describe("FundingHunter", () => {
  it("shorts when funding is positive, because longs pay shorts", async () => {
    const p = await new FundingHunter().decide(ctx([market({ market: "BTC-PERP", fundingApr: 0.4 })]));
    expect(p?.side).toBe("short");
    expect(p?.market).toBe("BTC-PERP");
  });

  it("goes long when funding is negative", async () => {
    const p = await new FundingHunter().decide(ctx([market({ market: "ETH-PERP", fundingApr: -0.4 })]));
    expect(p?.side).toBe("long");
  });

  it("holds when funding is below the entry threshold", async () => {
    const p = await new FundingHunter({ entryApr: 0.5 }).decide(ctx([market({ market: "BTC-PERP", fundingApr: 0.1 })]));
    expect(p).toBeUndefined();
  });

  it("refuses to trade when the exit threshold is not below the entry", async () => {
    const p = await new FundingHunter({ entryApr: 0.1, exitApr: 0.2 }).decide(ctx([market({ market: "BTC-PERP", fundingApr: 0.5 })]));
    expect(p).toBeUndefined();
  });
});

describe("MeanReversion", () => {
  it("fades a stretched-up move by going short", async () => {
    const p = await new MeanReversion().decide(ctx([market({ market: "BTC-PERP", momentumPct: 0.02 })]));
    expect(p?.side).toBe("short");
  });

  it("fades a stretched-down move by going long", async () => {
    const p = await new MeanReversion().decide(ctx([market({ market: "ETH-PERP", momentumPct: -0.02 })]));
    expect(p?.side).toBe("long");
  });

  it("holds when the move is too small to be a deviation", async () => {
    const p = await new MeanReversion().decide(ctx([market({ market: "BTC-PERP", momentumPct: 0.001 })]));
    expect(p).toBeUndefined();
  });

  it("holds when the move is so large it looks like news", async () => {
    const p = await new MeanReversion().decide(ctx([market({ market: "BTC-PERP", momentumPct: 0.2 })]));
    expect(p).toBeUndefined();
  });
});
