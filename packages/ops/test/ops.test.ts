import { beforeEach, describe, expect, it } from "vitest";
import { Cipher, generateMasterKey, MemoryStore } from "@dreampilot/store";
import type { Agent } from "@dreampilot/store";
import {
  DEFAULT_LIMITS,
  closeAll,
  deployAgent,
  ensureBotKey,
  journalPathFor,
  normalizeMarket,
  setAgentLimits,
  setAgentStatus,
  type OpsDeps,
} from "../src/index.js";

/** Ops deps backed by an in-memory store, with the market list stubbed so the
 *  tests never touch the network. */
function makeDeps(overrides: Partial<OpsDeps> = {}): OpsDeps {
  return {
    store: new MemoryStore(),
    cipher: new Cipher(generateMasterKey()),
    network: "hideki",
    dryRun: true,
    journalRoot: "/tmp/journals",
    listMarkets: async () => ["BTC-PERP", "ETH-PERP", "SOL-PERP"],
    ...overrides,
  };
}

/** A user with an accepted disclosure and a linked account. */
async function linkedUser(deps: OpsDeps, telegramId = 1): Promise<void> {
  await deps.store.upsertUser(telegramId, "tester");
  await deps.store.acceptTos(telegramId);
  const key = await ensureBotKey(deps, telegramId);
  await deps.store.saveAccount({
    telegram_id: telegramId,
    account_address: "0x1111111111111111111111111111111111111111",
    bot_key_address: key.address,
    bot_key_encrypted: deps.cipher.encrypt("0x" + "ab".repeat(32)),
    network: "hideki",
    linked_at: new Date(),
  });
}

describe("normalizeMarket", () => {
  it("uppercases and appends -PERP, tolerating the suffix already being there", () => {
    expect(normalizeMarket("btc")).toBe("BTC-PERP");
    expect(normalizeMarket("btc-perp")).toBe("BTC-PERP");
    expect(normalizeMarket("  Eth-PERP ")).toBe("ETH-PERP");
  });
});

describe("journalPathFor", () => {
  it("puts one file per agent under the root", () => {
    expect(journalPathFor("/j", 7, "trend-rider-1")).toBe("/j/7/trend-rider-1.jsonl");
  });
});

describe("ensureBotKey", () => {
  it("creates a key the first time and reuses it after, so the app link keeps working", async () => {
    const deps = makeDeps();
    const first = await ensureBotKey(deps, 1);
    expect(first.existing).toBe(false);

    const second = await ensureBotKey(deps, 1);
    expect(second.existing).toBe(true);
    expect(second.address).toBe(first.address);
  });
});

describe("deployAgent", () => {
  let deps: OpsDeps;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("refuses to deploy without a linked account", async () => {
    const res = await deployAgent(deps, { telegramId: 1, strategy: "trend-rider", market: "BTC-PERP" });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Connect a trading account");
  });

  it("creates a running agent with the defaults, scoped to the caller", async () => {
    await linkedUser(deps, 1);
    const res = await deployAgent(deps, { telegramId: 1, strategy: "trend-rider", market: "BTC-PERP" });
    expect(res.ok).toBe(true);
    expect(res.agent?.status).toBe("running");
    expect(res.agent?.max_leverage).toBe(DEFAULT_LIMITS.maxLeverage);
    expect(await deps.store.listAgents(2)).toHaveLength(0);
  });

  it("normalises a loosely typed market", async () => {
    await linkedUser(deps, 1);
    await deployAgent(deps, { telegramId: 1, strategy: "trend-rider", market: "btc" });
    expect((await deps.store.listAgents(1))[0]?.market).toBe("BTC-PERP");
  });

  it("refuses a market the exchange does not list", async () => {
    await linkedUser(deps, 1);
    const res = await deployAgent(deps, { telegramId: 1, strategy: "trend-rider", market: "DOGE-PERP" });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("not a listed perp market");
    expect(await deps.store.listAgents(1)).toHaveLength(0);
  });

  it("refuses an unknown strategy", async () => {
    await linkedUser(deps, 1);
    const res = await deployAgent(deps, { telegramId: 1, strategy: "moon-shot", market: "BTC-PERP" });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Unknown strategy");
  });

  it("refuses a second running agent", async () => {
    await linkedUser(deps, 1);
    await deployAgent(deps, { telegramId: 1, strategy: "trend-rider", market: "BTC-PERP" });
    const res = await deployAgent(deps, { telegramId: 1, strategy: "funding-hunter", market: "ETH-PERP" });
    expect(res.ok).toBe(false);
    expect(res.message).toContain("already have a running agent");
  });

  it("honours caller-supplied limits", async () => {
    await linkedUser(deps, 1);
    const res = await deployAgent(deps, {
      telegramId: 1,
      strategy: "trend-rider",
      market: "BTC-PERP",
      limits: { maxLeverage: 5, marginPerTrade: 50 },
    });
    expect(res.agent?.max_leverage).toBe(5);
    expect(res.agent?.margin_per_trade).toBe(50);
  });

  it("refuses limits that fail validation", async () => {
    await linkedUser(deps, 1);
    const bad = await deployAgent(deps, {
      telegramId: 1,
      strategy: "trend-rider",
      market: "BTC-PERP",
      limits: { maxLeverage: 0 },
    });
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain("not valid");
    expect(await deps.store.listAgents(1)).toHaveLength(0);
  });
});

/** Deploy one agent and return it. */
async function withAgent(deps: OpsDeps, telegramId = 1): Promise<Agent> {
  await linkedUser(deps, telegramId);
  const res = await deployAgent(deps, { telegramId, strategy: "trend-rider", market: "BTC-PERP" });
  return res.agent!;
}

describe("setAgentStatus", () => {
  it("pauses and resumes an owned agent", async () => {
    const deps = makeDeps();
    const agent = await withAgent(deps);
    expect((await setAgentStatus(deps, 1, agent.id, "paused")).ok).toBe(true);
    expect((await deps.store.getAgent(agent.id))?.status).toBe("paused");
    expect((await setAgentStatus(deps, 1, agent.id, "running")).ok).toBe(true);
    expect((await deps.store.getAgent(agent.id))?.status).toBe("running");
  });

  it("refuses to touch another user's agent", async () => {
    const deps = makeDeps();
    const agent = await withAgent(deps, 1);
    const res = await setAgentStatus(deps, 2, agent.id, "paused");
    expect(res.ok).toBe(false);
    expect((await deps.store.getAgent(agent.id))?.status).toBe("running");
  });

  it("refuses an unknown id", async () => {
    const deps = makeDeps();
    await withAgent(deps);
    expect((await setAgentStatus(deps, 1, 9999, "paused")).ok).toBe(false);
  });
});

describe("setAgentLimits", () => {
  it("applies validated limits to an owned agent", async () => {
    const deps = makeDeps();
    const agent = await withAgent(deps);
    const res = await setAgentLimits(deps, 1, agent.id, {
      maxLeverage: 4,
      marginPerTrade: 15,
      maxTotalMargin: 40,
      maxOpenPositions: 2,
      maxDailyLoss: 20,
    });
    expect(res.ok).toBe(true);
    const updated = (await deps.store.getAgent(agent.id))!;
    expect(updated.max_leverage).toBe(4);
    expect(updated.max_daily_loss).toBe(20);
  });

  it("refuses invalid limits without writing", async () => {
    const deps = makeDeps();
    const agent = await withAgent(deps);
    const res = await setAgentLimits(deps, 1, agent.id, {
      maxLeverage: 0,
      marginPerTrade: 15,
      maxTotalMargin: 40,
      maxOpenPositions: 2,
      maxDailyLoss: 20,
    });
    expect(res.ok).toBe(false);
    expect((await deps.store.getAgent(agent.id))?.max_leverage).toBe(DEFAULT_LIMITS.maxLeverage);
  });

  it("refuses another user's agent", async () => {
    const deps = makeDeps();
    const agent = await withAgent(deps, 1);
    const res = await setAgentLimits(deps, 2, agent.id, {
      maxLeverage: 4,
      marginPerTrade: 15,
      maxTotalMargin: 40,
      maxOpenPositions: 2,
      maxDailyLoss: 20,
    });
    expect(res.ok).toBe(false);
  });
});

describe("closeAll", () => {
  it("pauses every running agent even with no positions", async () => {
    const deps = makeDeps();
    await withAgent(deps);
    const res = await closeAll(deps, 1);
    expect(res.paused).toBe(1);
    expect((await deps.store.listAgents(1))[0]?.status).toBe("paused");
  });

  it("reports paper mode honestly", async () => {
    const deps = makeDeps({ dryRun: true });
    await withAgent(deps);
    const res = await closeAll(deps, 1);
    expect(res.paper).toBe(true);
  });
});
