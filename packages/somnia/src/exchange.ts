// The single entry point the agent uses. Builds one `SomniaMarkets` from a
// resolved config, and hands back the exchange plus the trading key.
//
// Adapted from the dreamDEX Bot Kit (`packages/perp-core/exchange.ts`, MIT).
// The difference here is that one process serves MANY users, so the exchange is
// built per (owner, botKey) pair and cached by the caller rather than read from
// a global env.

import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { makeChain, resolveConfig, type Network, type SomniaConfig } from "./config.js";
import { createTradingKey, linkProblem, linkStatus, type TradingKey } from "./operator.js";
import type { PerpMarket } from "./markets.js";

export interface ExchangeOptions {
  network?: Network | string;
  rpcUrl?: string;
  wsRpcUrl?: string;
  indexerUrl?: string;
  chainId?: number;
}

export interface SomniaContext {
  exchange: SomniaMarkets;
  config: SomniaConfig;
  /** True when a signer is present, which writes require. */
  canTrade: boolean;
  /**
   * Set when the bot key trades FOR an account. The exchange then reads as the
   * owner, so positions and margin are the account's, and order writes go
   * through this key as `...For` calls.
   */
  tradingKey?: TradingKey;
  /** The account every read and write is scoped to. */
  account?: `0x${string}`;
}

/**
 * Build a read-only exchange for market data, with no signer. Used by the
 * market browser and by the doctor script.
 */
export function createReadOnly(opts: ExchangeOptions = {}): SomniaContext {
  const config = resolveConfig(opts);
  const exchange = new SomniaMarkets({
    indexerUrl: config.indexerUrl,
    chain: makeChain(config),
    wsRpcUrl: config.wsRpcUrl,
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });
  return { exchange, config, canTrade: false };
}

/**
 * Build an exchange that trades `owner`'s account through `botPrivateKey`.
 *
 * The SDK gets the owner as a bare address, which makes it read-only for that
 * account: every read (positions, margin, sizing, the close preview) lands on
 * the account, and the SDK cannot send anything. Writes go through the trading
 * key as `...For` calls instead.
 *
 * The bot key only ever signs and pays gas. It cannot withdraw or transfer.
 */
export function createTradingContext(opts: ExchangeOptions & {
  owner: `0x${string}`;
  botPrivateKey: `0x${string}`;
}): SomniaContext {
  const config = resolveConfig(opts);
  const chain = makeChain(config);
  const exchange = new SomniaMarkets({
    indexerUrl: config.indexerUrl,
    chain,
    wsRpcUrl: config.wsRpcUrl,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    account: opts.owner,
  });
  const tradingKey = createTradingKey({
    owner: opts.owner,
    privateKey: opts.botPrivateKey,
    chain,
    rpcUrl: config.rpcUrl,
  });
  return { exchange, config, canTrade: true, tradingKey, account: opts.owner };
}

/**
 * The trading-key startup check: is this key linked to `owner` on this market?
 * Asks the pool itself, which is the check every order then has to pass.
 */
export async function tradingKeyCheck(
  ctx: SomniaContext,
  market: PerpMarket,
): Promise<{ ok: boolean; message?: string }> {
  const key = ctx.tradingKey;
  if (!key) return { ok: true };
  const problem = linkProblem(key, await linkStatus(key, market.info.poolAddress), market.display);
  return problem ? { ok: false, message: problem } : { ok: true, message: `bot key ${key.operator} trades for ${key.owner} on ${market.display}` };
}

/**
 * Which of `markets` the trading key can place and cancel on. The app links a
 * key pool by pool at link time, so a market listed later is not covered until
 * the same address is added again.
 */
export async function linkCoverage(
  ctx: SomniaContext,
  markets: PerpMarket[],
): Promise<{ linked: PerpMarket[]; missing: PerpMarket[] }> {
  const key = ctx.tradingKey;
  if (!key) return { linked: markets, missing: [] };
  const linked: PerpMarket[] = [];
  const missing: PerpMarket[] = [];
  for (const market of markets) {
    const status = await linkStatus(key, market.info.poolAddress);
    (status.place && status.cancel ? linked : missing).push(market);
  }
  return { linked, missing };
}

/** Close the exchange's websocket listeners so a process can exit cleanly. */
export async function shutdown(ctx: SomniaContext): Promise<void> {
  try {
    await ctx.exchange.close();
  } catch {
    // Nothing to close is not a failure.
  }
}
