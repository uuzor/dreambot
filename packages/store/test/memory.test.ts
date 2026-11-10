import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory.js";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("creates a user on first sight and updates the username later", async () => {
    const first = await store.upsertUser(1, "alice");
    expect(first.username).toBe("alice");
    expect(first.tos_accepted_at).toBeNull();

    const again = await store.upsertUser(1, "alice2");
    expect(again.username).toBe("alice2");
    expect((await store.getUser(1))?.telegram_id).toBe(1);
  });

  it("records disclosure acceptance", async () => {
    await store.upsertUser(1, null);
    await store.acceptTos(1);
    expect((await store.getUser(1))?.tos_accepted_at).toBeInstanceOf(Date);
  });

  it("scopes agents to their owner", async () => {
    await store.upsertUser(1, null);
    await store.upsertUser(2, null);
    const a = await store.createAgent({
      telegram_id: 1,
      strategy: "trend-rider",
      market: "BTC-PERP",
      max_leverage: 2,
      margin_per_trade: 25,
      max_total_margin: 100,
      max_open_positions: 1,
      max_daily_loss: 25,
      markets: ["BTC-PERP"],
      thesis: null,
      journal_path: "/tmp/a.jsonl",
    });
    expect(await store.listAgents(1)).toHaveLength(1);
    expect(await store.listAgents(2)).toHaveLength(0);
    expect(await store.getAgent(a.id)).toBeDefined();
  });

  it("lists only running agents for the scheduler", async () => {
    await store.upsertUser(1, null);
    const a = await store.createAgent({
      telegram_id: 1,
      strategy: "trend-rider",
      market: "BTC-PERP",
      max_leverage: 2,
      margin_per_trade: 25,
      max_total_margin: 100,
      max_open_positions: 1,
      max_daily_loss: null,
      markets: ["BTC-PERP"],
      thesis: null,
      journal_path: "/tmp/a.jsonl",
    });
    expect(await store.listRunningAgents()).toHaveLength(0);
    await store.setAgentStatus(a.id, "running");
    expect(await store.listRunningAgents()).toHaveLength(1);
  });

  it("finds the open position in a market and stops finding it once closed", async () => {
    const p = await store.openPosition({
      agent_id: 1,
      telegram_id: 1,
      market: "BTC-PERP",
      side: "long",
      size: 1,
      entry_price: 100,
      leverage: 2,
      margin_usd: 50,
      take_profit: 110,
      stop_loss: 95,
    });
    expect(await store.openPositionIn(1, "BTC-PERP")).toBeDefined();
    await store.closePosition(p.id, "take-profit", 10);
    expect(await store.openPositionIn(1, "BTC-PERP")).toBeUndefined();
  });

  it("summarises realized PnL over a window", async () => {
    const win = await store.openPosition({
      agent_id: 1,
      telegram_id: 1,
      market: "BTC-PERP",
      side: "long",
      size: 1,
      entry_price: 100,
      leverage: 2,
      margin_usd: 50,
      take_profit: null,
      stop_loss: null,
    });
    const loss = await store.openPosition({
      agent_id: 1,
      telegram_id: 1,
      market: "ETH-PERP",
      side: "short",
      size: 1,
      entry_price: 100,
      leverage: 2,
      margin_usd: 50,
      take_profit: null,
      stop_loss: null,
    });
    await store.closePosition(win.id, "take-profit", 10);
    await store.closePosition(loss.id, "stop-loss", -4);

    const day = await store.pnlSummary(1, 24);
    expect(day.realizedUsd).toBe(6);
    expect(day.trades).toBe(2);
    expect(day.wins).toBe(1);
    expect(day.losses).toBe(1);
  });

  it("returns the most recent audit entries first", async () => {
    await store.record({ telegram_id: 1, action: "open", status: "ok" });
    await store.record({ telegram_id: 1, action: "close", status: "ok" });
    const recent = await store.recentAudit(1);
    expect(recent[0]?.action).toBe("close");
    expect(recent).toHaveLength(2);
  });

  it("has no notification settings until one is saved, then applies the defaults", async () => {
    expect(await store.getNotify(1)).toBeUndefined();
    await store.saveNotify(1, { on_refuse: true });
    const settings = await store.getNotify(1);
    expect(settings?.on_refuse).toBe(true);
    expect(settings?.on_open).toBe(true);
    expect(settings?.on_close).toBe(true);
  });

  it("changes one notification field without disturbing the others", async () => {
    await store.saveNotify(1, { on_open: false, on_close: false });
    await store.saveNotify(1, { on_open: true });
    const settings = await store.getNotify(1);
    expect(settings?.on_open).toBe(true);
    expect(settings?.on_close).toBe(false);
  });

  it("records the last refusal so a repeat can be suppressed", async () => {
    const at = new Date();
    await store.saveNotify(1, { last_refusal_key: "BTC-PERP|cap", last_refusal_at: at });
    const settings = await store.getNotify(1);
    expect(settings?.last_refusal_key).toBe("BTC-PERP|cap");
    expect(settings?.last_refusal_at?.getTime()).toBe(at.getTime());
  });
});
