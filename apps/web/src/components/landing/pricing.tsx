"use client";

import { Check } from "lucide-react";
import { Reveal } from "@/components/ui/motion";
import { Section, SectionHead } from "@/components/ui/section";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/format";

const TIERS = [
  {
    name: "Paper",
    price: "$0",
    per: "forever",
    blurb: "Run any strategy against live prices without risking a cent. The best way to see whether an agent's logic suits you.",
    cta: "Start in paper mode",
    href: "/dashboard",
    features: [
      "All four strategies",
      "Live market data, simulated fills",
      "Full risk engine and journal",
      "One agent, unlimited restarts",
    ],
  },
  {
    name: "Pilot",
    price: "$0",
    per: "testnet",
    blurb: "Arm an agent against your own DreamDEX account on Hideki. Real execution, testnet collateral, no custody.",
    cta: "Connect an account",
    href: "/dashboard",
    highlight: true,
    features: [
      "Everything in Paper",
      "Real orders on Somnia testnet",
      "Up to five concurrent agents",
      "Telegram notifications on fills and refusals",
      "Per-user risk limits and kill switch",
    ],
  },
  {
    name: "Desk",
    price: "Soon",
    per: "self-host",
    blurb: "For teams that want the worker inside their own perimeter. Same image, your Postgres, your journals.",
    cta: "Read the docs",
    href: "#faq",
    features: [
      "Everything in Pilot",
      "Docker Compose deployment",
      "Bring your own Postgres and Redis",
      "Journal files stay on your disk",
    ],
  },
];

const FAQS = [
  {
    q: "Can DreamPilot move my funds?",
    a: "No. The bot key is scoped to placing, cancelling and reducing orders. There is no withdrawal or transfer path in the codebase, and the funding commands only build unsigned transactions for your own wallet to sign.",
  },
  {
    q: "What happens if the worker stops?",
    a: "Open positions stay open. Because a linked bot key cannot arm exchange-side take-profit or stop-loss orders, exits are watched by the worker — so if it is down, your TP/SL levels are not being enforced. Restart it, or close manually in the DreamDEX app.",
  },
  {
    q: "Does an agent trade without asking?",
    a: "Yes, that is the point of an autonomous agent — but only inside limits you set, and only once you have explicitly deployed it. New agents start paused. You can pause or flatten at any time.",
  },
  {
    q: "Which network does this run on?",
    a: "Somnia Hideki testnet, chain id 50383. The bot kit's older spot configuration points at Shannon (50312); DreamPilot configures the perps environment explicitly and never reuses that.",
  },
  {
    q: "What is the hash-chained journal for?",
    a: "Every entry commits to the hash of the one before it. If a line is altered after the fact, verification fails and the journal refuses to open rather than silently accepting the edit. It is an audit trail you can check, not just read.",
  },
  {
    q: "Do I need Postgres or Redis?",
    a: "No. With DATABASE_URL and REDIS_URL set you get durable storage and a queue that survives restarts. Without them it falls back to an in-memory store and an in-process scheduler, which is fine for a first run.",
  },
];

export function Pricing() {
  return (
    <Section id="pricing" className="border-t border-line">
      <SectionHead
        index="06"
        eyebrow="Pricing"
        title="Free while it is testnet"
        lede="There is nothing to charge for yet, and charging for testnet trades would be strange. Pick the mode that matches how much risk you want to take."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {TIERS.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.07}>
            <div
              className={cn(
                "flex h-full flex-col rounded-[32px] border p-7",
                t.highlight
                  ? "border-accent/40 bg-surface-2"
                  : "border-line bg-surface",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold text-chalk">{t.name}</h3>
                {t.highlight && <Badge tone="accent">recommended</Badge>}
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="display text-4xl text-chalk">{t.price}</span>
                <span className="font-mono text-[11px] text-dim">/ {t.per}</span>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-mute">{t.blurb}</p>

              <ul className="mt-7 flex-1 space-y-3 border-t border-line pt-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-mute">
                    <Check size={14} className="mt-0.5 shrink-0 text-long" />
                    {f}
                  </li>
                ))}
              </ul>

              <ButtonLink
                href={t.href}
                variant={t.highlight ? "primary" : "outline"}
                size="md"
                className="mt-7 w-full"
              >
                {t.cta}
              </ButtonLink>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,340px)_1fr]">
        <SectionHead index="07" eyebrow="FAQ" title="The questions that matter" />

        <div className="divide-y divide-line border-y border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 transition-colors hover:text-chalk">
                <span className="text-[14.5px] font-medium text-chalk">{f.q}</span>
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-2 text-dim transition-transform duration-300 group-open:rotate-45">
                  <span className="text-[13px] leading-none">+</span>
                </span>
              </summary>
              <p className="max-w-2xl pb-6 text-[13.5px] leading-relaxed text-mute">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
