// The live venue: DreamDEX perps on Somnia, traded through a linked bot key.
//
// This is where the three reference projects meet. The market reads, sizing and
// order writes come from the dreamDEX Bot Kit's perp-core; the account state is
// shaped the way Perpad's risk engine expects; and the exits are watched by the
// agent itself, because a linked bot key cannot arm stop orders on the user's
// account (only the account can do that).

import {
  ORDER_TYPE,
  closePosition,
  liveFunding,
  liveMark,
  marginSnapshot,
  maxLeverageOf,
  perpMarkets,
  placePerp,
  positionIn,
  requireMarket,
  sizeForNotional,
  sizeOrder,
  toRaw,
  type PerpMarket,
  type Side,
  type SomniaContext,
} from "@dreampilot/somnia";
import type { AccountState, CloseRequest, FillResult, MarketInfo, OpenRequest, Venue, VenuePosition } from "./venue.js";

/** Slippage a taker will pay past the touch, in bps. */
const TAKER_SLIPPAGE_BPS = 25;

export interface LiveVenueOptions {
  ctx: SomniaContext;
  /** The DreamDEX account every read and write is scoped to. */
  account: `0x${string}`;
  dryRun: boolean;
}

export class SomniaVenue implements Venue {
  readonly mode: "live" | "paper" = "live";
  private readonly marketCache = new Map<string, PerpMarket>();

  constructor(private readonly opts: LiveVenueOptions) {}

  private get ctx() {
    return this.opts.ctx;
  }

  private async market(name: string): Promise<PerpMarket> {
    const cached = this.marketCache.get(name);
    if (cached) return cached;
    const market = await requireMarket(this.ctx.exchange, name);
    this.marketCache.set(name, market);
    return market;
  }

  async markets(names: string[]): Promise<MarketInfo[]> {
    const out: MarketInfo[] = [];
    for (const name of names) {
      try {
        const market = await this.market(name);
        const [mark, funding, book] = await Promise.all([
          liveMark(this.ctx.exchange, market),
          liveFunding(this.ctx.exchange, market),
          this.ctx.exchange.fetchOrderBook(market.symbol, 1).catch(() => ({ bids: [], asks: [] })),
        ]);
        out.push({
          market: market.display,
          markPx: mark ?? null,
          bid: book.bids[0]?.[0] ?? null,
          ask: book.asks[0]?.[0] ?? null,
          maxLeverage: maxLeverageFor(market),
          fundingApr: funding.known ? funding.apr : 0,
          momentumPct: await this.momentum(market).catch(() => null),
          minQuantity: Number(BigInt(market.info.minQuantity)) / 10 ** market.info.baseDecimals,
          baseDecimals: market.info.baseDecimals,
        });
      } catch {
        // An unknown or delisted market is reported as absent rather than
        // failing the whole read, so one bad symbol does not blind the agent.
      }
    }
    return out;
  }

  /** Percentage move over the recent window, read from the candle feed. */
  private async momentum(market: PerpMarket): Promise<number | null> {
    const candles = await this.ctx.exchange.fetchOHLCV(market.symbol, "5m", undefined, 13);
    if (candles.length < 2) return null;
    const first = candles[0]?.[1];
    const last = candles[candles.length - 1]?.[4];
    if (!first || !last || first <= 0) return null;
    return (last - first) / first;
  }

  async account(): Promise<AccountState> {
    const positions = await this.ctx.exchange.fetchPositions();
    const markets = await perpMarkets(this.ctx.exchange);
    const byName = new Map(markets.map((m) => [m.symbol, m]));

    // Margin is cross-market, so one snapshot from any market the account trades
    // reports the whole account. Read it first: the per-position margin below is
    // derived from the account's leverage cap.
    let equityUsd = 0;
    let availableUsd = 0;
    const anchor = markets[0];
    if (anchor) {
      const snap = await marginSnapshot(this.ctx.exchange, anchor, this.opts.account);
      const scale = 10 ** anchor.info.quoteDecimals;
      equityUsd = Number(snap.equity) / scale;
      availableUsd = Number(snap.unlocked) / scale;
    }

    const out: VenuePosition[] = [];
    for (const p of positions) {
      const market = byName.get(p.symbol);
      if (!market) continue;
      const mark = p.markPrice ?? p.entryPrice;
      const leverage = await maxLeverageOf(this.ctx.exchange, market, this.opts.account).catch(() => 0);
      // The position's notional over its own leverage is the collateral backing
      // it, which is what the risk engine budgets against.
      const notional = Math.abs(p.contracts) * mark;
      const marginUsd = leverage > 0 ? notional / leverage : notional;
      out.push({
        market: market.display,
        side: p.side === "short" ? "short" : "long",
        size: Math.abs(p.contracts),
        entryPrice: p.entryPrice,
        leverage,
        marginUsd,
        unrealizedPnlUsd: p.unrealizedPnl ?? 0,
        liquidationPx: p.liquidationPrice ?? null,
      });
    }

    return {
      equityUsd,
      availableUsd,
      positions: out,
      // Realized PnL today is not derivable from the venue's position reads; the
      // runner fills it from the store, which records every close it made.
      dailyPnlUsd: 0,
    };
  }

  async open(req: OpenRequest): Promise<FillResult> {
    const market = await this.market(req.market);
    const mark = await liveMark(this.ctx.exchange, market);
    if (mark === undefined) throw new Error(`${market.display} is un-priceable right now; nothing can be opened.`);

    const book = await this.ctx.exchange.fetchOrderBook(market.symbol, 1);
    const side: Side = req.side;
    const touch = side === "long" ? book.asks[0]?.[0] : book.bids[0]?.[0];
    if (touch === undefined) throw new Error(`no counterparty resting on ${market.display}; nothing to cross.`);

    const price = toRaw(touch, 18);
    const wanted = sizeForNotional(req.marginUsd * req.leverage, market.info, mark);
    if (wanted === 0n) {
      throw new Error(
        `a ${req.marginUsd * req.leverage} USDso position is below the market minimum on ${market.display}.`,
      );
    }

    const sized = await sizeOrder(this.ctx.exchange, {
      market,
      account: this.opts.account,
      side,
      price,
      wanted,
      tradingKey: this.ctx.tradingKey,
    });
    if (!sized.ok) throw new Error(sized.reason ?? "the pool refused the size");

    const res = await placePerp({
      ctx: { exchange: this.ctx.exchange, dryRun: this.opts.dryRun, tradingKey: this.ctx.tradingKey },
      market,
      side,
      price,
      quantity: sized.quantity,
      orderType: ORDER_TYPE.MARKET,
      slippageBps: TAKER_SLIPPAGE_BPS,
      label: "open",
    });

    const size = Number(sized.quantity) / 10 ** market.info.baseDecimals;
    return {
      market: market.display,
      side,
      action: "open",
      size,
      avgPx: touch,
      noFill: res.filled === 0n && res.sent,
      txHash: res.hash,
    };
  }

  async close(req: CloseRequest): Promise<FillResult> {
    const market = await this.market(req.market);
    const position = await positionIn(this.ctx.exchange, market);
    if (!position) throw new Error(`no open ${market.display} position`);
    const side: Side = position.side === "short" ? "short" : "long";

    const res = await closePosition(
      { exchange: this.ctx.exchange, dryRun: this.opts.dryRun, tradingKey: this.ctx.tradingKey },
      market,
      this.opts.account,
      { fraction: req.fraction, label: req.reason },
    );

    const size = Number(position.contracts) * req.fraction;
    return {
      market: market.display,
      side,
      action: "close",
      size,
      avgPx: Number(position.entryPrice ?? 0),
      noFill: !res.sent,
      txHash: res.hash,
    };
  }
}

/** The exchange's own leverage ceiling, read off the initial-margin rate. */
function maxLeverageFor(market: PerpMarket): number {
  const imf = Number(market.info.initialMarginBps) / 10_000;
  return imf > 0 ? Math.floor(1 / imf) : 1;
}
