"use client";

import { Reveal } from "@/components/ui/motion";
import { Section, SectionHead } from "@/components/ui/section";
import { KeyRound, Link2, ShieldCheck, Wallet } from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Connect your account",
    body: "DreamPilot generates a bot key. You link its public address in DreamDEX.",
    icon: Link2,
  },
  {
    n: "02",
    title: "Fund and set limits",
    body: "Deposit margin yourself — your own wallet signs. Cap leverage, margin and daily loss.",
    icon: Wallet,
  },
  {
    n: "03",
    title: "Deploy an agent",
    body: "Pick a strategy and its markets. The risk engine approves, clamps or refuses each proposal.",
    icon: KeyRound,
  },
  {
    n: "04",
    title: "Watch and intervene",
    body: "Positions, PnL and a hash-chained journal. Pause or flatten whenever you want.",
    icon: ShieldCheck,
  },
];

export function HowItWorks() {
  return (
    <Section id="how" className="border-t border-line">
      <SectionHead
        index="02"
        eyebrow="How it works"
        title="Four steps, and none of them are 'send us your keys'"
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-[32px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="group flex h-full flex-col bg-surface p-6 transition-colors hover:bg-surface-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-dim">{s.n}</span>
                <s.icon size={17} className="text-dim transition-colors group-hover:text-accent" />
              </div>
              <h3 className="mt-6 text-[15px] font-semibold text-chalk">{s.title}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-mute">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
