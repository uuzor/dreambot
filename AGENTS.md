# AGENTS.md

Repository-specific knowledge for DreamPilot. Read this before changing code.

## What this is

DreamPilot is a non-custodial, multi-user Telegram bot for trading DreamDEX perps on
Somnia. A user links a **bot key** (which cannot withdraw) to their own account; an
autonomous strategy trades that account inside hard limits.

Synthesized from three reference repos under `references/` (gitignored, not committed):
`dreamdex-bot-kit` (MIT, perps SDK integration), `perpad` (MIT, risk engine + journal
shape), `phoenixchan-bot` (no licence — architectural reference only, no code copied).

## Commands

```bash
npm install
npm run typecheck   # all 9 workspaces, src + test
npm test            # 113 tests, no network or DB needed
npm run doctor      # read-only check against live Hideki testnet
npm run bot         # Telegram process
npm run worker      # agent ticks + exit watching
npm run migrate     # apply Postgres schema (needs DATABASE_URL)
npm run web         # Next.js landing page + dashboard on :3000
```

## Architecture invariants

These are load-bearing. Do not weaken them.

1. **Strategies propose; they never place orders.** A strategy returns a `Proposal`
   object. Only `runTick` (`packages/agent/src/runner.ts`) acts on it, and only after
   `evaluate` (`packages/risk/src/limits.ts`) approves it. Never give a strategy a venue.
2. **`evaluate` is pure and deterministic.** Same inputs, same verdict — no clock, no
   network, no randomness. It clamps leverage/margin and refuses disallowed markets,
   duplicate positions, over-limit exposure and a breached daily loss. This is the only
   thing between a model's suggestion and a real order. Pin its behaviour in tests.
3. **The journal is hash-chained.** Every entry commits to the previous hash. A corrupt
   journal throws on open rather than being silently truncated. Verify with
   `Journal.verify`.
4. **The bot key never withdraws.** Keys are EOA bot keys stored AES-256-GCM encrypted
   (`packages/store/src/crypto.ts`). The bot key can place/cancel/reduce only. Never add a
   withdrawal path. Funding follows the same rule: `/fund` and `/withdraw`
   (`packages/somnia/src/margin-bank.ts`) *build* unsigned calldata and hand it to the
   user's own wallet. They never sign. Do not add a signer to that module.
5. **Exits are watcher-side.** A linked bot key cannot arm exchange-side TP/SL, so the
   worker watches marks and closes. This is disclosed to users at `/tos` and `/deploy`.
   It only fires while the worker runs.
6. **Notices are advisory.** `runTick` returns a `notice` describing what happened; it
   never sends anything itself. `deliverNotice` (`apps/worker/src/tick.ts`) applies the
   user's stored preferences and rate limit, then calls the notifier. A notification
   failure is logged and swallowed — it must never fail a tick.

## Environment degradation

The environment has no Redis, Postgres or Docker by default, and the code degrades
honestly rather than failing:

- No `DATABASE_URL` → `MemoryStore` instead of `PgStore` (`packages/store`). Same
  `Store` interface.
- No `REDIS_URL` → in-process interval scheduler instead of BullMQ
  (`apps/worker/src/scheduler.ts`). Both call the same `tickAgent`.
- `AGENTS_DRY_RUN=true` (default) → `PaperVenue` reads real prices and simulates fills
  and fees. Set `false` to send transactions.

Keep these paths working. A change that only works with Postgres + Redis is a regression
for local development.

## Network facts

- Perps run on Somnia **Hideki** testnet, chain id **50383**. Verify with `npm run doctor`.
- The bot kit's older **spot** config points at Shannon, chain id **50312**. Do not reuse
  it for perps — DreamPilot configures the perps environment explicitly.
- As of writing, the live indexer returns 21 perp markets. Symbols look like
  `BTC/USDso:USDso`; the app-canonical display form is `BTC-PERP`.
- The perps margin bank is `0x478769e1177c0773c43a593dccc4ad15f15f1394`, and collateral
  decimals come from the chain (`liveReads`), not a constant. Never hardcode 6 or 18.
- `market.chainId` is the chain id; `market.id` is the pool address. Do not confuse them.

## Deployment

`deploy/Dockerfile` and `deploy/docker-compose.yml` run Postgres, Redis, the bot and the
worker in one image; the command picks the service. The bot applies the schema on boot.

`render.yaml` is a Render Blueprint for the dashboard and the worker, plus Postgres and
Key Value. The bot is deliberately absent: Render has no free background worker, and the
bot is a long-polling process that cannot be a serverless function. The worker is on a paid
plan on purpose — a Free web instance spins down after 15 minutes idle, and the worker's
job is watching exits, which a sleeping process cannot do. Free Render Postgres also expires
30 days after creation. `apps/web/vercel.json` lets Vercel host the dashboard alone, with
`apps/web` as the Root Directory; Vercel's Hobby cron floor (once per day) rules it out for
the trading loop.

The dashboard creates its store with `{ skipMigrate: true }` and caches one pool per
process. It must not run DDL: migrations belong to the bot and worker, and `schema.sql` is
not shipped in a bundled serverless build, so a dashboard that migrated would fail and fall
back to demo data. Its routes are `force-dynamic` so positions and the Telegram connect
status are not frozen at build time.

**Validated end to end locally.** The image builds, and running it against real Postgres 16
and Redis 7 exercises every production path: `npm run migrate` applies the schema, `PgStore`
round-trips users, accounts (with bot-key encryption), agents, positions, PnL and audit rows,
the notify settings merge correctly on partial update, BullMQ schedules ticks, and an agent
ticks against live Hideki prices with a correctly hash-chained journal. The bot reaching
Telegram and getting a clean `401` on a placeholder token is the expected result and proves
the outbound path.

Two notes for anyone reading the store code:

- `createAgent` deliberately ignores a caller-supplied `status`; the schema defaults to
  `paused`, so a new agent never starts trading before `deploy` explicitly starts it.
- `PgStore` takes a connection string in its constructor (`new PgStore(url)`); use
  `createStore(url)` to get `MemoryStore` when `DATABASE_URL` is unset.

**The Vultr account is at its instance limit.** Provisioning fails with "You have reached
the maximum number of active instances for this account" on every plan and region tried
(`vc2-1c-2gb`/`ewr`, `vc2-1c-1gb`/`lhr`, `vc2-1c-1gb`/`fra`). Five instances are running
(`arkpay-prod`, `launchly-testnet`, `sentinel`, `beam-app`, `whot-anywhere`) and **none has
an SSH key attached**, so reusing one is not possible either. Deploying needs either a
Vultr limit increase or one of those five freed.

Prepared and waiting (created by the deploy attempt, both reusable, neither costs money):

- SSH key `dreampilot-deploy` — `a94b3f1d-215f-4f83-89ab-eb7668bbe2da`
- Firewall group `dreampilot` — `8b2bd576-0443-4602-9721-008175e18427`, rule `22/tcp`
  only. Postgres and Redis stay on the Docker network and are never published.

The API key here is IP-allowlisted; the read-only catalogue endpoints answer but anything
account-scoped or mutating returns `401 Unauthorized IP address: <this host>` until the
egress IP is allowed in the Vultr portal (Account → API → Access Control).

## Conventions

- ESM throughout, `moduleResolution: "Bundler"`, `.js` extensions on relative imports.
- Packages export TypeScript source directly (`main`/`exports` point at `src/index.ts`);
  apps run under `tsx`. There is no build step.
- `strict` + `noUncheckedIndexedAccess` are on. Index access yields `T | undefined`.
- Package `tsconfig.json` includes both `src` and `test`.
- Tests use the real implementations (real `MemoryStore`, real `PaperVenue`, real risk
  engine). Do not introduce mocks; inject a fake `PriceSource` or venue instead.
- Tests must not require a network or a database.

## Package map

```
packages/somnia/    dreamDEX adapter: config, markets, operator/trading-key writes,
                    orders, margin, margin-bank (unsigned funding/withdraw plans),
                    funding, doctor
packages/risk/      limits.ts (evaluate, effectiveMaxLeverage), journal.ts (hash chain)
packages/store/     Store interface, memory.ts, postgres.ts, crypto.ts (Cipher)
packages/agent/     venue.ts (Venue iface), somnia-venue, paper-venue, strategies/,
                    runner.ts (runTick, watchExits), factory.ts (buildVenue)
packages/telegram/  app.ts (AppContext), middleware.ts (AppCtx), commands.ts, bot.ts,
                    notify.ts (formatNotice, decideNotice), keys.ts
apps/bot/           main.ts
apps/worker/        main.ts, tick.ts (tickAgent, deliverNotice), scheduler.ts
apps/web/           Next.js app: landing page (src/app/page.tsx) and the dashboard
                    (src/app/dashboard/**). Reads the store read-only via
                    src/lib/data.ts; falls back to src/lib/demo.ts when DATABASE_URL
                    is unset. Never writes and never holds a key.
```

## Web dashboard

The dashboard is a read-only view of the same store the bot and worker write to. It is
deliberately not a control plane: there are no route handlers that mutate state, so a
compromised web process cannot trade, pause an agent or rotate a key. Actions still
happen in Telegram, where the identity is verified.

- `loadDashboard()` (`apps/web/src/lib/data.ts`) reads `PgStore` when `DATABASE_URL` is
  set, keyed on `DASHBOARD_TELEGRAM_ID` (defaults to the demo id). If the read fails it
  serves the demo set and the UI shows a "demo data" badge rather than pretending.
- The store keeps open positions and a PnL aggregate, not a closed-position history, so
  the live path reports the aggregate instead of inventing rows.
- `apps/web` pins webpack (`next dev --webpack`) and sets `resolve.extensionAlias` in
  `next.config.ts` so the workspace packages' NodeNext-style `./x.js` specifiers resolve
  to `.ts`. Turbopack does not honour that alias.
- Design tokens live in `apps/web/src/app/globals.css` under Tailwind v4 `@theme`.


## Not yet built

- No MCP server surface. Perpad had one; DreamPilot does not, deliberately — the Telegram
  bot is the only interface that can *act*. The web dashboard is read-only by design.
- No CI workflow. Deploy config is `render.yaml` (dashboard + worker) and
  `apps/web/vercel.json` (dashboard only); the bot and worker need a container host, which
  README's Hosting section spells out.
