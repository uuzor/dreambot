// The strategy catalogue, which is what /agents lists and /deploy selects from.

import { AiTrader } from "./ai-trader.js";
import { FundingHunter } from "./funding-hunter.js";
import { MeanReversion } from "./mean-reversion.js";
import { TrendRider } from "./trend-rider.js";
import type { Strategy } from "../strategy.js";

export interface StrategyDescriptor {
  /** The value stored on the agent row. */
  key: string;
  /** What /agents shows as the label. */
  label: string;
  description: string;
  /** Build a fresh instance. Options come from the agent's stored config. */
  build(opts?: { apiKey?: string; model?: string; thesis?: string | null }): Strategy;
}

export const STRATEGIES: StrategyDescriptor[] = [
  {
    key: "trend-rider",
    label: "Trend Rider",
    description: "Identifies momentum and trades breakouts.",
    build: () => new TrendRider(),
  },
  {
    key: "funding-hunter",
    label: "Funding Hunter",
    description: "Evaluates funding rates and holds the side that gets paid.",
    build: () => new FundingHunter(),
  },
  {
    key: "mean-reversion",
    label: "Mean Reversion",
    description: "Trades deviations from the recent average, fading stretched moves.",
    build: () => new MeanReversion(),
  },
  {
    key: "ai-trader",
    label: "AI Trader",
    description: "Reads market conditions and proposes trades inside your limits.",
    build: (opts) => new AiTrader({ apiKey: opts?.apiKey, model: opts?.model, thesis: opts?.thesis }),
  },
];

export function strategyByKey(key: string): StrategyDescriptor | undefined {
  return STRATEGIES.find((s) => s.key === key);
}

export { AiTrader, FundingHunter, MeanReversion, TrendRider };
