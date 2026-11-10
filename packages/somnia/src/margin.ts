// Margin reads. Adapted from the dreamDEX Bot Kit (`packages/perp-core/margin.ts`, MIT).
//
// Margin is a prerequisite, not a step. Orders lock collateral from the
// MarginBank, so an agent on an account with an empty bank fails EVERY order,
// one revert at a time, while looking like a market or a pricing problem.

import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { PerpMarket } from "./markets.js";

export interface MarginSnapshot {
  /** Collateral that is not backing anything, raw quote units. */
  unlocked: bigint;
  locked: bigint;
  /** Collateral plus unrealised PnL. */
  equity: bigint;
  /** What can be withdrawn right now. */
  withdrawable: bigint;
  imReq: bigint;
  mmReq: bigint;
  cmReq: bigint;
  /** The bank's own label for the account's state. */
  status: string;
  /** Pools this account currently has exposure in. */
  activePools: readonly `0x${string}`[];
}

/** Read the account's cross-margin state. Positions are per account, not per market. */
export async function marginSnapshot(
  exchange: SomniaMarkets,
  market: PerpMarket,
  account: `0x${string}`,
): Promise<MarginSnapshot> {
  const a = await exchange.client.getMarginAccount(market.info.marginBank, account);
  return {
    unlocked: a.unlockedCollateralBalance,
    locked: a.lockedCollateral,
    equity: a.equity,
    withdrawable: a.withdrawable,
    imReq: a.imReq,
    mmReq: a.mmReq,
    cmReq: a.cmReq,
    status: String(a.marginStatus),
    activePools: a.activePerpPools as readonly `0x${string}`[],
  };
}

/**
 * Health as a ratio of equity to the maintenance requirement.
 *
 * `Infinity` when nothing is open, which is the honest answer: an account with
 * no position cannot be liquidated, and returning 0 or 1 there would make the
 * guard act on a number that means nothing.
 */
export function healthRatio(m: MarginSnapshot): number {
  if (m.mmReq === 0n) return Number.POSITIVE_INFINITY;
  return Number(m.equity) / Number(m.mmReq);
}

export interface PreflightResult {
  ok: boolean;
  /** One line, ready to show a user. */
  message: string;
  snapshot: MarginSnapshot;
}

/**
 * The startup check, run once before the first order. Reports an empty or
 * unfunded bank as its own failure rather than letting it arrive as a stream of
 * reverts. Deliberately does NOT look at the wallet: a perp order locks from the
 * bank, and auto-pull only fires when the sender owns the order.
 */
export async function preflight(
  exchange: SomniaMarkets,
  market: PerpMarket,
  account: `0x${string}`,
  opts: { requiredUsdso?: number; linkedAccount?: boolean } = {},
): Promise<PreflightResult> {
  const snapshot = await marginSnapshot(exchange, market, account);
  const decimals = market.info.quoteDecimals;
  const human = (v: bigint) => (Number(v) / 10 ** decimals).toFixed(2);
  const required = opts.requiredUsdso ?? 0;
  const requiredRaw = BigInt(Math.max(0, Math.round(required * 10 ** decimals)));

  const topUp = "In the DreamDEX app, open Perps <-> Spot and move USDso from Spot wallet to Perps account";

  if (snapshot.equity === 0n && snapshot.unlocked === 0n) {
    return {
      ok: false,
      snapshot,
      message: opts.linkedAccount
        ? `The Perps balance of ${account} is empty, so every order would fail: perp orders lock margin ` +
          `from it, not from the account's spot wallet, and a linked bot cannot move funds. ${topUp}.`
        : `MarginBank is empty for ${account}. Deposit collateral before trading: every perp order locks ` +
          `from the bank, not from your wallet.`,
    };
  }

  if (requiredRaw > 0n && snapshot.unlocked < requiredRaw) {
    return {
      ok: false,
      snapshot,
      message:
        `MarginBank has ${human(snapshot.unlocked)} unlocked, and this configuration needs about ` +
        `${required.toFixed(2)} to open its first position. ` +
        (opts.linkedAccount ? `${topUp}, or lower the allocation.` : "Deposit more, or lower the allocation."),
    };
  }

  return {
    ok: true,
    snapshot,
    message:
      `MarginBank ready: ${human(snapshot.unlocked)} unlocked, ${human(snapshot.locked)} locked, ` +
      `equity ${human(snapshot.equity)}, status ${snapshot.status}.`,
  };
}

/**
 * The collateral an order of this notional will need, at the market's own
 * initial-margin rate. An estimate for the preflight only: the pool adds an
 * adverse mark-to-entry term a leverage calculation does not, which is why the
 * actual size still comes from `getMaxPerpOrderSize`.
 */
export function marginForNotional(notionalUsdso: number, market: PerpMarket): number {
  const imf = Number(market.info.initialMarginBps) / 10_000;
  return imf > 0 ? notionalUsdso * imf : notionalUsdso;
}

/** The account's current max leverage on a market; 0 means "never set". */
export async function maxLeverageOf(
  exchange: SomniaMarkets,
  market: PerpMarket,
  account: `0x${string}`,
): Promise<number> {
  return exchange.client.getPerpMaxLeverage({
    marginBank: market.info.marginBank,
    account,
    pool: market.info.poolAddress,
  });
}
