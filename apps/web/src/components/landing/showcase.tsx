"use client";

import { Reveal } from "@/components/ui/motion";
import { Section, SectionHead } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";
import { usd } from "@/lib/format";
import { cn } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/** A compact, self-consistent performance table. Every row reconciles with the
 *  PnL aggregate shown in the summary bar. */
const CLOSED = [
  { market: "BTC-PERP", side: "long", lev: 3, pnl: 186.4, held: "4h 12m", why: "take-profit" },
  { market: "ETH-PERP", side: "short", lev: 2, pnl: 72.9, held: "3h 05m", why: "take-profit" },
  { market: "SOL-PERP", side: "long", lev: 2, pnl: -42.8, held: "1h 48m", why: "stop-loss" },
  { market: "BTC-PERP", side: "short", lev: 2, pnl: 58.3, held: "2h 31m", why: "take-profit" },
  { market: "SOL-PERP", side: "short", lev: 2, pnl: 24.1, held: "3h 54m", why: "signal-flip" },
];

export function Showcase() {
  const realized = CLOSED.reduce((s, r) => s + r.pnl, 0);
  const wins = CLOSED.filter((r) => r.pnl > 0).length;

  return (
    <Section id="showcase" className="border-t border-line">
      <SectionHead
        index="03"
        eyebrow="Selected output"
        title="What the journal actually records"
        lede="Every fill, every refusal, and the reason for it. This is the same data the dashboard renders, and it is append-only and hash-chained, so a line cannot be edited after the fact."
      />

      <Reveal>
        <div className="card bevel mt-12 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-wide text-mute">
                agent 41 · trend-rider · BTC-PERP, ETH-PERP
              </span>
              <Badge tone="long">running</Badge>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="eyebrow">realized · 30d</div>
                <div className="tnum text-sm font-semibold text-long">
                  {usd(realized, { sign: true })}
                </div>
              </div>
              <div>
                <div className="eyebrow">win rate</div>
                <div className="tnum text-sm font-semibold text-chalk">
                  {Math.round((wins / CLOSED.length) * 100)}%
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Market", "Side", "Lev", "Held", "Exit", "Realized"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 font-mono text-[10.5px] font-medium tracking-wider text-dim uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLOSED.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-6 py-3.5 font-mono text-[12.5px] text-chalk">
                      {r.market}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          "font-mono text-[11px] tracking-wide uppercase",
                          r.side === "long" ? "text-long" : "text-short",
                        )}
                      >
                        {r.side}
                      </span>
                    </td>
                    <td className="tnum px-6 py-3.5 text-[12.5px] text-mute">{r.lev}×</td>
                    <td className="tnum px-6 py-3.5 text-[12.5px] text-dim">{r.held}</td>
                    <td className="px-6 py-3.5 font-mono text-[11.5px] text-dim">{r.why}</td>
                    <td
                      className={cn(
                        "tnum px-6 py-3.5 text-[13px] font-semibold",
                        r.pnl > 0 ? "text-long" : "text-short",
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {r.pnl > 0 ? (
                          <ArrowUpRight size={13} />
                        ) : (
                          <ArrowDownRight size={13} />
                        )}
                        {usd(r.pnl, { sign: true })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
