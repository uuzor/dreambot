// The trading-venue contract, from Perpad (MIT, nirholas).
//
// A strategy reads markets and account state through this, and proposes orders
// through it. Keeping the interface narrow is what makes the same strategy run
// against live Somnia and against a paper simulator with no change.

export interface VenuePosition {
  market: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  leverage: number;
  marginUsd: number;
  unrealizedPnlUsd: number;
  /** Null when the venue cannot report one yet. */
  liquidationPx: number | null;
}

export interface AccountState {
  /** Collateral plus unrealised PnL, in USDso. */
  equityUsd: number;
  /** Collateral that is not backing anything, in USDso. */
  availableUsd: number;
  positions: VenuePosition[];
  /** Realized PnL since 00:00 UTC, fees included. */
  dailyPnlUsd: number;
}

export interface MarketInfo {
  /** App-canonical name, e.g. "BTC-PERP". */
  market: string;
  /** The mark the pool acts on, or null while the market is un-priceable. */
  markPx: number | null;
  /** Best bid and ask, or null when the book is empty. */
  bid: number | null;
  ask: number | null;
  maxLeverage: number;
  /** Annualised funding as a fraction. Positive means longs pay shorts. */
  fundingApr: number;
  /** Percentage move over the recent window, as a fraction. Null if unknown. */
  momentumPct: number | null;
  minQuantity: number;
  baseDecimals: number;
}

export interface OpenRequest {
  market: string;
  side: "long" | "short";
  /** Collateral to commit, already approved by the risk engine. */
  marginUsd: number;
  leverage: number;
  /** The exit the agent will watch. A linked bot cannot arm exchange stops. */
  takeProfit?: number;
  stopLoss?: number;
}

export interface CloseRequest {
  market: string;
  /** Fraction of the position to close, 0..1. */
  fraction: number;
  reason: string;
}

export interface FillResult {
  market: string;
  side: "long" | "short";
  action: "open" | "close";
  size: number;
  avgPx: number;
  /** True when the order found nothing to cross. Not an error. */
  noFill?: boolean;
  txHash?: string;
}

/** A trading venue. The live Somnia venue and the paper simulator both implement it. */
export interface Venue {
  readonly mode: "live" | "paper";
  markets(markets: string[]): Promise<MarketInfo[]>;
  account(): Promise<AccountState>;
  open(req: OpenRequest): Promise<FillResult>;
  close(req: CloseRequest): Promise<FillResult>;
}
