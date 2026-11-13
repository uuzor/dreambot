import type { Agent, AuditRecord, Position } from "@dreampilot/store";
import { DEMO_TELEGRAM_ID, type DashboardData, type EquityPoint, type JournalLine } from "./types";

const now = Date.now();
const mins = (n: number) => new Date(now - n * 60_000);
const hours = (n: number) => new Date(now - n * 3_600_000);

const AGENT_IDS = { trend: 41, funding: 42, reversion: 43, ai: 44 };

export const demoAgents: Agent[] = [
  {
    id: AGENT_IDS.trend,
    telegram_id: DEMO_TELEGRAM_ID,
    strategy: "trend-rider",
    market: "BTC-PERP",
    status: "running",
    max_leverage: 3,
    margin_per_trade: 150,
    max_total_margin: 600,
    max_open_positions: 2,
    max_daily_loss: 180,
    markets: ["BTC-PERP", "ETH-PERP"],
    thesis: "Momentum is up while price holds above the 20-period mean.",
    journal_path: "/data/journals/41.jsonl",
    daily_pnl_usd: 214.36,
    created_at: hours(52),
    updated_at: mins(2),
  },
  {
    id: AGENT_IDS.funding,
    telegram_id: DEMO_TELEGRAM_ID,
    strategy: "funding-hunter",
    market: "ETH-PERP",
    status: "running",
    max_leverage: 2,
    margin_per_trade: 100,
    max_total_margin: 400,
    max_open_positions: 3,
    max_daily_loss: 120,
    markets: ["ETH-PERP", "SOL-PERP", "XAU-PERP"],
    thesis: "Collect funding on the crowded side while the basis stays positive.",
    journal_path: "/data/journals/42.jsonl",
    daily_pnl_usd: 38.12,
    created_at: hours(30),
    updated_at: mins(1),
  },
  {
    id: AGENT_IDS.reversion,
    telegram_id: DEMO_TELEGRAM_ID,
    strategy: "mean-reversion",
    market: "SOL-PERP",
    status: "paused",
    max_leverage: 2,
    margin_per_trade: 75,
    max_total_margin: 225,
    max_open_positions: 2,
    max_daily_loss: 90,
    markets: ["SOL-PERP"],
    thesis: null,
    journal_path: "/data/journals/43.jsonl",
    daily_pnl_usd: -42.8,
    created_at: hours(20),
    updated_at: hours(6),
  },
  {
    id: AGENT_IDS.ai,
    telegram_id: DEMO_TELEGRAM_ID,
    strategy: "ai-trader",
    market: "BTC-PERP",
    status: "stopped",
    max_leverage: 4,
    margin_per_trade: 200,
    max_total_margin: 800,
    max_open_positions: 3,
    max_daily_loss: 250,
    markets: ["BTC-PERP", "ETH-PERP", "SOL-PERP"],
    thesis: "Reads the tape and proposes trades, with a rules-based fallback.",
    journal_path: "/data/journals/44.jsonl",
    daily_pnl_usd: 0,
    created_at: hours(8),
    updated_at: hours(4),
  },
];

export const demoOpenPositions: Position[] = [
  {
    id: 9001,
    agent_id: AGENT_IDS.trend,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "BTC-PERP",
    side: "long",
    size: 0.0074,
    entry_price: 61_240.5,
    leverage: 3,
    margin_usd: 150,
    take_profit: 64_800,
    stop_loss: 59_400,
    opened_at: mins(214),
    closed_at: null,
    close_reason: null,
    realized_pnl: null,
  },
  {
    id: 9002,
    agent_id: AGENT_IDS.trend,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "ETH-PERP",
    side: "long",
    size: 0.62,
    entry_price: 3_182.4,
    leverage: 2,
    margin_usd: 120,
    take_profit: 3_360,
    stop_loss: 3_090,
    opened_at: mins(96),
    closed_at: null,
    close_reason: null,
    realized_pnl: null,
  },
  {
    id: 9003,
    agent_id: AGENT_IDS.funding,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "SOL-PERP",
    side: "short",
    size: 14.2,
    entry_price: 148.62,
    leverage: 2,
    margin_usd: 100,
    take_profit: 138.0,
    stop_loss: 156.5,
    opened_at: mins(640),
    closed_at: null,
    close_reason: null,
    realized_pnl: null,
  },
];

export const demoClosedPositions: Position[] = [
  {
    id: 8801,
    agent_id: AGENT_IDS.trend,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "BTC-PERP",
    side: "long",
    size: 0.0061,
    entry_price: 59_880,
    leverage: 3,
    margin_usd: 120,
    take_profit: 63_000,
    stop_loss: 58_500,
    opened_at: hours(9),
    closed_at: hours(5),
    close_reason: "take-profit",
    realized_pnl: 186.4,
  },
  {
    id: 8802,
    agent_id: AGENT_IDS.funding,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "ETH-PERP",
    side: "short",
    size: 0.9,
    entry_price: 3_246.1,
    leverage: 2,
    margin_usd: 140,
    take_profit: 3_120,
    stop_loss: 3_320,
    opened_at: hours(14),
    closed_at: hours(11),
    close_reason: "take-profit",
    realized_pnl: 72.9,
  },
  {
    id: 8803,
    agent_id: AGENT_IDS.reversion,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "SOL-PERP",
    side: "long",
    size: 11.4,
    entry_price: 152.9,
    leverage: 2,
    margin_usd: 80,
    take_profit: 161.0,
    stop_loss: 147.0,
    opened_at: hours(19),
    closed_at: hours(17),
    close_reason: "stop-loss",
    realized_pnl: -42.8,
  },
  {
    id: 8804,
    agent_id: AGENT_IDS.trend,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "BTC-PERP",
    side: "short",
    size: 0.0042,
    entry_price: 62_410,
    leverage: 2,
    margin_usd: 95,
    take_profit: 60_500,
    stop_loss: 63_600,
    opened_at: hours(26),
    closed_at: hours(23),
    close_reason: "take-profit",
    realized_pnl: 58.3,
  },
  {
    id: 8805,
    agent_id: AGENT_IDS.funding,
    telegram_id: DEMO_TELEGRAM_ID,
    market: "SOL-PERP",
    side: "short",
    size: 9.8,
    entry_price: 151.2,
    leverage: 2,
    margin_usd: 70,
    take_profit: 143.0,
    stop_loss: 158.0,
    opened_at: hours(33),
    closed_at: hours(29),
    close_reason: "signal-flip",
    realized_pnl: 24.1,
  },
];

/** A 30-day equity curve that ends near the sum of the realized PnL above. */
export const demoEquity: EquityPoint[] = (() => {
  const points: EquityPoint[] = [];
  let equity = 8_400;
  const drift = [0.4, -0.6, 1.1, 0.3, -0.9, 0.7, 1.4, -0.2, 0.6, 1.2];
  for (let d = 29; d >= 0; d--) {
    const step = drift[d % drift.length] ?? 0.5;
    equity += step * 26 + (d % 3 === 0 ? -12 : 14);
    points.push({
      t: new Date(now - d * 86_400_000).toISOString().slice(5, 10),
      equity: Math.round(equity * 100) / 100,
    });
  }
  return points;
})();

export const demoAudit: AuditRecord[] = [
  { id: 1, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.trend, action: "open", market: "ETH-PERP", side: "long", size: "0.62", price: "3182.40", tx_hash: "0x7a3f…c21b", status: "ok", created_at: mins(96) },
  { id: 2, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.funding, action: "close", market: "ETH-PERP", side: "short", size: "0.90", price: "3120.00", tx_hash: "0x91be…40da", status: "ok", created_at: hours(11) },
  { id: 3, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.reversion, action: "close", market: "SOL-PERP", side: "long", size: "11.4", price: "147.00", tx_hash: "0x4c02…88f1", status: "ok", created_at: hours(17) },
  { id: 4, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.ai, action: "refuse", market: "SOL-PERP", side: "long", size: "22.0", price: "149.10", status: "refused", error: "daily loss limit reached", created_at: hours(18) },
  { id: 5, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.trend, action: "open", market: "BTC-PERP", side: "long", size: "0.0074", price: "61240.50", tx_hash: "0x2d77…9ac4", status: "ok", created_at: mins(214) },
  { id: 6, telegram_id: DEMO_TELEGRAM_ID, agent_id: AGENT_IDS.funding, action: "refuse", market: "XAU-PERP", side: "long", size: "1.2", price: "4048.80", status: "refused", error: "max open positions reached", created_at: hours(22) },
];

/** Journal lines with a real hash chain, so the verify view shows something true. */
export const demoJournal: JournalLine[] = (() => {
  const seeds: Array<[string, Record<string, unknown>]> = [
    ["tick", { strategy: "trend-rider", mode: "live", dryRun: false }],
    ["thought", { note: "price above the 20-period mean, momentum positive" }],
    ["proposal", { market: "BTC-PERP", side: "long", size: 0.0074, leverage: 3 }],
    ["verdict", { allowed: true, clamped: false, reasons: [] }],
    ["order", { market: "BTC-PERP", side: "long", size: 0.0074, price: 61240.5 }],
    ["tick", { strategy: "funding-hunter", mode: "live", dryRun: false }],
    ["thought", { note: "funding positive and rising on ETH, holding the short" }],
    ["verdict", { allowed: false, clamped: false, reasons: ["daily loss limit reached"] }],
  ];
  let prev = "0".repeat(64);
  return seeds.map(([kind, data], i) => {
    // A cheap stand-in for the real hash; the shape and chaining are what matter here.
    let h = 0x811c9dc5;
    const text = `${i}:${kind}:${JSON.stringify(data)}:${prev}`;
    for (let c = 0; c < text.length; c++) {
      h ^= text.charCodeAt(c);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const hash = (h.toString(16).padStart(8, "0").repeat(8)).slice(0, 64);
    const line: JournalLine = {
      seq: i + 1,
      ts: new Date(now - (seeds.length - i) * 96_000).toISOString(),
      kind,
      data,
      prev,
      hash,
    };
    prev = hash;
    return line;
  });
})();

/** The demo set, everything except the bot link — that is resolved from the
 *  environment by `loadDashboard`, not baked into fixtures. */
export function demoDashboard(): Omit<DashboardData, "telegram"> {
  const realized = demoClosedPositions.reduce((s, p) => s + (p.realized_pnl ?? 0), 0);
  const wins = demoClosedPositions.filter((p) => (p.realized_pnl ?? 0) > 0).length;
  return {
    source: "demo",
    user: { telegramId: DEMO_TELEGRAM_ID, username: "demo_trader", tosAccepted: true },
    account: {
      address: "0x8fA3b2C41d9E5a7B6c0D1e2F3a4B5c6D7e8F9a0B",
      botKeyAddress: "0x1C4d6F8a0B2e4D6f8A0b2C4d6E8f0A2b4C6d8E0f",
      network: "hideki",
      linked: true,
    },
    agents: demoAgents,
    openPositions: demoOpenPositions,
    closedPositions: demoClosedPositions,
    pnl: {
      realizedUsd: Math.round(realized * 100) / 100,
      trades: demoClosedPositions.length,
      wins,
      losses: demoClosedPositions.length - wins,
    },
    equity: demoEquity,
    audit: demoAudit,
    journal: demoJournal,
  };
}
