// Market resolution and unit conversion for DreamDEX perps.
//
// Adapted from the dreamDEX Bot Kit (`packages/perp-core`, MIT, DreamDEX S.A.).
// Two symbol dialects meet here: the app writes `BTC-PERP`, the SDK speaks ccxt
// where the same market is `BTC/USDso:USDso` and its `type` is `"swap"`.

import type { SomniaMarkets, UnifiedMarket } from "@somnia-chain/markets-sdk";

export interface PerpInfo {
  poolAddress: `0x${string}`;
  marginBank: `0x${string}`;
  stopRegistry: `0x${string}`;
  baseSymbol: string;
  quoteSymbol: string;
  /** Size decimals. Runs 6, 7, 8, 9, 18 and 24 across the live markets. */
  baseDecimals: number;
  quoteDecimals: number;
  /** Prices are ALWAYS 18 decimals, whatever baseDecimals is. */
  tickSize: string;
  lotSize: string;
  minQuantity: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  fundingWindowSec: number;
  fundingIntervalSec: number;
  initialMarginBps: number;
  openInterest: string;
}

export interface PerpMarket {
  /** ccxt symbol, e.g. "BTC/USDso:USDso". */
  symbol: string;
  /** App-canonical name, e.g. "BTC-PERP". */
  display: string;
  info: PerpInfo;
  market: UnifiedMarket;
}

/** "BTC/USDso:USDso" -> "BTC-PERP". */
export function displayName(symbol: string): string {
  const base = symbol.split("/")[0] ?? symbol;
  return `${base}-PERP`;
}

/** "BTC-PERP", "btc-perp", "BTC" and "BTC/USDso:USDso" all mean the same base. */
export function baseOf(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.includes("/")) return trimmed.split("/")[0] ?? trimmed;
  return trimmed.replace(/-PERP$/, "");
}

function asPerp(market: UnifiedMarket): PerpMarket {
  return {
    symbol: market.symbol,
    display: displayName(market.symbol),
    info: market.info as unknown as PerpInfo,
    market,
  };
}

/**
 * Every live perp market. Perps arrive as ccxt swaps; filtering on `"perp"`
 * returns nothing and reads as an empty exchange.
 */
export async function perpMarkets(
  exchange: SomniaMarkets,
  reload = false,
  opts: { includeHalted?: boolean } = {},
): Promise<PerpMarket[]> {
  const markets = await exchange.loadMarkets(reload);
  return Object.values(markets)
    .filter((m) => m.type === "swap" && (opts.includeHalted || m.active))
    .map(asPerp);
}

/**
 * Resolve a configured symbol to one market, throwing with the list of what IS
 * live rather than returning undefined, so a typo surfaces as itself.
 */
export async function requireMarket(
  exchange: SomniaMarkets,
  symbol: string,
  opts: { reload?: boolean; includeHalted?: boolean } = {},
): Promise<PerpMarket> {
  const wanted = baseOf(symbol);
  if (!wanted) throw new Error("PERP_SYMBOL is empty. Set it to a market such as BTC-PERP.");
  const all = await perpMarkets(exchange, opts.reload ?? false, { includeHalted: opts.includeHalted });
  const hit = all.find((m) => baseOf(m.symbol) === wanted);
  if (hit) return hit;
  const names = all.map((m) => m.display).join(", ");
  throw new Error(`"${symbol}" does not match a live perp market. Live markets: ${names || "(none)"}.`);
}

/**
 * Human number to raw units, on the grid.
 *
 * `parseUnits(x.toFixed(18), 18)` is the obvious conversion and it is wrong:
 * `(0.0888).toFixed(18)` is four wei off the tick grid, which the pool rejects.
 */
export function toRaw(human: number, decimals: number): bigint {
  const s = human.toFixed(Math.min(decimals, 9));
  const [i = "0", f = ""] = s.split(".");
  const negative = i.startsWith("-");
  const digits = (negative ? i.slice(1) : i) + f.padEnd(decimals, "0").slice(0, decimals);
  const raw = BigInt(digits || "0");
  return negative ? -raw : raw;
}

/** Raw units back to a human number, for logging only. */
export function fromRaw(raw: bigint | string, decimals: number): number {
  return Number(BigInt(raw)) / 10 ** decimals;
}

/** Align a price DOWN to the market's tick grid. */
export function alignPrice(price: bigint, info: PerpInfo): bigint {
  const tick = BigInt(info.tickSize);
  if (tick <= 0n) return price;
  return (price / tick) * tick;
}

/**
 * Align a quantity DOWN to the lot grid, returning 0n when the result is below
 * the market's minimum. A size under `minQuantity` is not a small order, it is
 * no order.
 */
export function alignQuantity(quantity: bigint, info: PerpInfo): bigint {
  const lot = BigInt(info.lotSize);
  const min = BigInt(info.minQuantity);
  const aligned = lot > 0n ? (quantity / lot) * lot : quantity;
  return aligned < min ? 0n : aligned;
}

/**
 * The size, in base units, for a USDso notional at the current mark. Notional is
 * position value, not margin posted: at 2x, a notional of 50 costs 25 in margin.
 */
export function sizeForNotional(notionalUsdso: number, info: PerpInfo, atMark?: number): bigint {
  const mark = atMark && atMark > 0 ? atMark : Number(BigInt(info.markPrice)) / 1e18;
  if (!(mark > 0)) return 0n;
  return alignQuantity(toRaw(notionalUsdso / mark, info.baseDecimals), info);
}

/**
 * The mark from the market ROW. Measured on the live testnet indexer this field
 * lags the chain by tens of minutes, so it is fine for a log line and wrong for
 * anything that prices an order or a trigger. Use {@link liveMark} for those.
 */
export function markOf(info: PerpInfo): number {
  return info.markPrice == null ? 0 : Number(BigInt(info.markPrice)) / 1e18;
}

/**
 * The mark the POOL will act on, read from the chain. This is the number every
 * trigger, liquidation and margin check is evaluated against. Returns undefined
 * while the market is un-priceable, which is a state to handle, not a failure.
 */
export async function liveMark(exchange: SomniaMarkets, market: PerpMarket): Promise<number | undefined> {
  try {
    const snapshot = await exchange.client.getPerpHealthSnapshot(market.info.poolAddress);
    if (!snapshot.priceable) return undefined;
    const raw = Number(snapshot.markPrice);
    return raw > 0 ? raw / 1e18 : undefined;
  } catch {
    return undefined;
  }
}

/** The index price as a human number. */
export function indexOf(info: PerpInfo): number {
  return info.indexPrice == null ? 0 : Number(BigInt(info.indexPrice)) / 1e18;
}
