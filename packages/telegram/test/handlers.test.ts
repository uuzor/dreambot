import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Cipher, generateMasterKey, MemoryStore } from "@dreampilot/store";
import { loadConfig } from "../src/config.js";
import type { AppContext } from "../src/app.js";
import { applyRiskLimits, deployCmd, journalPathFor, notifyCmd, walletDeepLink } from "../src/commands.js";
import type { AppCtx } from "../src/middleware.js";

/** A grammY-shaped context that records replies instead of sending them. */
function fakeCtx(app: AppContext, telegramId: number, username: string | null = "tester") {
  const replies: string[] = [];
  const ctx = {
    app,
    state: {} as AppCtx["state"],
    from: { id: telegramId, username },
    reply: async (text: string) => {
      replies.push(text);
    },
    replies,
  };
  return ctx as unknown as AppCtx & { replies: string[] };
}

function makeApp(): AppContext {
  const config = loadConfig({
    TELEGRAM_BOT_TOKEN: "test",
    MASTER_ENCRYPTION_KEY: generateMasterKey(),
    AGENTS_DRY_RUN: "true",
  });
  return {
    config,
    store: new MemoryStore(),
    cipher: new Cipher(config.MASTER_ENCRYPTION_KEY!),
    journalRoot: join(mkdtempSync(join(tmpdir(), "dp-tg-")), "journals"),
    notify: async () => {},
  };
}

/** Seed a linked account, the state every deploy needs. */
async function linkedUser(app: AppContext, telegramId: number, username = "tester") {
  const ctx = fakeCtx(app, telegramId, username);
  ctx.state.user = await app.store.upsertUser(telegramId, username);
  await app.store.acceptTos(telegramId);
  await app.store.saveAccount({
    telegram_id: telegramId,
    account_address: "0x1111111111111111111111111111111111111111",
    bot_key_address: "0x2222222222222222222222222222222222222222",
    bot_key_encrypted: app.cipher.encrypt("0x" + "ab".repeat(32)),
    network: "hideki",
    linked_at: new Date(),
  });
  ctx.state.user = (await app.store.getUser(telegramId))!;
  ctx.state.account = await app.store.getAccount(telegramId);
  return ctx;
}

describe("telegram handlers", () => {
  let app: AppContext;

  beforeEach(() => {
    app = makeApp();
  });

  it("scopes agents to the user who deployed them", async () => {
    const alice = await linkedUser(app, 1, "alice");
    await deployCmd(alice, ["trend-rider", "BTC-PERP", "trade conservatively"]);

    expect(await app.store.listAgents(1)).toHaveLength(1);
    expect(await app.store.listAgents(2)).toHaveLength(0);
    const agent = (await app.store.listAgents(1))[0]!;
    expect(agent.market).toBe("BTC-PERP");
    expect(agent.thesis).toBe("trade conservatively");
    expect(agent.status).toBe("running");
  });

  it("normalises a market name the user typed loosely", async () => {
    const u = await linkedUser(app, 1);
    await deployCmd(u, ["trend-rider", "btc-perp"]);
    expect((await app.store.listAgents(1))[0]?.market).toBe("BTC-PERP");
  });

  it("refuses to deploy a second running agent", async () => {
    const u = await linkedUser(app, 1);
    await deployCmd(u, ["trend-rider", "BTC-PERP"]);
    await deployCmd(u, ["funding-hunter", "ETH-PERP"]);
    expect(await app.store.listAgents(1)).toHaveLength(1);
    expect(u.replies.at(-1)).toContain("already have a running agent");
  });

  it("rejects an unknown strategy", async () => {
    const u = await linkedUser(app, 1);
    await deployCmd(u, ["moon-shot", "BTC-PERP"]);
    expect(u.replies.at(-1)).toContain("Unknown strategy");
    expect(await app.store.listAgents(1)).toHaveLength(0);
  });

  it("applies risk limits to the newest agent and rejects invalid numbers", async () => {
    const u = await linkedUser(app, 1);
    await deployCmd(u, ["trend-rider", "BTC-PERP"]);
    const agent = (await app.store.listAgents(1))[0]!;

    const err = await applyRiskLimits(u, ["4", "15", "40", "2", "20"]);
    expect(err).toBeUndefined();
    const updated = (await app.store.getAgent(agent.id))!;
    expect(updated.max_leverage).toBe(4);
    expect(updated.margin_per_trade).toBe(15);
    expect(updated.max_total_margin).toBe(40);
    expect(updated.max_open_positions).toBe(2);
    expect(updated.max_daily_loss).toBe(20);

    const bad = await applyRiskLimits(u, ["0", "15", "40", "2", "20"]);
    expect(bad).toContain("not valid");
  });

  it("targets a specific agent when an id is supplied", async () => {
    const u = await linkedUser(app, 1);
    await deployCmd(u, ["trend-rider", "BTC-PERP"]);
    const agent = (await app.store.listAgents(1))[0]!;
    await applyRiskLimits(u, [String(agent.id), "3", "10", "30", "1", "15"]);
    expect((await app.store.getAgent(agent.id))!.max_leverage).toBe(3);
  });

  it("builds a journal path under the configured root", () => {
    expect(journalPathFor("/journals", 42, "trend-rider-1")).toBe("/journals/42/trend-rider-1.jsonl");
  });

  it("shows the notification defaults, then flips one on", async () => {
    const u = await linkedUser(app, 1);
    await notifyCmd(u, []);
    expect(u.replies[0]).toContain("Refused: off");

    await notifyCmd(u, ["refuse", "on"]);
    expect(u.replies[1]).toContain("refuse notifications on");
    expect((await app.store.getNotify(1))!.on_refuse).toBe(true);

    await notifyCmd(u, []);
    expect(u.replies[2]).toContain("Refused: on");
  });

  it("rejects an unknown notification setting", async () => {
    const u = await linkedUser(app, 1);
    await notifyCmd(u, ["volume", "on"]);
    expect(u.replies[0]).toContain("Use open, close or refuse");
  });

  it("builds a wallet deep link with the contract and calldata", () => {
    const link = walletDeepLink({
      to: "0x478769E1177C0773c43A593DCCc4Ad15F15F1394",
      data: "0xdeadbeef",
      chainId: 50383,
    });
    expect(link).toContain("metamask.app.link/send/0x478769E1177C0773c43A593DCCc4Ad15F15F1394@50383");
    expect(link).toContain("data=0xdeadbeef");
  });
});
