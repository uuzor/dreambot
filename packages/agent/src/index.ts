// @dreampilot/agent - the autonomous intelligence layer.

export type {
  Venue,
  VenuePosition,
  AccountState,
  MarketInfo,
  OpenRequest,
  CloseRequest,
  FillResult,
} from "./venue.js";
export type { Proposal, Strategy, StrategyContext } from "./strategy.js";
export { bracketAround } from "./strategy.js";
export { PaperVenue, type PriceSource } from "./paper-venue.js";
export { SomniaVenue, type LiveVenueOptions } from "./somnia-venue.js";
export { buildVenue, type BuildVenueOptions, type BuiltVenue, type LiveVenueInput } from "./factory.js";
export { runTick, watchExits, realizedPnl, limitsOf, type TickDeps, type TickOutcome, type TickNotice, type NoticeKind } from "./runner.js";
export {
  STRATEGIES,
  strategyByKey,
  TrendRider,
  FundingHunter,
  MeanReversion,
  AiTrader,
  type StrategyDescriptor,
} from "./strategies/index.js";
