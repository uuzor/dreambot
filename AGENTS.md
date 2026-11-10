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
npm run typecheck   # all 7 workspaces, src + test
npm test            # 102 tests, no network or DB needed
npm run doctor      # read-only check against live Hideki testnet
npm run bot         # Telegram process
npm run worker      # agent ticks + exit watching
npm run migrate     # apply Postgres schema (needs DATABASE_URL)
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

A Vultr API key in this environment is **IP-allowlisted**: the account-scoped and
mutating endpoints (`/account`, `/ssh-keys`, `/firewalls`, `POST /instances`) return
`401 Unauthorized IP address: <this host>`, while the read-only catalogue endpoints
(`/instances`, `/plans`, `/os`, `/regions`) return 200. So the Vultr account cannot be
driven from here until this host's egress IP is added to the API allowlist in the Vultr
customer portal (Account → API → Access Control). The running instances also have no SSH
key attached, so `docker compose up` on a fresh host is the path once access is granted.

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
```

## Not yet built

- No MCP server surface. Perpad had one; DreamPilot does not, deliberately — the Telegram
  bot is the only interface.
- No CI workflow, no Railway config files (README documents the two-service setup).
