// Postgres Store. The production implementation.
//
// One connection pool, parameterised queries only. Every method maps rows to the
// domain types in ./types.ts, so callers never see a `pg` result.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Store } from "./store.js";
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

const __dirname = dirname(fileURLToPath(import.meta.url));

/** pg returns BIGINT as a string by default; these ids are safe as numbers. */
const INT8 = 20;

export class PgStore implements Store {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    // A small pool with a short idle timeout. Serverless platforms run many
    // short-lived instances, and the default pool of 10 per instance exhausts a
    // managed Postgres connection limit quickly. A long-running bot process can
    // raise PG_POOL_MAX if it needs more.
    this.pool = new pg.Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 4),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
  }

  /** Apply the schema. Idempotent, so it is safe to run on every boot. */
  async migrate(): Promise<void> {
    const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
    await this.pool.query(schema);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async one<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const res = await this.pool.query(sql, params);
    return res.rows[0] as T | undefined;
  }

  private async many<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async upsertUser(telegramId: number, username: string | null): Promise<User> {
    const row = await this.one<User>(
      `INSERT INTO users (telegram_id, username) VALUES ($1, $2)
       ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()
       RETURNING *`,
      [telegramId, username],
    );
    return row!;
  }

  async getUser(telegramId: number): Promise<User | undefined> {
    return this.one<User>(`SELECT * FROM users WHERE telegram_id = $1`, [telegramId]);
  }

  async acceptTos(telegramId: number): Promise<void> {
    await this.pool.query(`UPDATE users SET tos_accepted_at = now(), updated_at = now() WHERE telegram_id = $1`, [telegramId]);
  }

  async getAccount(telegramId: number): Promise<Account | undefined> {
    return this.one<Account>(`SELECT * FROM accounts WHERE telegram_id = $1`, [telegramId]);
  }

  async saveAccount(account: Omit<Account, "created_at" | "updated_at">): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (telegram_id, account_address, bot_key_address, bot_key_encrypted, network, linked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         account_address = EXCLUDED.account_address,
         bot_key_address = EXCLUDED.bot_key_address,
         bot_key_encrypted = EXCLUDED.bot_key_encrypted,
         network = EXCLUDED.network,
         linked_at = EXCLUDED.linked_at,
         updated_at = now()`,
      [
        account.telegram_id,
        account.account_address,
        account.bot_key_address,
        account.bot_key_encrypted,
        account.network,
        account.linked_at,
      ],
    );
  }

  async markLinked(telegramId: number): Promise<void> {
    await this.pool.query(`UPDATE accounts SET linked_at = now(), updated_at = now() WHERE telegram_id = $1`, [telegramId]);
  }

  async createAgent(input: NewAgent): Promise<Agent> {
    const row = await this.one<Agent>(
      `INSERT INTO agents
         (telegram_id, strategy, market, max_leverage, margin_per_trade, max_total_margin,
          max_open_positions, max_daily_loss, markets, thesis, journal_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        input.telegram_id,
        input.strategy,
        input.market,
        input.max_leverage,
        input.margin_per_trade,
        input.max_total_margin,
        input.max_open_positions,
        input.max_daily_loss,
        input.markets,
        input.thesis,
        input.journal_path,
      ],
    );
    return row!;
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    return this.one<Agent>(`SELECT * FROM agents WHERE id = $1`, [id]);
  }

  async listAgents(telegramId: number): Promise<Agent[]> {
    return this.many<Agent>(`SELECT * FROM agents WHERE telegram_id = $1 ORDER BY id DESC`, [telegramId]);
  }

  async listRunningAgents(): Promise<Agent[]> {
    return this.many<Agent>(`SELECT * FROM agents WHERE status = 'running' ORDER BY id`);
  }

  async setAgentStatus(id: number, status: AgentStatus): Promise<void> {
    await this.pool.query(`UPDATE agents SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  }

  async updateAgentLimits(
    id: number,
    limits: Pick<Agent, "max_leverage" | "margin_per_trade" | "max_total_margin" | "max_open_positions" | "max_daily_loss">,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE agents SET max_leverage = $2, margin_per_trade = $3, max_total_margin = $4,
         max_open_positions = $5, max_daily_loss = $6, updated_at = now()
       WHERE id = $1`,
      [id, limits.max_leverage, limits.margin_per_trade, limits.max_total_margin, limits.max_open_positions, limits.max_daily_loss],
    );
  }

  async setAgentDailyPnl(id: number, usd: number): Promise<void> {
    await this.pool.query(`UPDATE agents SET daily_pnl_usd = $2 WHERE id = $1`, [id, usd]);
  }

  async openPosition(input: NewPosition): Promise<Position> {
    const row = await this.one<Position>(
      `INSERT INTO positions
         (agent_id, telegram_id, market, side, size, entry_price, leverage, margin_usd, take_profit, stop_loss)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.agent_id,
        input.telegram_id,
        input.market,
        input.side,
        input.size,
        input.entry_price,
        input.leverage,
        input.margin_usd,
        input.take_profit,
        input.stop_loss,
      ],
    );
    return row!;
  }

  async openPositionIn(agentId: number, market: string): Promise<Position | undefined> {
    return this.one<Position>(
      `SELECT * FROM positions WHERE agent_id = $1 AND market = $2 AND closed_at IS NULL ORDER BY id DESC LIMIT 1`,
      [agentId, market],
    );
  }

  async openPositionsFor(agentId: number): Promise<Position[]> {
    return this.many<Position>(`SELECT * FROM positions WHERE agent_id = $1 AND closed_at IS NULL ORDER BY id`, [agentId]);
  }

  async openPositionsForUser(telegramId: number): Promise<Position[]> {
    return this.many<Position>(
      `SELECT * FROM positions WHERE telegram_id = $1 AND closed_at IS NULL ORDER BY opened_at DESC`,
      [telegramId],
    );
  }

  async closePosition(id: number, reason: string, realizedPnl: number): Promise<void> {
    await this.pool.query(
      `UPDATE positions SET closed_at = now(), close_reason = $2, realized_pnl = $3 WHERE id = $1`,
      [id, reason, realizedPnl],
    );
  }

  async pnlSummary(telegramId: number, sinceHours: number): Promise<PnlSummary> {
    const row = await this.one<{ realized: string | null; trades: string; wins: string }>(
      `SELECT
         COALESCE(SUM(realized_pnl), 0)::text AS realized,
         COUNT(*)::text AS trades,
         COUNT(*) FILTER (WHERE realized_pnl > 0)::text AS wins
       FROM positions
       WHERE telegram_id = $1 AND closed_at IS NOT NULL AND closed_at >= now() - ($2 || ' hours')::interval`,
      [telegramId, String(sinceHours)],
    );
    const trades = Number(row?.trades ?? 0);
    const wins = Number(row?.wins ?? 0);
    return { realizedUsd: Number(row?.realized ?? 0), trades, wins, losses: trades - wins };
  }

  async record(entry: AuditEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_log (telegram_id, agent_id, action, market, side, size, price, tx_hash, status, error, raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.telegram_id,
        entry.agent_id ?? null,
        entry.action,
        entry.market ?? null,
        entry.side ?? null,
        entry.size ?? null,
        entry.price ?? null,
        entry.tx_hash ?? null,
        entry.status,
        entry.error ?? null,
        entry.raw ? JSON.stringify(entry.raw) : null,
      ],
    );
  }

  async recentAudit(telegramId: number, limit = 20): Promise<AuditRecord[]> {
    return this.many<AuditRecord>(
      `SELECT * FROM audit_log WHERE telegram_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [telegramId, limit],
    );
  }

  async getNotify(telegramId: number): Promise<NotifySettings | undefined> {
    return this.one<NotifySettings>(`SELECT * FROM notify_settings WHERE telegram_id = $1`, [telegramId]);
  }

  async saveNotify(
    telegramId: number,
    prefs: Partial<Pick<NotifySettings, "on_open" | "on_close" | "on_refuse" | "last_refusal_key" | "last_refusal_at">>,
  ): Promise<void> {
    // COALESCE keeps an unspecified field at its stored value, so a caller can
    // flip one toggle without having to resend the others.
    await this.pool.query(
      `INSERT INTO notify_settings (telegram_id, on_open, on_close, on_refuse, last_refusal_key, last_refusal_at)
       VALUES ($1, COALESCE($2, true), COALESCE($3, true), COALESCE($4, false), $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         on_open          = COALESCE($2, notify_settings.on_open),
         on_close         = COALESCE($3, notify_settings.on_close),
         on_refuse        = COALESCE($4, notify_settings.on_refuse),
         last_refusal_key = COALESCE($5, notify_settings.last_refusal_key),
         last_refusal_at  = COALESCE($6, notify_settings.last_refusal_at),
         updated_at       = now()`,
      [
        telegramId,
        prefs.on_open ?? null,
        prefs.on_close ?? null,
        prefs.on_refuse ?? null,
        prefs.last_refusal_key ?? null,
        prefs.last_refusal_at ?? null,
      ],
    );
  }

  async createLogin(token: string, ttlMs: number): Promise<WebLogin> {
    const row = await this.one<WebLogin>(
      `INSERT INTO web_logins (token, expires_at)
       VALUES ($1, now() + ($2 || ' milliseconds')::interval)
       RETURNING *`,
      [token, String(ttlMs)],
    );
    return row!;
  }

  async getLogin(token: string): Promise<WebLogin | undefined> {
    return this.one<WebLogin>(
      `SELECT * FROM web_logins WHERE token = $1 AND expires_at > now()`,
      [token],
    );
  }

  async claimLogin(token: string, telegramId: number): Promise<WebLogin | undefined> {
    // The WHERE clause is the guard: expiry and "not already claimed" are checked
    // by the database in the same statement that writes, so two chats racing on
    // one token cannot both claim it.
    return this.one<WebLogin>(
      `UPDATE web_logins
         SET telegram_id = $2, claimed_at = now()
       WHERE token = $1 AND claimed_at IS NULL AND expires_at > now()
       RETURNING *`,
      [token, telegramId],
    );
  }

  async purgeLogins(now: Date = new Date()): Promise<number> {
    const res = await this.pool.query(`DELETE FROM web_logins WHERE expires_at <= $1`, [now]);
    return res.rowCount ?? 0;
  }
}

export { INT8 };
