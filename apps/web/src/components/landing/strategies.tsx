"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  Brain,
  TrendingUp,
  Waves,
} from "lucide-react";
import { Section, SectionHead } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/format";

/** The four strategies, each with the exact rule the agent applies. Written as
 *  the agent's own description so the copy cannot drift from the behaviour. */
const STRATEGIES = [
  {
    id: "trend-rider",
    name: "Trend Rider",
    tagline: "Momentum breakouts",
    icon: TrendingUp,
    tone: "text-long",
    ring: "group-hover:border-long/40",
    body: "Identifies momentum and trades the breakout. Enters when price clears the recent range with volume behind it, and rides until momentum fades.",
    rules: [
      "Enters on a close above the 20-period mean",
      "Skips the trade if the move is already stretched",
      "Trails its exit as the trend extends",
    ],
  },
  {
    id: "funding-hunter",
    name: "Funding Hunter",
    tagline: "Carry and basis",
    icon: Activity,
    tone: "text-accent",
    ring: "group-hover:border-accent/40",
    body: "Evaluates funding rates and holds the side that gets paid. Patient and low-turnover: it wants to be compensated for waiting, not for predicting.",
    rules: [
      "Holds the side funding pays, when the basis agrees",
      "Avoids crowded sides near a funding flip",
      "Closes when the carry inverts",
    ],
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    tagline: "Fade the stretch",
    icon: Waves,
    tone: "text-warn",
    ring: "group-hover:border-warn/40",
    body: "Trades deviations from the market average. Buys when price is stretched below its mean and sells when it is stretched above, with a hard invalidation.",
    rules: [
      "Enters on a two-sigma deviation from the mean",
      "Hard stop when the deviation widens instead of closing",
      "Sized smaller, because the tail is fat",
    ],
  },
  {
    id: "ai-trader",
    name: "AI Trader",
    tagline: "Reads the tape",
    icon: Brain,
    tone: "text-accent-2",
    ring: "group-hover:border-accent-2/40",
    body: "Evaluates market conditions and proposes trades, with a rules-based fallback when no model is configured. Every proposal still passes the risk engine.",
    rules: [
      "Reads live prices, funding and recent volatility",
      "Proposes a side, size and invalidation",
      "Falls back to rules when no model is set",
    ],
  },
];

export function Strategies() {
  const [active, setActive] = useState(STRATEGIES[0]!.id);
  const reduce = useReducedMotion();
  const current = STRATEGIES.find((s) => s.id === active)!;

  return (
    <Section id="strategies">
      <SectionHead
        index="01"
        eyebrow="Strategies"
        title={
          <>
            Four agents. <span className="text-mute">One risk engine.</span>
          </>
        }
        lede="Each strategy proposes. None places an order directly. Every proposal passes the same deterministic limits."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="flex flex-col gap-2">
          {STRATEGIES.map((s) => {
            const on = s.id === active;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                className={cn(
                  "group flex items-center gap-4 rounded-3xl border p-4 text-left transition-all duration-300",
                  on
                    ? "border-line-2 bg-surface-2"
                    : "border-line bg-transparent hover:border-line-2 hover:bg-surface/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink transition-colors",
                    on ? s.tone : "text-dim",
                  )}
                >
                  <s.icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-chalk">{s.name}</span>
                  <span className="block truncate text-[12.5px] text-dim">{s.tagline}</span>
                </span>
                {on && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <motion.div
          key={current.id}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "card bevel group relative overflow-hidden p-7 transition-colors sm:p-9",
            current.ring,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <current.icon size={20} className={current.tone} />
                <h3 className="display text-2xl text-chalk">{current.name}</h3>
              </div>
              <p className="mt-1 font-mono text-[11px] tracking-wide text-dim">
                /{current.id}
              </p>
            </div>
            <Badge tone="neutral">{current.tagline}</Badge>
          </div>

          <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-mute">
            {current.body}
          </p>

          <div className="mt-8 border-t border-line pt-6">
            <div className="eyebrow">How it decides</div>
            <ul className="mt-4 space-y-3">
              {current.rules.map((r, i) => (
                <motion.li
                  key={r}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.07 }}
                  className="flex items-start gap-3 text-[13.5px] text-mute"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {r}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
