import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Journal } from "@dreampilot/risk";
import { MemoryStore, type Agent } from "@dreampilot/store";
import { PaperVenue, type PriceSource } from "../src/paper-venue.js";
import { runTick } from "../src/runner.js";
import { TrendRider } from "../src/strategies/trend-rider.js";
import type { MarketInfo } from "../src/venue.js";

/**
 * The whole loop with no stand-ins: the real TrendRider strategy, the real risk
 * engine, the real paper venue, the real store and the real journal. Only the
 * price feed is injected, so the test is deterministic.
 */
describe("end to end on the paper venue", () => {
  it("opens on a breakout, then closes on the stop-loss the runner watches", async () => {
    const store = new MemoryStore();
    const dir = mkdtempSync(join(tmpdir(), "dp-e2e-"));
    const journalPath = join(dir, "agent.jsonl");

    const agent: Agent = {
      id: 1,
      telegram_id: 7,
      strategy: "trend-rider",
      market: "BTC-PERP",
      status: "running",
      max_leverage: 3,
      margin_per_trade: 100,
      max_total_margin: 200,
      max_open_positions: 1,
      max_daily_loss: 500,
      markets: ["BTC-PERP"],
      thesis: null,
      journal_path: journalPath,
      daily_pnl_usd: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
    await store.createAgent(agent);

    let markPx = 100;
    const feed: PriceSource = {
      markets: async (): Promise<MarketInfo[]> => [
        {
          market: "BTC-PERP",
          markPx,
          bid: markPx - 0.05,
          ask: markPx + 0.05,
          maxLeverage: 20,
          fundingApr: 0,
          momentumPct: 0.02, // a clean upside breakout
          minQuantity: 0.001,
          baseDecimals: 8,
        },
      ],
    };

    const venue = new PaperVenue(feed, 10_000);
    const journal = new Journal(journalPath);
    const deps = { venue, strategy: new TrendRider(), store, journal, agent, dryRun: true };

    const opened = await runTick(deps);
    expect(opened.acted).toBe(true);
    const position = (await store.openPositionsFor(agent.id))[0]!;
    expect(position.market).toBe("BTC-PERP");
    expect(position.side).toBe("long");
    expect(position.stop_loss).toBeLessThan(position.entry_price);
    expect(position.take_profit).toBeGreaterThan(position.entry_price);

    // Drive the mark down through the stop and tick again.
    markPx = position.stop_loss! - 1;
    const closed = await runTick(deps);
    expect(closed.reason).toContain("stop-loss");
    expect(await store.openPositionsFor(agent.id)).toHaveLength(0);

    // The realized loss is recorded and the chain still verifies.
    const day = await store.pnlSummary(agent.telegram_id, 24);
    expect(day.trades).toBe(1);
    expect(day.realizedUsd).toBeLessThan(0);
    expect(Journal.verify(Journal.read(journalPath))).toBeNull();
  });
});
