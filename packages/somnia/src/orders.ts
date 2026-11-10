// Order placement, sizing and the DRY_RUN seam.
//
// Adapted from the dreamDEX Bot Kit (`packages/perp-core/orders.ts`, MIT).
//
// Sizing never happens locally. `getMaxPerpOrderSize` applies the pool's own
// rule, including the adverse mark-to-entry term that an equity-and-leverage
// calculation drops, and it names what capped the size. A second implementation
// here would return sizes the pool then rejects.

import { ORDER_TYPE, type SomniaMarkets } from "@somnia-chain/markets-sdk";
import { formatUnits } from "viem";
import { alignPrice, alignQuantity, type PerpMarket } from "./markets.js";
import { cancelFor, placeFor, type TradingKey } from "./operator.js";

/** What an order write needs: the exchange, DRY_RUN, and the trading key when there is one. */
export interface WriteCtx {
  exchange: SomniaMarkets;
  dryRun: boolean;
  tradingKey?: TradingKey;
}

export type Side = "long" | "short";

export interface SizingRequest {
  market: PerpMarket;
  account: `0x${string}`;
  side: Side;
  /** Limit price in raw 18-decimal units, already aligned. */
  price: bigint;
  /** Desired size in raw base units; clamped to what the pool allows. */
  wanted: bigint;
  tradingKey?: TradingKey;
}

export interface SizingResult {
  ok: boolean;
  quantity: bigint;
  /** Why the ceiling is where it is. Set even when the size is placeable. */
  limitedBy?: string;
  reason?: string;
  effectiveImfBps?: bigint;
}

/**
 * Why nothing can be placed, in words a trader can act on. The gates that zero a
 * size are configuration, not a shortfall, so naming the SDK's enum leaves the
 * trader nowhere to go.
 */
function blockedReason(limitedBy: string | undefined): string {
  switch (limitedBy) {
    case "voucherBlocked":
      return (
        "this account trades on competition credit (a voucher) and this market does not accept it, " +
        "so no position can be opened or increased here. Pick a market the credit covers"
      );
    case "restricted":
      return "the market is close-only right now, so nothing may open or increase a position";
    case "isolated":
      return "isolated margin bars this market for this account while it holds a position in another one";
    default:
      return `nothing can be placed: ${limitedBy ?? "unknown limit"}`;
  }
}

/** Ask the pool how much it will accept, then clamp the request to it. */
export async function sizeOrder(exchange: SomniaMarkets, req: SizingRequest): Promise<SizingResult> {
  const { market, account, side, price, wanted } = req;
  const max = await exchange.client.getMaxPerpOrderSize({
    pool: market.info.poolAddress,
    marginBank: market.info.marginBank,
    account,
    isBid: side === "long",
    price,
    // A trading key can never auto-pull from the wallet: only an order its owner
    // sends may pull, so a linked account's margin must already be in the bank.
    autoPull: false,
  });

  if (!max.priceable) {
    return { ok: false, quantity: 0n, reason: "market is un-priceable right now (stale mark)" };
  }
  if (!max.placeable) {
    return { ok: false, quantity: 0n, limitedBy: max.limitedBy, reason: blockedReason(max.limitedBy) };
  }

  const capped = wanted < max.maxQuantity ? wanted : max.maxQuantity;
  const quantity = alignQuantity(capped, market.info);
  if (quantity === 0n) {
    return {
      ok: false,
      quantity: 0n,
      limitedBy: max.limitedBy,
      reason: `size rounds below the market minimum (minQuantity ${market.info.minQuantity})`,
    };
  }
  return { ok: true, quantity, limitedBy: max.limitedBy, effectiveImfBps: max.effectiveImfBps };
}

export interface PlaceArgs {
  ctx: WriteCtx;
  market: PerpMarket;
  side: Side;
  price: bigint;
  quantity: bigint;
  /** LIMIT rests the remainder; MARKET is immediate-or-cancel. */
  orderType?: number;
  /**
   * How far past the touch a taker may pay, in bps. Sending an IOC at exactly
   * the best offer reverts `ImmediateOrCancelNoFill` whenever that level moves
   * between the read and the send, which on a live book is often.
   */
  slippageBps?: number;
  label?: string;
}

export interface PlaceResult {
  sent: boolean;
  orderId?: bigint;
  filled: bigint;
  /** True when an IOC found nothing to cross. Not an error: the book moved. */
  noFill?: boolean;
  hash?: string;
}

/**
 * Place one perp order.
 *
 * `orderType` defaults to LIMIT, which RESTS the remainder. A caller that means
 * to cross has to say `ORDER_TYPE.MARKET`, or it quietly becomes a maker.
 */
export async function placePerp(args: PlaceArgs): Promise<PlaceResult> {
  const { ctx, market, side, quantity, label } = args;
  const orderType = args.orderType ?? ORDER_TYPE.LIMIT;
  const taker = orderType === ORDER_TYPE.MARKET || orderType === ORDER_TYPE.FILL_OR_KILL;
  const slip = BigInt(Math.max(0, Math.round(args.slippageBps ?? (taker ? 20 : 0))));
  const adjusted =
    slip === 0n
      ? args.price
      : side === "long"
        ? (args.price * (10_000n + slip)) / 10_000n
        : (args.price * (10_000n - slip)) / 10_000n;
  const price = alignPrice(adjusted, market.info);
  const human = formatUnits(quantity, market.info.baseDecimals);
  const px = formatUnits(price, 18);
  const what = `${label ?? "order"} ${side} ${human} ${market.info.baseSymbol} @ ${px}`;

  if (ctx.dryRun) {
    console.log(`[dry-run] would place ${what}`);
    return { sent: false, filled: 0n };
  }

  let res: { hash?: string; orderId?: bigint; fills?: { quantityFilled: bigint }[] };
  try {
    const order = { pool: market.info.poolAddress, isBid: side === "long", price, quantity, orderType };
    // A trading key places FOR the account; the order, its margin and its fills
    // are the account's. Same pool, same rules, same named errors.
    res = ctx.tradingKey ? await placeFor(ctx.tradingKey, order) : await ctx.exchange.trader.placePerpOrder(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // An IOC that crossed nothing is an ordinary outcome of a moving book, not a
    // fault worth stopping an agent over.
    if (message.includes("ImmediateOrCancelNoFill")) {
      console.log(`${what}: nothing crossed, the book moved. Not sent again this cycle.`);
      return { sent: true, filled: 0n, noFill: true };
    }
    // A POST_ONLY that would take reverts `PostOnlyWouldCross` rather than
    // resting: the touch moved between the read and the send.
    if (message.includes("PostOnlyWouldCross")) {
      console.log(`${what}: would cross the touch as a maker, skipped. Re-quotes next cycle.`);
      return { sent: false, filled: 0n, noFill: true };
    }
    throw err;
  }
  const filled = (res.fills ?? []).reduce((sum, f) => sum + f.quantityFilled, 0n);
  console.log(`placed ${what} | filled ${Number(filled) / 10 ** market.info.baseDecimals} | order ${res.orderId ?? "-"}`);
  return { sent: true, orderId: res.orderId, filled, hash: res.hash };
}

/** Cancel one resting order, tolerating the race where it already went away. */
export async function cancelQuietly(ctx: WriteCtx, market: PerpMarket, orderId: bigint): Promise<void> {
  if (ctx.dryRun) {
    console.log(`[dry-run] would cancel order ${orderId}`);
    return;
  }
  try {
    if (ctx.tradingKey) {
      await cancelFor(ctx.tradingKey, market.info.poolAddress, orderId);
    } else {
      await ctx.exchange.trader.cancelOrder({ pool: market.info.poolAddress, orderId });
    }
  } catch (err) {
    // An order that filled or expired between the read and the cancel is not a
    // failure of the cancel; a cascade of these means the quote is too slow.
    console.log(`cancel ${orderId} skipped: ${(err as Error).message.slice(0, 120)}`);
  }
}

/** This account's position in one market, or undefined. Positions are cross-market. */
export async function positionIn(exchange: SomniaMarkets, market: PerpMarket) {
  const all = await exchange.fetchPositions();
  return all.find((p) => p.symbol === market.symbol);
}

/**
 * Close what actually closes.
 *
 * "Close all" is clamped to the position and then aligned DOWN to the lot grid,
 * so acting on the requested size instead of `closedQuantity` leaves a remainder
 * and the next cycle tries to close a position that is already flat.
 */
export async function closePosition(
  ctx: WriteCtx,
  market: PerpMarket,
  account: `0x${string}`,
  opts: { fraction?: number; label?: string } = {},
): Promise<PlaceResult> {
  const preview = await ctx.exchange.client.previewPerpClosePnl({
    pool: market.info.poolAddress,
    marginBank: market.info.marginBank,
    account,
  });
  if (!preview.priceable) {
    // The preview needs a mark; a reducing ORDER does not. The venue keeps the
    // exit open during an oracle outage precisely so a position can be closed,
    // but this path cannot size the close without the preview, so it stops here
    // rather than guessing a quantity.
    console.log(
      "close skipped: the market is un-priceable, so the close preview has no size to act on. " +
        "Reducing orders are still accepted by the venue; close manually if this persists.",
    );
    return { sent: false, filled: 0n };
  }
  const whole = preview.closedQuantity;
  if (whole <= 0n) return { sent: false, filled: 0n };

  const fraction = Math.min(1, Math.max(0, opts.fraction ?? 1));
  const wanted =
    fraction === 1 ? whole : alignQuantity((whole * BigInt(Math.round(fraction * 1000))) / 1000n, market.info);
  if (wanted <= 0n) {
    const min = Number(BigInt(market.info.minQuantity)) / 10 ** market.info.baseDecimals;
    const size = Number(whole) / 10 ** market.info.baseDecimals;
    console.log(
      `close skipped: ${(fraction * 100).toFixed(0)}% of ${size} ${market.info.baseSymbol} is below the market ` +
        `minimum of ${min}. Close the whole position, or raise the fraction.`,
    );
    return { sent: false, filled: 0n };
  }

  const position = await positionIn(ctx.exchange, market);
  if (!position) return { sent: false, filled: 0n };

  // Reducing a long means selling, and the reverse. Reducing orders are accepted
  // even while a market is un-priceable, which is what makes the exit reachable
  // during an oracle outage.
  const side: Side = position.side === "long" ? "short" : "long";
  const book = await ctx.exchange.fetchOrderBook(market.symbol, 1);
  const touch = side === "long" ? book.asks[0]?.[0] : book.bids[0]?.[0];
  if (touch === undefined) {
    console.log("close skipped: no counterparty resting on the book");
    return { sent: false, filled: 0n };
  }
  return placePerp({
    ctx,
    market,
    side,
    price: BigInt(Math.round(touch * 1e18)),
    quantity: wanted,
    orderType: ORDER_TYPE.MARKET,
    label: opts.label ?? "close",
  });
}
