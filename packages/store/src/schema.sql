-- DreamPilot schema.
--
-- The custody model is the point of this schema: DreamPilot never stores a key
-- that can move a user's funds. `bot_key_encrypted` holds a per-user bot key
-- whose only power is to place, cancel and reduce orders on an account the user
-- linked it to. `account_address` is the user's own DreamDEX account.

CREATE TABLE IF NOT EXISTS users (
  telegram_id     BIGINT PRIMARY KEY,
  username        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set once the user has read and accepted the risk disclosure.
  tos_accepted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS accounts (
  telegram_id          BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  -- The user's DreamDEX account the bot key is linked to.
  account_address      TEXT NOT NULL,
  -- The bot key's public address. Not a secret; shown in /connect.
  bot_key_address      TEXT NOT NULL,
  -- AES-256-GCM ciphertext of the bot key, IV prepended. Cannot withdraw funds.
  bot_key_encrypted    BYTEA NOT NULL,
  network              TEXT NOT NULL DEFAULT 'hideki',
  linked_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  strategy          TEXT NOT NULL,
  market            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'paused'
                    CHECK (status IN ('paused', 'running', 'stopped')),
  -- Risk limits, as set by the user through /risk and /deploy.
  max_leverage      INTEGER NOT NULL,
  margin_per_trade  DOUBLE PRECISION NOT NULL,
  max_total_margin  DOUBLE PRECISION NOT NULL,
  max_open_positions INTEGER NOT NULL DEFAULT 1,
  max_daily_loss    DOUBLE PRECISION,
  -- App-canonical market allow-list.
  markets           TEXT[] NOT NULL,
  -- Free-text the user gives the agent; the AI Trader reads it as guidance.
  thesis            TEXT,
  journal_path      TEXT NOT NULL,
  -- Realized PnL since 00:00 UTC, refreshed by the worker each tick.
  daily_pnl_usd     DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(telegram_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_running ON agents(status) WHERE status = 'running';

CREATE TABLE IF NOT EXISTS positions (
  id            BIGSERIAL PRIMARY KEY,
  agent_id      BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  market        TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('long', 'short')),
  size          DOUBLE PRECISION NOT NULL,
  entry_price   DOUBLE PRECISION NOT NULL,
  leverage      INTEGER NOT NULL,
  margin_usd    DOUBLE PRECISION NOT NULL,
  -- The exit the agent is watching, since a linked bot cannot arm exchange stops.
  take_profit   DOUBLE PRECISION,
  stop_loss     DOUBLE PRECISION,
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ,
  close_reason  TEXT,
  realized_pnl  DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_positions_open ON positions(agent_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(telegram_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  agent_id    BIGINT,
  action      TEXT NOT NULL,
  market      TEXT,
  side        TEXT,
  size        TEXT,
  price       TEXT,
  tx_hash     TEXT,
  status      TEXT NOT NULL,
  error       TEXT,
  raw         JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_log(telegram_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  telegram_id BIGINT PRIMARY KEY,
  state       TEXT NOT NULL,
  payload     JSONB,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- One-time web sign-in challenges. The web app inserts a row with a null
-- telegram_id, the bot fills it in when the user sends the token to the chat,
-- and the web app polls for it. A row with claimed_at set cannot be claimed
-- again, so a token is good for exactly one sign-in.
CREATE TABLE IF NOT EXISTS web_logins (
  token       TEXT PRIMARY KEY,
  telegram_id BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  claimed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_web_logins_expiry ON web_logins(expires_at);

-- Per-user notification preferences, and the state the refusal de-duplication
-- needs. A missing row means the defaults apply.
CREATE TABLE IF NOT EXISTS notify_settings (
  telegram_id       BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
  on_open           BOOLEAN NOT NULL DEFAULT true,
  on_close          BOOLEAN NOT NULL DEFAULT true,
  -- Off by default: a clamped strategy refuses on every tick, so this is opt-in.
  on_refuse         BOOLEAN NOT NULL DEFAULT false,
  last_refusal_key  TEXT,
  last_refusal_at   TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
