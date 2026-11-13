import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

export function Cta() {
  return (
    <section className="relative overflow-hidden border-t border-line px-5 py-24 sm:px-8">
      <div className="atmos pointer-events-none absolute inset-0" />
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="display text-[clamp(2.2rem,6vw,4rem)]">
          Give it a strategy.
          <br />
          <span className="text-mute">Keep the keys.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-mute">
          Open the dashboard, pick an agent, and watch it reason through a live market
          in paper mode. Nothing is armed until you say so.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/dashboard" size="lg">
            Open the dashboard
            <ArrowUpRight size={17} />
          </ButtonLink>
          <ButtonLink href="#strategies" variant="outline" size="lg">
            Browse strategies
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Agents", href: "/dashboard/agents" },
      { label: "Positions", href: "/dashboard/positions" },
      { label: "Journal", href: "/dashboard/journal" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Strategies", href: "#strategies" },
      { label: "How it works", href: "#how" },
      { label: "Safety", href: "#safety" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "Risk engine", href: "#safety" },
      { label: "Deployment", href: "#how" },
      { label: "Telegram bot", href: "/dashboard/settings" },
      { label: "Somnia", href: "https://somnia.network" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-mute">
              Autonomous perps agents for DreamDEX on Somnia. Non-custodial by
              construction — the key that trades can never withdraw.
            </p>
            <p className="mt-6 font-mono text-[11px] leading-relaxed text-dim">
              chain 50383 · hideki testnet
              <br />
              not financial advice · testnet software
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((c) => (
              <div key={c.title}>
                <h3 className="eyebrow">{c.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[13px] text-mute transition-colors hover:text-chalk"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-line pt-7 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] text-dim">
            © {new Date().getFullYear()} DreamPilot
          </p>
          <p className="font-mono text-[11px] text-dim">
            built on dreamDEX · Somnia
          </p>
        </div>
      </div>
    </footer>
  );
}
