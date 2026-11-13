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
}

export const DEMO_TELEGRAM_ID = 770_001_337;
