// Paper venue, adapted from Perpad (MIT, nirholas).
//
// Prices are real, read from a live venue's market feed; fills, fees and
// liquidations are modelled locally. No orders ever leave the machine. This is
// what a user gets when the operator has AGENTS_DRY_RUN=true, and what the tests
// run against.

import type { AccountState, CloseRequest, FillResult, MarketInfo, OpenRequest, Venue, VenuePosition } from "./venue.js";

export interface PriceSource {
  markets(markets: string[]): Promise<MarketInfo[]>;
}

/** Taker fee, as a fraction of notional. */
const TAKER_FEE = 0.00045;

interface OpenPosition extends VenuePosition {
  openedAt: number;
}

export class PaperVenue implements Venue {
  readonly mode = "paper" as const;
  private cash: number;
  private pnlToday = 0;
  private readonly positions = new Map<string, OpenPosition>();

  constructor(private readonly prices: PriceSource, startingUsd: number) {
    this.cash = startingUsd;
  }

  async markets(markets: string[]): Promise<MarketInfo[]> {
    return this.prices.markets(markets);
  }

  private async px(market: string): Promise<MarketInfo> {
    const m = (await this.prices.markets([market]))[0];
    if (!m || m.markPx === null) throw new Error(`unknown or un-priceable market ${market}`);
    return m;
  }

  async account(): Promise<AccountState> {
    const positions: VenuePosition[] = [];
    for (const p of this.positions.values()) {
      const m = await this.px(p.market).catch(() => undefined);
      if (!m || m.markPx === null) {
        positions.push(p);
        continue;
      }
      // Liquidate a position the mark has run past, the way the venue would.
      if (p.liquidationPx !== null && (p.side === "long" ? m.markPx <= p.liquidationPx : m.markPx >= p.liquidationPx)) {
        this.positions.delete(p.market);
        this.pnlToday -= p.marginUsd;
        continue;
      }
      const dir = p.side === "long" ? 1 : -1;
      positions.push({ ...p, unrealizedPnlUsd: dir * (m.markPx - p.entryPrice) * p.size });
    }
    const margin = positions.reduce((s, p) => s + p.marginUsd, 0);
    const upnl = positions.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
    return {
      equityUsd: this.cash + margin + upnl,
      availableUsd: Math.max(0, this.cash),
      positions,
      dailyPnlUsd: this.pnlToday,
    };
  }

  async open(req: OpenRequest): Promise<FillResult> {
    if (this.positions.has(req.market)) throw new Error(`${req.market} position already open`);
    const m = await this.px(req.market);
    if (m.markPx === null) throw new Error(`${req.market} is un-priceable`);
    if (req.marginUsd > this.cash) throw new Error("insufficient paper balance");

    const size = (req.marginUsd * req.leverage) / m.markPx;
    const fee = size * m.markPx * TAKER_FEE;
    const dir = req.side === "long" ? 1 : -1;
    const maintenance = 1 / (2 * Math.max(1, m.maxLeverage));
    const liquidationPx = m.markPx * (1 - dir * Math.max(0, 1 / req.leverage - maintenance));

    this.cash -= req.marginUsd + fee;
    this.pnlToday -= fee;
    this.positions.set(req.market, {
      market: req.market,
      side: req.side,
      size,
      entryPrice: m.markPx,
      leverage: req.leverage,
      marginUsd: req.marginUsd,
      unrealizedPnlUsd: 0,
      liquidationPx,
      openedAt: Date.now(),
    });
    return { market: req.market, side: req.side, action: "open", size, avgPx: m.markPx };
  }

  async close(req: CloseRequest): Promise<FillResult> {
    const p = this.positions.get(req.market);
    if (!p) throw new Error(`no open ${req.market} position`);
    const m = await this.px(req.market);
    if (m.markPx === null) throw new Error(`${req.market} is un-priceable`);

    const fraction = Math.min(1, Math.max(0, req.fraction));
    const dir = p.side === "long" ? 1 : -1;
    const closedSize = p.size * fraction;
    const realized = dir * (m.markPx - p.entryPrice) * closedSize;
    const fee = closedSize * m.markPx * TAKER_FEE;
    const releasedMargin = p.marginUsd * fraction;

    this.cash += releasedMargin + realized - fee;
    this.pnlToday += realized - fee;

    if (fraction >= 1) this.positions.delete(req.market);
    else {
      p.size -= closedSize;
      p.marginUsd -= releasedMargin;
    }
    return { market: req.market, side: p.side, action: "close", size: closedSize, avgPx: m.markPx };
  }
}
