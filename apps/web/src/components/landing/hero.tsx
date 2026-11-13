"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, LiveDot } from "@/components/ui/badge";
import { CountUp, Marquee } from "@/components/ui/motion";
import { usd } from "@/lib/format";
import { useEffect, useState } from "react";

const TAPE = [
  "BTC-PERP  61,240.5  +1.24%",
  "ETH-PERP   3,182.4  +0.68%",
  "SOL-PERP     148.62  -0.42%",
  "XAU-PERP   4,048.81  +0.31%",
  "WTI-PERP      85.08  -1.02%",
  "XAG-PERP      51.88  +0.55%",
  "funding 10.95% APR · chain 50383 · hideki",
  "21 perp markets live on dreamDEX",
];

const LINES = [
  { t: "read", body: "BTC-PERP mark 61,240.5 · funding +10.95% APR" },
  { t: "think", body: "momentum positive, price above 20-period mean" },
  { t: "propose", body: "long 0.0074 BTC · 3× · margin $150" },
  { t: "risk", body: "approved — inside leverage, margin and daily-loss caps" },
  { t: "send", body: "filled at 61,240.5 · TP 64,800 · SL 59,400" },
];

const TONE: Record<string, string> = {
  read: "text-dim",
  think: "text-mute",
  propose: "text-accent",
  risk: "text-warn",
  send: "text-long",
};

/** The hero's right panel: the agent's own decision log, revealed one line at a
 *  time so the product reads as a running loop rather than a screenshot. */
function AgentPanel() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? LINES.length : 0);

  useEffect(() => {
    if (reduce || shown >= LINES.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 500 : 850);
    return () => clearTimeout(id);
  }, [shown, reduce]);

  return (
    <div className="card bevel relative overflow-hidden p-1.5">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LiveDot />
          <span className="font-mono text-[11px] tracking-wide text-mute">
            agent 41 · trend-rider
          </span>
        </div>
        <Badge tone="accent">live</Badge>
      </div>

      <div className="rounded-[26px] border border-line bg-ink/70 p-4">
        <div className="space-y-2.5 font-mono text-[11.5px] leading-relaxed">
          {LINES.slice(0, shown).map((l, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35 }}
              className="flex gap-3"
            >
              <span className="w-14 shrink-0 text-dim">{l.t}</span>
              <span className={TONE[l.t]}>{l.body}</span>
            </motion.div>
          ))}
          {shown < LINES.length && (
            <div className="flex gap-3">
              <span className="w-14 shrink-0 text-dim">…</span>
              <span className="inline-block h-3.5 w-1.5 animate-pulse-dot bg-accent" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[26px] bg-line">
        {[
          { k: "equity", v: usd(11_284.42) },
          { k: "open", v: "3" },
          { k: "today", v: usd(214.36, { sign: true }) },
        ].map((s) => (
          <div key={s.k} className="bg-surface px-4 py-3.5">
            <div className="eyebrow">{s.k}</div>
            <div className="tnum mt-1.5 text-[15px] font-semibold text-chalk">{s.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="atmos grain relative overflow-hidden pt-36 pb-0">
      <div className="gridlines pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-start"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="accent">
              <Zap size={10} className="shrink-0" />
              Somnia · Hideki testnet
            </Badge>
            <span className="font-mono text-[11px] text-dim">
              chain 50383 · 21 perp markets
            </span>
          </div>

          <h1 className="display mt-7 max-w-[15ch] text-[clamp(2.6rem,8vw,5.6rem)]">
            Your capital.
            <br />
            <span className="text-mute">Its strategy.</span>
            <br />
            Never its custody.
          </h1>

          <p className="mt-7 max-w-lg text-[16px] leading-relaxed text-mute sm:text-[17px]">
            Autonomous perps agents on your own DreamDEX account. The key they
            hold can trade, and can never withdraw.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/dashboard" size="lg">
              Open the dashboard
              <ArrowUpRight size={17} />
            </ButtonLink>
            <ButtonLink href="#how" variant="outline" size="lg">
              See how it works
            </ButtonLink>
          </div>
        </motion.div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-end">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { v: <CountUp to={21} />, l: "perp markets" },
              { v: <CountUp to={4} />, l: "strategies" },
              { v: <CountUp to={0} />, l: "withdrawal paths" },
            ].map((s, i) => (
              <div key={i} className="panel bevel p-5">
                <div className="display text-[clamp(1.6rem,4vw,2.4rem)] text-chalk">
                  {s.v}
                </div>
                <div className="eyebrow mt-2">{s.l}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <AgentPanel />
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 mt-16">
        <Marquee items={TAPE} />
      </div>
    </section>
  );
}
