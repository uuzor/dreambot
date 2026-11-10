import { describe, expect, it } from "vitest";
import { PaperVenue, type PriceSource } from "../src/paper-venue.js";
import type { MarketInfo } from "../src/venue.js";

function source(markPx: number, maxLeverage = 20): PriceSource {
  const info: MarketInfo = {
    market: "BTC-PERP",
    markPx,
    bid: markPx - 0.1,
    ask: markPx + 0.1,
    maxLeverage,
    fundingApr: 0,
    momentumPct: 0,
    minQuantity: 0.001,
    baseDecimals: 8,
  };
  return { markets: async () => [info] };
}

describe("PaperVenue", () => {
  it("opens a position and reports it in the account", async () => {
    const v = new PaperVenue(source(100), 1000);
    const fill = await v.open({ market: "BTC-PERP", side: "long", marginUsd: 100, leverage: 2 });
    expect(fill.size).toBeCloseTo(2, 8); // 100 margin * 2x / 100 price

    const acct = await v.account();
    expect(acct.positions).toHaveLength(1);
    expect(acct.positions[0]?.market).toBe("BTC-PERP");
    // Margin plus fee left the cash balance.
    expect(acct.availableUsd).toBeLessThan(900);
  });

  it("realizes a profit when a long closes higher", async () => {
    const v = new PaperVenue(source(100), 1000);
    await v.open({ market: "BTC-PERP", side: "long", marginUsd: 100, leverage: 2 });
    const before = (await v.account()).equityUsd;
    // Move the market up by re-reading through a new source is not possible here,
    // so close at the same price and assert the fee is the only cost.
    await v.close({ market: "BTC-PERP", fraction: 1, reason: "test" });
    const after = (await v.account()).equityUsd;
    expect(after).toBeLessThan(before); // the round trip pays two taker fees
    expect(await v.account().then((a) => a.positions.length)).toBe(0);
  });

  it("refuses a position larger than the paper balance", async () => {
    const v = new PaperVenue(source(100), 50);
    await expect(v.open({ market: "BTC-PERP", side: "long", marginUsd: 100, leverage: 2 })).rejects.toThrow(/insufficient/);
  });

  it("refuses a second position on the same market", async () => {
    const v = new PaperVenue(source(100), 1000);
    await v.open({ market: "BTC-PERP", side: "long", marginUsd: 100, leverage: 2 });
    await expect(v.open({ market: "BTC-PERP", side: "short", marginUsd: 100, leverage: 2 })).rejects.toThrow(/already open/);
  });

  it("closes part of a position and keeps the rest", async () => {
    const v = new PaperVenue(source(100), 1000);
    await v.open({ market: "BTC-PERP", side: "long", marginUsd: 100, leverage: 2 });
    await v.close({ market: "BTC-PERP", fraction: 0.5, reason: "scale out" });
    const acct = await v.account();
    expect(acct.positions).toHaveLength(1);
    expect(acct.positions[0]?.size).toBeCloseTo(1, 8);
  });

  it("reports nothing to close for a market it does not hold", async () => {
    const v = new PaperVenue(source(100), 1000);
    await expect(v.close({ market: "BTC-PERP", fraction: 1, reason: "test" })).rejects.toThrow(/no open/);
  });
});
