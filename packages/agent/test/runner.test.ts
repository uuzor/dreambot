import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Journal } from "@dreampilot/risk";
import { MemoryStore, type Agent } from "@dreampilot/store";
import { runTick, type TickDeps } from "../src/runner.js";
import type { Strategy } from "../src/strategy.js";
import type { AccountState, CloseRequest, FillResult, MarketInfo, OpenRequest, Venue } from "../src/venue.js";

/** A venue that records what it was asked to do, so the test can assert on it. */
class RecordingVenue implements Venue {
  readonly mode = "paper" as const;
  opened: OpenRequest[] = [];
  closed: CloseRequest[] = [];
  constructor(
    private readonly info: MarketInfo[],
    private readonly state: AccountState,
  ) {}

  async markets(): Promise<MarketInfo[]> {
    return this.info;
  }
  async account(): Promise<AccountState> {
    return this.state;
  }
  async open(req: OpenRequest): Promise<FillResult> {
    this.opened.push(req);
    return { market: req.market, side: req.side, action: "open", size: 1, avgPx: 100 };
  }
  async close(req: CloseRequest): Promise<FillResult> {
    this.closed.push(req);
    return { market: req.market, side: "long", action: "close", size: 1, avgPx: 100 };
  }
}

const market = (name: string, markPx = 100): MarketInfo => ({
  market: name,
  markPx,
  bid: markPx - 0.1,
  ask: markPx + 0.1,
  maxLeverage: 20,
  fundingApr: 0,
  momentumPct: 0.01,
  minQuantity: 0.001,
  baseDecimals: 8,
});

const emptyAccount: AccountState = { equityUsd: 1000, availableUsd: 1000, positions: [], dailyPnlUsd: 0 };

const agent = (over: Partial<Agent> = {}): Agent => ({
  id: 1,
  telegram_id: 42,
  strategy: "trend-rider",
  market: "BTC-PERP",
  status: "running",
  max_leverage: 3,
  margin_per_trade: 25,
  max_total_margin: 100,
  max_open_positions: 1,
  max_daily_loss: 30,
  markets: ["BTC-PERP"],
  thesis: null,
  journal_path: join(mkdtempSync(join(tmpdir(), "dp-runner-")), "j.jsonl"),
  daily_pnl_usd: 0,
  created_at: new Date(),
  updated_at: new Date(),
  ...over,
});

/** A strategy that proposes exactly what the test tells it to. */
function fixed(proposal: Parameters<Strategy["decide"]> extends never ? never : Awaited<ReturnType<Strategy["decide"]>>): Strategy {
  return { name: "fixed", description: "test", decide: async () => proposal };
}

describe("runTick", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("places an order the risk engine approved", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("BTC-PERP")], emptyAccount);
    const outcome = await runTick({
      venue,
      strategy: fixed({ market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.acted).toBe(true);
    expect(venue.opened).toHaveLength(1);
    expect(venue.opened[0]?.marginUsd).toBe(25);
  });

  it("never reaches the venue when the market is not allowed", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("SOL-PERP")], emptyAccount);
    const outcome = await runTick({
      venue,
      strategy: fixed({ market: "SOL-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.acted).toBe(false);
    expect(outcome.reason).toContain("risk refused");
    expect(venue.opened).toHaveLength(0);
  });

  it("clamps the leverage it sends, so the venue never sees the raw request", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("BTC-PERP")], emptyAccount);
    await runTick({
      venue,
      strategy: fixed({ market: "BTC-PERP", side: "long", leverage: 40, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(venue.opened[0]?.leverage).toBe(3);
  });

  it("refuses to open once the daily loss cap is hit", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("BTC-PERP")], { ...emptyAccount, dailyPnlUsd: -30 });
    const outcome = await runTick({
      venue,
      strategy: fixed({ market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.acted).toBe(false);
    expect(venue.opened).toHaveLength(0);
  });

  it("holds when the strategy proposes nothing", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("BTC-PERP")], emptyAccount);
    const outcome = await runTick({
      venue,
      strategy: fixed(undefined),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.acted).toBe(false);
    expect(outcome.reason).toBe("hold");
    expect(venue.opened).toHaveLength(0);
  });

  it("closes on take-profit before considering a new position", async () => {
    const a = agent();
    await store.createAgent(a);
    await store.openPosition({
      agent_id: a.id,
      telegram_id: a.telegram_id,
      market: "BTC-PERP",
      side: "long",
      size: 1,
      entry_price: 100,
      leverage: 2,
      margin_usd: 50,
      take_profit: 110,
      stop_loss: 95,
    });
    // The mark has run past the take-profit.
    const venue = new RecordingVenue([market("BTC-PERP", 115)], {
      equityUsd: 1000,
      availableUsd: 950,
      dailyPnlUsd: 0,
      positions: [
        { market: "BTC-PERP", side: "long", size: 1, entryPrice: 100, leverage: 2, marginUsd: 50, unrealizedPnlUsd: 15, liquidationPx: 50 },
      ],
    });
    const outcome = await runTick({
      venue,
      strategy: fixed({ market: "ETH-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "would open" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.reason).toContain("take-profit");
    expect(venue.closed).toHaveLength(1);
    expect(venue.opened).toHaveLength(0);
    expect(await store.openPositionsFor(a.id)).toHaveLength(0);
  });

  it("closes on stop-loss when the mark crosses it", async () => {
    const a = agent();
    await store.createAgent(a);
    await store.openPosition({
      agent_id: a.id,
      telegram_id: a.telegram_id,
      market: "BTC-PERP",
      side: "long",
      size: 1,
      entry_price: 100,
      leverage: 2,
      margin_usd: 50,
      take_profit: 110,
      stop_loss: 95,
    });
    const venue = new RecordingVenue([market("BTC-PERP", 90)], {
      equityUsd: 1000,
      availableUsd: 950,
      dailyPnlUsd: 0,
      positions: [
        { market: "BTC-PERP", side: "long", size: 1, entryPrice: 100, leverage: 2, marginUsd: 50, unrealizedPnlUsd: -10, liquidationPx: 50 },
      ],
    });
    const outcome = await runTick({
      venue,
      strategy: fixed(undefined),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(outcome.reason).toContain("stop-loss");
    expect(venue.closed).toHaveLength(1);
  });

  it("records a fill in the store and the audit log", async () => {
    const a = agent();
    await store.createAgent(a);
    const venue = new RecordingVenue([market("BTC-PERP")], emptyAccount);
    await runTick({
      venue,
      strategy: fixed({ market: "BTC-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(a.journal_path),
      agent: a,
      dryRun: true,
    });
    expect(await store.openPositionsFor(a.id)).toHaveLength(1);
    const audit = await store.recentAudit(a.telegram_id);
    expect(audit.some((e) => e.action === "open" && e.status === "ok")).toBe(true);
  });

  it("journals a refusal so the user can see why the agent did nothing", async () => {
    const a = agent();
    await store.createAgent(a);
    const journalPath = a.journal_path;
    const venue = new RecordingVenue([market("SOL-PERP")], emptyAccount);
    await runTick({
      venue,
      strategy: fixed({ market: "SOL-PERP", side: "long", leverage: 2, marginUsd: 25, reasoning: "test" }),
      store,
      journal: new Journal(journalPath),
      agent: a,
      dryRun: true,
    });
    const kinds = Journal.read(journalPath).map((e) => e.kind);
    expect(kinds).toContain("risk_denied");
    expect(Journal.verify(Journal.read(journalPath))).toBeNull();
  });
});
