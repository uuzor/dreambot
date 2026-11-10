// @dreampilot/risk - the deterministic layer.
//
// Two things live here: the risk engine that approves, clamps or refuses every
// proposal, and the tamper-evident journal that records what the agent decided.
// Both are pure enough to test without a network or a clock.

export {
  RiskLimitsSchema,
  evaluate,
  effectiveMaxLeverage,
  MIN_NOTIONAL_USD,
  type RiskLimits,
  type RiskContext,
  type Proposal,
  type Verdict,
} from "./limits.js";
export { Journal, hashEntry, type EntryKind, type JournalEntry } from "./journal.js";
