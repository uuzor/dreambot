"use client";

import { Reveal } from "@/components/ui/motion";
import { Section, SectionHead } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, KeyRound, Link2, ShieldCheck, Wallet } from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Connect your account",
    body: "DreamPilot generates a bot key for you. You link its public address inside the DreamDEX app, against the account you already trade.",
    icon: Link2,
  },
  {
    n: "02",
    title: "Fund and set limits",
    body: "Deposit perps margin yourself — the app builds the transaction and your own wallet signs it. Then cap leverage, per-trade margin, total exposure and daily loss.",
    icon: Wallet,
  },
  {
    n: "03",
    title: "Deploy an agent",
    body: "Pick a strategy and the markets it may touch. The agent starts proposing trades on a schedule, and the risk engine approves, clamps or refuses each one.",
    icon: KeyRound,
  },
  {
    n: "04",
    title: "Watch and intervene",
    body: "Positions, PnL and a hash-chained journal of every decision are on the dashboard. Pause the agent, or flatten the account, whenever you want.",
    icon: ShieldCheck,
  },
];

const GUARANTEES = [
  {
    k: "Can do",
    tone: "long" as const,
    items: ["Place orders", "Cancel orders", "Reduce positions", "Read balances and markets"],
  },
  {
    k: "Cannot do",
    tone: "short" as const,
    items: ["Withdraw funds", "Transfer out", "Change ownership", "Touch another account"],
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="border-t border-line">
      <SectionHead
        index="02"
        eyebrow="How it works"
        title="Four steps, and none of them are 'send us your keys'"
        lede="The bot never holds a withdrawal path. It holds a trading key you authorise, and you can revoke it from the DreamDEX app at any time."
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-[32px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="group flex h-full flex-col bg-surface p-6 transition-colors hover:bg-surface-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-dim">{s.n}</span>
                <s.icon
                  size={17}
                  className="text-dim transition-colors group-hover:text-accent"
                />
              </div>
              <h3 className="mt-6 text-[15px] font-semibold text-chalk">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-mute">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <SectionHead
          eyebrow="The permission model"
          title={
            <>
              One key that trades.
              <br />
              <span className="text-mute">Zero keys that withdraw.</span>
            </>
          }
          lede="This is the whole design. A bot key is generated per user, encrypted at rest, and scoped so it can only ever reduce your exposure or open against margin you already hold."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {GUARANTEES.map((g) => (
            <div key={g.k} className="panel bevel p-5">
              <Badge tone={g.tone}>{g.k}</Badge>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((it) => (
                  <li key={it} className="flex items-center gap-2.5 text-[13px] text-mute">
                    <ArrowRight
                      size={12}
                      className={g.tone === "long" ? "text-long" : "text-short"}
                    />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
