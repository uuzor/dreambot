import type {
  Agent,
  AuditRecord,
  Position,
  PnlSummary,
} from "@dreampilot/store";

/** A journal line as written by `packages/risk/src/journal.ts`. */
export interface JournalLine {
  seq: number;
  ts: string;
  kind: string;
  data: Record<string, unknown>;
  prev: string;
  hash: string;
}

export interface EquityPoint {
  t: string;
  equity: number;
}

/** How to reach the bot, resolved once per load. `url` is null when no bot
 *  username is configured; `reachability` is "unknown" when the bot token is
 *  absent or Telegram could not be asked, and callers must not treat that as
 *  connected. */
export interface TelegramLink {
  username: string | null;
  url: string | null;
  reachability: "connected" | "not-started" | "unknown";
}

/** Live account state read from the chain, when an account is linked. */
export interface LiveAccount {
  /** False when the numbers are a paper simulation rather than the real account. */
  live: boolean;
  equityUsd: number;
  availableUsd: number;
  /** Realized PnL today, from the store's close records. */
  dailyPnlUsd: number;
  positions: Array<{
    market: string;
    side: "long" | "short";
    size: number;
    entryPrice: number;
    leverage: number;
    marginUsd: number;
    unrealizedPnlUsd: number;
    liquidationPx: number | null;
  }>;
}

export interface DashboardData {
  source: "live" | "demo";
  /** True when a session cookie identified the viewer. */
  signedIn: boolean;
  user: {
    telegramId: number;
    username: string | null;
    tosAccepted: boolean;
  };
  account: {
    address: string;
    botKeyAddress: string;
    network: string;
    linked: boolean;
  } | null;
  /** Onchain equity, free margin and positions, or null when unavailable. */
  liveAccount: LiveAccount | null;
  agents: Agent[];
  openPositions: Position[];
  closedPositions: Position[];
  pnl: PnlSummary;
  equity: EquityPoint[];
  audit: AuditRecord[];
  journal: JournalLine[];
  telegram: TelegramLink;
}

export const DEMO_TELEGRAM_ID = 770_001_337;
