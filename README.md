# DreamPilot

A multi-user Telegram bot for autonomous perpetual-futures trading on **DreamDEX**, the
perps venue on **Somnia**.

Every user brings their own trading account. DreamPilot generates a **bot key** for that
user, the user links it in the DreamDEX app, and an autonomous agent trades the account
inside hard limits the user sets. The bot key can place, cancel and reduce orders. It
cannot withdraw or transfer funds, so DreamPilot never custodies anything.

```
Telegram (grammY)          Personal agent            Risk engine            dreamDEX perps
commands, buttons   ->     strategies + LLM    ->    hard limits      ->    Somnia + bot key
/connect /deploy           reads live markets        in code, not prose    linked to the account
```

## What it does

- `/start` — create your profile
- `/tos` — read and accept the risk disclosure
- `/connect` — create your bot key and link it in the DreamDEX app
- `/fund`, `/withdraw` — read your perps margin, and build a deposit or withdrawal to sign
- `/agents` — browse the strategy catalogue
- `/deploy` — activate an autonomous strategy
- `/positions`, `/pnl`, `/status`, `/journal` — see what your agent is doing and why
- `/risk` — set leverage, per-trade margin, total margin, open-position and daily-loss caps
- `/notify` — choose whether the agent messages you on opens, closes and refusals
- `/pause`, `/resume`, `/closeall` — stop the agent, or stop it and flatten the account

The agent strategies are **Trend Rider** (momentum breakouts), **Funding Hunter** (holds
the side funding pays), **Mean Reversion** (fades stretched moves) and **AI Trader** (an
LLM reads the tape and proposes a trade, with a rules-based fallback when no model is
configured).

## The safety model, in one paragraph

A strategy proposes; it never places an order. Its proposal is a plain object that the
[tick runner](packages/agent/src/runner.ts) hands to a pure risk function,
[`evaluate`](packages/risk/src/limits.ts), before anything reaches the venue. That
function clamps leverage and margin to your caps and refuses disallowed markets,
duplicate positions, over-limit exposure and a breached daily loss. Only an approved
proposal is sent, and every verdict — allowed, clamped or refused — is written to a
hash-chained journal the user can audit. The model has no way to skip this, because it
never holds a venue.

## Layout

```
packages/
  somnia/    dreamDEX perps adapter: markets, trading-key writes, orders, margin, funding
  risk/      the deterministic risk engine and the tamper-evident journal
  store/     Postgres schema + repository, with an in-memory implementation for tests
  agent/     venue interface, live + paper venues, strategies, the tick runner
  telegram/  grammY bot: commands, middleware, formatting
apps/
  bot/       the Telegram process
  worker/    ticks running agents; watches take-profit and stop-loss levels
  web/       Next.js landing page and the read-only dashboard
```

## The web app

```bash
npm run web        # http://localhost:3000
npm run web:build  # production build
```

A landing page and a dashboard over the same store the bot and worker write to. The
dashboard is **read-only on purpose**: it has no route handlers that mutate state, so it
cannot trade, pause an agent or rotate a key. Every action still happens in Telegram,
where the identity is verified. With `DATABASE_URL` unset it serves a demo dataset and
says so in the UI rather than pretending the numbers are real.

Set `DASHBOARD_TELEGRAM_ID` to choose which account the dashboard renders.

Set `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (the handle, without the `@`) to turn on the
"Connect Telegram" action. It links to `t.me/<handle>`, and the dashboard hides the
action rather than render a dead link when it is unset. Set `DASHBOARD_LINK_SECRET` too
and the link carries a `?start=` token — an HMAC of the Telegram id — so the bot can
trust that the hand-off came from the dashboard. Without the secret the link still
works, the bot just cannot pre-associate the chat with the account.

Whether Telegram is *connected* is answered by asking Telegram, not by the store: the
store knows who has traded, not who has started a chat. With `TELEGRAM_BOT_TOKEN` set the
dashboard calls `getChat`, and with it unset — or if Telegram cannot be reached — the
status reads "unknown" rather than claiming either way.


## Quickstart

```bash
npm install
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN and MASTER_ENCRYPTION_KEY (openssl rand -hex 32)
npm run doctor      # read-only check against the live Hideki testnet
npm run bot
```

With no `DATABASE_URL` the bot uses an in-memory store, so you can walk the whole flow
before provisioning Postgres. With no `REDIS_URL` the worker runs an in-process scheduler
instead of BullMQ. Both are honest single-process modes, not stubs: the same handlers and
the same tick run either way.

`AGENTS_DRY_RUN=true` (the default) makes every agent a **paper** agent. It reads real
Somnia prices and simulates fills and fees locally, so you can watch a strategy behave
against the live market without sending a transaction. Set it to `false` to trade a linked
account for real.

### Run the bot and the worker

```bash
npm run bot       # Telegram
npm run worker    # agent ticks and exit watching
```

### Hosting

DreamPilot is three processes with different shapes, so no single host runs all of it:

| Process | Shape | Host |
| --- | --- | --- |
| Bot | long-lived, Telegram long-polling | a container host (Railway, Fly) |
| Worker | long-lived, ticks every minute | a container host |
| Dashboard | request/response | any Node host |

**Render** runs the dashboard and the worker: [`render.yaml`](render.yaml) defines both,
plus Postgres and Key Value. Two things to know before using it.

- The Telegram bot is not in the blueprint. Render has no free background worker, so the
  bot needs a paid instance (or a different host). It is a long-polling process and cannot
  be a serverless function.
- The worker is on a paid plan on purpose. A Free *web* service spins down after 15 minutes
  idle, and a sleeping process cannot watch exits — which is exactly the job the worker
  does. Free *Postgres* also expires 30 days after creation (14-day grace, then deleted),
  so upgrade it before then or you lose the data.

**Vercel** runs the dashboard only, and `apps/web/vercel.json` is set up for it: point
Vercel at the repo with `apps/web` as the Root Directory. The bot and worker cannot go
there. A trading loop needs a continuous process, and a Hobby cron job runs at most once a
day with ±59 minutes of slop — that is not a watch on an open position. Vercel's Hobby
plan also forbids commercial use.

The honest split, then: **Render for the dashboard and the worker, a container host for
the bot.** Or skip the split and use **Railway** for all three plus Postgres and Redis, or
[`deploy/docker-compose.yml`](deploy/docker-compose.yml) for a self-contained stack.

### Deploy with docker-compose

See [`deploy/docker-compose.yml`](deploy/docker-compose.yml) for a self-contained
Postgres, Redis, bot and worker.

## Network

Perps live on the Somnia **Hideki** testnet, chain id **50383**. The bot kit's older spot
configuration points at Shannon (chain id 50312); DreamPilot configures the perps
environment explicitly rather than reusing it. Run `npm run doctor` to confirm the network
and that the market list is priced before you deploy anything.

## Custody and the linked-bot model

1. DreamPilot generates an EOA per user and stores its private key encrypted at rest
   (AES-256-GCM, keyed by `MASTER_ENCRYPTION_KEY`).
2. The user links that bot key's public address to their DreamDEX account in the app,
   ticking the Perps permission.
3. The agent signs with the bot key. Trades execute against the user's account.
4. The bot key can never withdraw or transfer the user's funds.

**Funding is built, never sent.** Perp orders lock margin from the user's perps balance,
so that balance has to be funded first. `/fund <amount>` and `/withdraw <amount>` build the
unsigned `approve` and `deposit` (or `withdraw`) calls and hand them back for the user's own
wallet to sign. There is no code path where DreamPilot moves collateral, because the bot key
has no permission to, and a call it could not sign is the honest shape for that.

**One limitation, stated plainly.** A linked bot key cannot arm exchange-side take-profit
or stop-loss orders: only the account itself can. So the exits are watched by the worker
process, and they only fire while it is running. This is told to the user at `/tos` and at
`/deploy` rather than hidden, because it changes what "set a stop" means here.

## Tests

```bash
npm test          # 113 tests across risk, store, agent, telegram, web and worker
npm run typecheck # every workspace
```

The tests cover the risk engine's clamp-and-refuse matrix, the journal's tamper evidence,
the strategy decisions, the paper venue's fill and fee maths, the bot-key encryption,
the multi-user isolation of agents, the unsigned funding calldata, and the notification
decision — all without a network or a database.

## Provenance and licences

DreamPilot is a synthesis of three reference projects, cloned under `references/` (not
committed) during development:

| Reference | Licence | What was taken |
| --- | --- | --- |
| [dreamdex-bot-kit](https://github.com/somnia-chain/dreamdex-bot-kit) | MIT | the DreamDEX perps SDK integration: markets, sizing, order writes, margin, funding |
| [perpad](https://github.com/nirholas/perpad) | MIT | the risk-engine shape, the hash-chained journal, and the paper/live venue split |
| [phoenixchan-bot](https://github.com/Sugusdaddy/phoenixchan-bot) | none declared | the multi-user Telegram command surface, as an architectural reference only |

No code was copied from phoenixchan-bot, which declares no licence. Its encrypted-custodial
wallet model was deliberately not reused: DreamPilot's keys are bot keys that cannot
withdraw.
