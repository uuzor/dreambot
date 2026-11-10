// @dreampilot/somnia - DreamDEX perps adapter.
//
// A thin wrapper over @somnia-chain/markets-sdk for the perpetual markets, plus
// the trading-key operator writes the SDK does not expose. Derived from the
// dreamDEX Bot Kit (MIT, DreamDEX S.A.).

export {
  resolveConfig,
  makeChain,
  parseAddress,
  type Network,
  type SomniaConfig,
} from "./config.js";
export {
  createReadOnly,
  createTradingContext,
  tradingKeyCheck,
  linkCoverage,
  shutdown,
  type ExchangeOptions,
  type SomniaContext,
} from "./exchange.js";
export {
  createTradingKey,
  linkStatus,
  linkProblem,
  placeFor,
  cancelFor,
  reduceFor,
  TRADING_KEY_SELECTOR,
  type TradingKey,
  type LinkStatus,
} from "./operator.js";
export {
  perpMarkets,
  requireMarket,
  displayName,
  baseOf,
  toRaw,
  fromRaw,
  alignPrice,
  alignQuantity,
  sizeForNotional,
  markOf,
  liveMark,
  indexOf,
  type PerpInfo,
  type PerpMarket,
} from "./markets.js";
export {
  sizeOrder,
  placePerp,
  cancelQuietly,
  positionIn,
  closePosition,
  type WriteCtx,
  type Side,
  type SizingResult,
  type PlaceResult,
} from "./orders.js";
export {
  marginSnapshot,
  healthRatio,
  preflight,
  marginForNotional,
  maxLeverageOf,
  type MarginSnapshot,
  type PreflightResult,
} from "./margin.js";
export {
  fundingApr,
  liveFunding,
  fundingSide,
  type FundingView,
} from "./funding.js";
export {
  buildFundingPlan,
  buildWithdrawPlan,
  liveReads,
  toRawCollateral,
  type FundingPlan,
  type FundingReads,
  type WithdrawPlan,
} from "./margin-bank.js";

// Re-export the SDK pieces a strategy needs, so callers have one import surface.
export { ORDER_TYPE, type SomniaMarkets, type UnifiedMarket } from "@somnia-chain/markets-sdk";
