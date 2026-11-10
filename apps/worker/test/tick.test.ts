// The worker's delivery step: it decides from the user's stored preferences and
// the notice, calls the notifier, and never lets a send failure escape.

import { describe, expect, it, vi } from "vitest";
import { MemoryStore, type Agent, type Cipher } from "@dreampilot/store";
import { deliverNotice, type WorkerDeps } from "../src/tick.js";

const cipher = {} as Cipher;

function agent(telegramId: number): Agent {
  return {
    id: 7,
    telegram_id: telegramId,
    strategy: "trend-rider",
    market: "BTC-PERP",
    status: "running",
    max_leverage: 2,
    margin_per_trade: 25,
    max_total_margin: 100,
    max_open_positions: 1,
    max_daily_loss: 25,
    markets: ["BTC-PERP"],
    thesis: null,
    journal_path: "/tmp/j.jsonl",
    daily_pnl_usd: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function deps(store: MemoryStore, notify: WorkerDeps["notify"]): WorkerDeps {
  return { store, cipher, dryRun: true, network: "hideki", notify };
}

describe("deliverNotice", () => {
  it("sends an open to the user", async () => {
    const store = new MemoryStore();
    const sent: string[] = [];
    const notify = vi.fn(async (_id: number, text: string) => {
      sent.push(text);
    });
    await deliverNotice(
      agent(42),
      { acted: true, reason: "opened", notice: { kind: "opened", market: "BTC-PERP", side: "long" } },
      deps(store, notify),
    );
    expect(notify).toHaveBeenCalledOnce();
    expect(sent[0]).toContain("Position opened");
  });

  it("stays silent for a refusal by default", async () => {
    const store = new MemoryStore();
    const notify = vi.fn(async () => {});
    await deliverNotice(
      agent(42),
      { acted: false, reason: "risk refused", notice: { kind: "refused", market: "BTC-PERP", detail: "cap" } },
      deps(store, notify),
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it("sends a refusal once the user turns them on, then de-duplicates", async () => {
    const store = new MemoryStore();
    await store.saveNotify(42, { on_refuse: true });
    const notify = vi.fn(async () => {});
    const outcome = {
      acted: false,
      reason: "risk refused",
      notice: { kind: "refused" as const, market: "BTC-PERP", detail: "cap" },
    };
    const d = deps(store, notify);
    await deliverNotice(agent(42), outcome, d);
    await deliverNotice(agent(42), outcome, d);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("does not throw when the notifier fails", async () => {
    const store = new MemoryStore();
    const notify = vi.fn(async () => {
      throw new Error("bot blocked");
    });
    await expect(
      deliverNotice(
        agent(42),
        { acted: true, reason: "opened", notice: { kind: "opened", market: "BTC-PERP" } },
        deps(store, notify),
      ),
    ).resolves.toBeUndefined();
  });

  it("does nothing when there is no notifier configured", async () => {
    const store = new MemoryStore();
    await expect(
      deliverNotice(
        agent(42),
        { acted: true, reason: "opened", notice: { kind: "opened", market: "BTC-PERP" } },
        deps(store, undefined),
      ),
    ).resolves.toBeUndefined();
  });

  it("does nothing when the tick produced no notice", async () => {
    const store = new MemoryStore();
    const notify = vi.fn(async () => {});
    await deliverNotice(agent(42), { acted: false, reason: "nothing to do" }, deps(store, notify));
    expect(notify).not.toHaveBeenCalled();
  });
});
