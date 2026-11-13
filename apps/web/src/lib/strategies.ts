/** Display metadata for the strategy ids the agent package emits. Kept in one
 *  place so the landing page and the dashboard cannot disagree about a name. */
export const STRATEGY_META: Record<
  string,
  { label: string; tagline: string; tone: "long" | "accent" | "warn" | "neutral" }
> = {
  "trend-rider": { label: "Trend Rider", tagline: "momentum breakouts", tone: "long" },
  "funding-hunter": { label: "Funding Hunter", tagline: "carry and basis", tone: "accent" },
  "mean-reversion": { label: "Mean Reversion", tagline: "fade the stretch", tone: "warn" },
  "ai-trader": { label: "AI Trader", tagline: "reads the tape", tone: "neutral" },
};

export const STATUS_TONE = {
  running: "long",
  paused: "warn",
  stopped: "neutral",
} as const;

export function strategyLabel(id: string) {
  return STRATEGY_META[id]?.label ?? id;
}
