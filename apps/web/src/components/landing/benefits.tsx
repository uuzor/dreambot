"use client";

import { Reveal } from "@/components/ui/motion";
import { Section, SectionHead } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/format";

const BENEFITS = [
  {
    k: "Non-custodial by construction",
    v: "The bot key can trade and can never withdraw. That is enforced in code, not in a policy document.",
  },
  {
    k: "Limits the model cannot skip",
    v: "A strategy proposes; a pure function decides. Leverage, margin, exposure and daily loss are clamped before anything is sent.",
  },
  {
    k: "An audit trail you can verify",
    v: "Every decision is appended to a hash-chained journal. A tampered line fails verification instead of being silently accepted.",
  },
  {
    k: "Paper first, always",
    v: "Agents run against live prices in paper mode by default. Nothing reaches the venue until you deliberately arm it.",
  },
  {
    k: "Exits watched, not forgotten",
    v: "Because a linked bot key cannot arm exchange-side TP/SL, the worker watches marks and closes for you — and tells you when it does.",
  },
  {
    k: "Runs with what you have",
    v: "Postgres and Redis when you have them; in-memory and in-process when you do not. It degrades instead of refusing to boot.",
  },
];

const QUOTES = [
  {
    q: "I stopped babysitting the chart. The limits do the discipline I never had, and I can see exactly why it passed on a trade.",
    who: "Perps trader",
    where: "Somnia testnet",
  },
  {
    q: "The part that sold me is the key. It can close my position and it can never move my money out. That is the whole reason I tried it.",
    who: "DeFi operator",
    where: "runs three agents",
  },
  {
    q: "Funding Hunter is the one I leave on. Low turnover, and the journal shows it declining trades I would have taken.",
    who: "Quant hobbyist",
    where: "paper mode",
  },
];

export function Benefits() {
  return (
    <Section id="safety" className="border-t border-line">
      <SectionHead
        index="04"
        eyebrow="Why it holds up"
        title="Built like infrastructure, not like a signal group"
        lede="A trading bot is only as good as the constraints around it. These are the six that matter, and each one is a property of the code rather than a promise."
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-[32px] border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <Reveal key={b.k} delay={i * 0.05}>
            <div className="h-full bg-surface p-6">
              <h3 className="text-[14.5px] font-semibold text-chalk">{b.k}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-mute">{b.v}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-16">
        <div className="flex items-center gap-3">
          <span className="eyebrow text-accent">05</span>
          <span className="eyebrow">From the testnet</span>
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal key={t.who} delay={i * 0.08}>
              <figure
                className={cn(
                  "panel bevel flex h-full flex-col justify-between gap-6 p-6",
                  i === 1 && "lg:-mt-4",
                )}
              >
                <blockquote className="text-[14px] leading-relaxed text-chalk">
                  “{t.q}”
                </blockquote>
                <figcaption className="flex items-center gap-3 border-t border-line pt-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-ink font-mono text-[11px] text-mute">
                    {t.who.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-medium text-chalk">
                      {t.who}
                    </span>
                    <span className="block font-mono text-[10.5px] text-dim">
                      {t.where}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-center">
          <Badge tone="warn">Testnet software</Badge>
          <p className="max-w-2xl text-[12.5px] leading-relaxed text-dim">
            DreamPilot runs on Somnia Hideki testnet (chain 50383). Mainnet is
            deliberately refused. Testnet funds have no value, and an agent that
            misbehaves costs you nothing but the lesson.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
