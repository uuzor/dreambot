// In-memory Store. Used by tests, and by a first run with no DATABASE_URL so a
// new user can see the whole flow before provisioning Postgres. State is lost on
// restart, which is the honest trade for zero setup.

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

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class MemoryStore implements Store {
  private users = new Map<number, User>();
  private accounts = new Map<number, Account>();
  private agents = new Map<number, Agent>();
  private positions = new Map<number, Position>();
  private audit: AuditRecord[] = [];
  private notify = new Map<number, NotifySettings>();
  private logins = new Map<string, WebLogin>();
  private nextAgentId = 1;
  private nextPositionId = 1;
  private nextAuditId = 1;

  async upsertUser(telegramId: number, username: string | null): Promise<User> {
    const existing = this.users.get(telegramId);
    if (existing) {
      existing.username = username;
      existing.updated_at = new Date();
      return clone(existing);
    }
    const now = new Date();
    const user: User = {
      telegram_id: telegramId,
      username,
      created_at: now,
      updated_at: now,
      tos_accepted_at: null,
    };
    this.users.set(telegramId, user);
    return clone(user);
  }

  async getUser(telegramId: number): Promise<User | undefined> {
    const u = this.users.get(telegramId);
    return u ? clone(u) : undefined;
  }

  async acceptTos(telegramId: number): Promise<void> {
    const u = this.users.get(telegramId);
    if (u) {
      u.tos_accepted_at = new Date();
      u.updated_at = new Date();
    }
  }

  async getAccount(telegramId: number): Promise<Account | undefined> {
    const a = this.accounts.get(telegramId);
    return a ? clone(a) : undefined;
  }

  async saveAccount(account: Omit<Account, "created_at" | "updated_at">): Promise<void> {
    const now = new Date();
    const existing = this.accounts.get(account.telegram_id);
    this.accounts.set(account.telegram_id, {
      ...account,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  async markLinked(telegramId: number): Promise<void> {
    const a = this.accounts.get(telegramId);
    if (a) {
      a.linked_at = new Date();
      a.updated_at = new Date();
    }
  }

  async createAgent(input: NewAgent): Promise<Agent> {
    const now = new Date();
    const agent: Agent = {
      id: this.nextAgentId++,
      telegram_id: input.telegram_id,
      strategy: input.strategy,
      market: input.market,
      status: "paused",
      max_leverage: input.max_leverage,
      margin_per_trade: input.margin_per_trade,
      max_total_margin: input.max_total_margin,
      max_open_positions: input.max_open_positions,
      max_daily_loss: input.max_daily_loss,
      markets: input.markets,
      thesis: input.thesis,
      journal_path: input.journal_path,
      daily_pnl_usd: 0,
      created_at: now,
      updated_at: now,
    };
    this.agents.set(agent.id, agent);
    return clone(agent);
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const a = this.agents.get(id);
    return a ? clone(a) : undefined;
  }

  async listAgents(telegramId: number): Promise<Agent[]> {
    return [...this.agents.values()]
      .filter((a) => a.telegram_id === telegramId)
      .sort((a, b) => b.id - a.id)
      .map(clone);
  }

  async listRunningAgents(): Promise<Agent[]> {
    return [...this.agents.values()].filter((a) => a.status === "running").map(clone);
  }

  async setAgentStatus(id: number, status: AgentStatus): Promise<void> {
    const a = this.agents.get(id);
    if (a) {
      a.status = status;
      a.updated_at = new Date();
    }
  }

  async updateAgentLimits(
    id: number,
    limits: Pick<Agent, "max_leverage" | "margin_per_trade" | "max_total_margin" | "max_open_positions" | "max_daily_loss">,
  ): Promise<void> {
    const a = this.agents.get(id);
    if (a) {
      Object.assign(a, limits);
      a.updated_at = new Date();
    }
  }

  async setAgentDailyPnl(id: number, usd: number): Promise<void> {
    const a = this.agents.get(id);
    if (a) a.daily_pnl_usd = usd;
  }

  async openPosition(input: NewPosition): Promise<Position> {
    const pos: Position = {
      id: this.nextPositionId++,
      ...input,
      opened_at: new Date(),
      closed_at: null,
      close_reason: null,
      realized_pnl: null,
    };
    this.positions.set(pos.id, pos);
    return clone(pos);
  }

  async openPositionIn(agentId: number, market: string): Promise<Position | undefined> {
    const p = [...this.positions.values()].find(
      (x) => x.agent_id === agentId && x.market === market && x.closed_at === null,
    );
    return p ? clone(p) : undefined;
  }

  async openPositionsFor(agentId: number): Promise<Position[]> {
    return [...this.positions.values()].filter((p) => p.agent_id === agentId && p.closed_at === null).map(clone);
  }

  async openPositionsForUser(telegramId: number): Promise<Position[]> {
    return [...this.positions.values()]
      .filter((p) => p.telegram_id === telegramId && p.closed_at === null)
      .sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime())
      .map(clone);
  }

  async closePosition(id: number, reason: string, realizedPnl: number): Promise<void> {
    const p = this.positions.get(id);
    if (p) {
      p.closed_at = new Date();
      p.close_reason = reason;
      p.realized_pnl = realizedPnl;
    }
  }

  async pnlSummary(telegramId: number, sinceHours: number): Promise<PnlSummary> {
    const since = Date.now() - sinceHours * 3600_000;
    const closed = [...this.positions.values()].filter(
      (p) => p.telegram_id === telegramId && p.closed_at !== null && p.closed_at.getTime() >= since,
    );
    const realizedUsd = closed.reduce((s, p) => s + (p.realized_pnl ?? 0), 0);
    const wins = closed.filter((p) => (p.realized_pnl ?? 0) > 0).length;
    return { realizedUsd, trades: closed.length, wins, losses: closed.length - wins };
  }

  async record(entry: AuditEntry): Promise<void> {
    this.audit.push({
      ...entry,
      id: this.nextAuditId++,
      created_at: new Date(),
    });
  }

  async recentAudit(telegramId: number, limit = 20): Promise<AuditRecord[]> {
    return this.audit
      .filter((a) => a.telegram_id === telegramId)
      .slice(-limit)
      .reverse()
      .map(clone);
  }

  async getNotify(telegramId: number): Promise<NotifySettings | undefined> {
    const n = this.notify.get(telegramId);
    return n ? clone(n) : undefined;
  }

  async saveNotify(
    telegramId: number,
    prefs: Partial<Pick<NotifySettings, "on_open" | "on_close" | "on_refuse" | "last_refusal_key" | "last_refusal_at">>,
  ): Promise<void> {
    const existing = this.notify.get(telegramId);
    this.notify.set(telegramId, {
      telegram_id: telegramId,
      on_open: prefs.on_open ?? existing?.on_open ?? true,
      on_close: prefs.on_close ?? existing?.on_close ?? true,
      on_refuse: prefs.on_refuse ?? existing?.on_refuse ?? false,
      last_refusal_key: prefs.last_refusal_key ?? existing?.last_refusal_key ?? null,
      last_refusal_at: prefs.last_refusal_at ?? existing?.last_refusal_at ?? null,
      updated_at: new Date(),
    });
  }

  async createLogin(token: string, ttlMs: number): Promise<WebLogin> {
    const now = new Date();
    const row: WebLogin = {
      token,
      telegram_id: null,
      created_at: now,
      expires_at: new Date(now.getTime() + ttlMs),
      claimed_at: null,
    };
    this.logins.set(token, row);
    return clone(row);
  }

  async getLogin(token: string): Promise<WebLogin | undefined> {
    const row = this.logins.get(token);
    if (!row) return undefined;
    if (row.expires_at.getTime() <= Date.now()) return undefined;
    return clone(row);
  }

  async claimLogin(token: string, telegramId: number): Promise<WebLogin | undefined> {
    const row = this.logins.get(token);
    if (!row) return undefined;
    if (row.expires_at.getTime() <= Date.now()) return undefined;
    if (row.claimed_at !== null) return undefined;
    row.telegram_id = telegramId;
    row.claimed_at = new Date();
    return clone(row);
  }

  async purgeLogins(now: Date = new Date()): Promise<number> {
    let removed = 0;
    for (const [token, row] of this.logins) {
      if (row.expires_at.getTime() <= now.getTime()) {
        this.logins.delete(token);
        removed++;
      }
    }
    return removed;
  }
}
