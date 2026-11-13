// The storage contract.
//
// Two implementations satisfy it: Postgres for production and an in-memory one
// for tests and for a no-DATABASE_URL first run. The interface is deliberately
// small and free of SQL so the agent logic can be tested against the in-memory
// version with no database at all.

import type {
  Account,
  Agent,
  AgentStatus,
  AuditEntry,
  AuditRecord,
  NewAgent,
  NewPosition,
  NotifySettings,
  PnlSummary,
  Position,
  User,
  WebLogin,
} from "./types.js";

export interface Store {
  /** Create the user row if it is missing and return it. */
  upsertUser(telegramId: number, username: string | null): Promise<User>;
  getUser(telegramId: number): Promise<User | undefined>;
  acceptTos(telegramId: number): Promise<void>;

  getAccount(telegramId: number): Promise<Account | undefined>;
  saveAccount(account: Omit<Account, "created_at" | "updated_at">): Promise<void>;
  markLinked(telegramId: number): Promise<void>;

  createAgent(input: NewAgent): Promise<Agent>;
  getAgent(id: number): Promise<Agent | undefined>;
  listAgents(telegramId: number): Promise<Agent[]>;
  /** Every running agent, across all users: what the worker's scheduler reads. */
  listRunningAgents(): Promise<Agent[]>;
  setAgentStatus(id: number, status: AgentStatus): Promise<void>;
  updateAgentLimits(
    id: number,
    limits: Pick<Agent, "max_leverage" | "margin_per_trade" | "max_total_margin" | "max_open_positions" | "max_daily_loss">,
  ): Promise<void>;
  setAgentDailyPnl(id: number, usd: number): Promise<void>;

  openPosition(input: NewPosition): Promise<Position>;
  /** The agent's position in a market that has not been closed. */
  openPositionIn(agentId: number, market: string): Promise<Position | undefined>;
  openPositionsFor(agentId: number): Promise<Position[]>;
  openPositionsForUser(telegramId: number): Promise<Position[]>;
  closePosition(id: number, reason: string, realizedPnl: number): Promise<void>;
  pnlSummary(telegramId: number, sinceHours: number): Promise<PnlSummary>;

  record(entry: AuditEntry): Promise<void>;
  recentAudit(telegramId: number, limit?: number): Promise<AuditRecord[]>;

  /** The user's notification preferences, or undefined when never set. */
  getNotify(telegramId: number): Promise<NotifySettings | undefined>;
  /** Upsert preferences. Only the fields given are changed. */
  saveNotify(
    telegramId: number,
    prefs: Partial<Pick<NotifySettings, "on_open" | "on_close" | "on_refuse" | "last_refusal_key" | "last_refusal_at">>,
  ): Promise<void>;

  /**
   * Web sign-in challenges. The web app creates one, the bot claims it, the web
   * app polls. Both processes need the same rows, so these live in the store
   * rather than in either process's memory.
   */
  createLogin(token: string, ttlMs: number): Promise<WebLogin>;
  /** Undefined when the token is unknown or has expired. */
  getLogin(token: string): Promise<WebLogin | undefined>;
  /**
   * Bind a challenge to the Telegram account that presented it. Returns the row
   * on success, or undefined when the token is unknown, expired or already
   * claimed — so a second chat cannot take over a challenge in flight.
   */
  claimLogin(token: string, telegramId: number): Promise<WebLogin | undefined>;
  /** Delete expired rows. Returns how many were removed. */
  purgeLogins(now?: Date): Promise<number>;
}
