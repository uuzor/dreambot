// Domain types shared by the store, the agent and the bot.

export interface User {
  telegram_id: number;
  username: string | null;
  created_at: Date;
  updated_at: Date;
  tos_accepted_at: Date | null;
}

export interface Account {
  telegram_id: number;
  /** The user's DreamDEX account. */
  account_address: string;
  /** The bot key's public address. */
  bot_key_address: string;
  /** AES-256-GCM ciphertext of the bot key. Never leaves the server. */
  bot_key_encrypted: Buffer;
  network: string;
  linked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type AgentStatus = "paused" | "running" | "stopped";

export interface Agent {
  id: number;
  telegram_id: number;
  strategy: string;
  market: string;
  status: AgentStatus;
  max_leverage: number;
  margin_per_trade: number;
  max_total_margin: number;
  max_open_positions: number;
  max_daily_loss: number | null;
  markets: string[];
  thesis: string | null;
  journal_path: string;
  daily_pnl_usd: number;
  created_at: Date;
  updated_at: Date;
}

export interface NewAgent {
  telegram_id: number;
  strategy: string;
  market: string;
  max_leverage: number;
  margin_per_trade: number;
  max_total_margin: number;
  max_open_positions: number;
  max_daily_loss: number | null;
  markets: string[];
  thesis: string | null;
  journal_path: string;
}

export interface Position {
  id: number;
  agent_id: number;
  telegram_id: number;
  market: string;
  side: "long" | "short";
  size: number;
  entry_price: number;
  leverage: number;
  margin_usd: number;
  take_profit: number | null;
  stop_loss: number | null;
  opened_at: Date;
  closed_at: Date | null;
  close_reason: string | null;
  realized_pnl: number | null;
}

export interface NewPosition {
  agent_id: number;
  telegram_id: number;
  market: string;
  side: "long" | "short";
  size: number;
  entry_price: number;
  leverage: number;
  margin_usd: number;
  take_profit: number | null;
  stop_loss: number | null;
}

export interface AuditEntry {
  telegram_id: number;
  agent_id?: number | null;
  action: string;
  market?: string | null;
  side?: string | null;
  size?: string | null;
  price?: string | null;
  tx_hash?: string | null;
  status: string;
  error?: string | null;
  raw?: unknown;
}

export interface AuditRecord extends AuditEntry {
  id: number;
  created_at: Date;
}

export interface PnlSummary {
  /** Realized PnL over the closed positions in the window. */
  realizedUsd: number;
  /** Number of closed trades in the window. */
  trades: number;
  wins: number;
  losses: number;
}

/**
 * How much a user wants to be told, and the state the refusal de-duplication
 * needs. One row per user.
 */
export interface NotifySettings {
  telegram_id: number;
  on_open: boolean;
  on_close: boolean;
  on_refuse: boolean;
  /** The last refusal notice sent, so an identical one is not repeated hourly. */
  last_refusal_key: string | null;
  last_refusal_at: Date | null;
  updated_at: Date;
}
