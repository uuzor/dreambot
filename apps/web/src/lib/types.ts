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

export interface DashboardData {
  source: "live" | "demo";
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
