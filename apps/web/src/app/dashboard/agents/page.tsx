import Link from "next/link";
import { ArrowUpRight, Bot, Plus } from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn, usd } from "@/lib/format";
import { STRATEGY_META, STATUS_TONE } from "@/lib/strategies";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const { agents } = await loadDashboard();

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-accent">Agents</span>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
            {agents.length} deployed
          </h1>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-mute">
            Each agent is a strategy bound to a market set and a set of hard limits.
            Pause one, retune its limits, or stop it entirely.
          </p>
        </div>
        <ButtonLink href="/dashboard/agents" size="sm">
          <Plus size={15} />
          Deploy an agent
        </ButtonLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((a) => {
          const meta = STRATEGY_META[a.strategy] ?? {
            label: a.strategy,
            tagline: "",
            tone: "neutral" as const,
          };
          const pnlTone =
            a.daily_pnl_usd > 0
              ? "text-long"
              : a.daily_pnl_usd < 0
                ? "text-short"
                : "text-dim";

          return (
            <Link
              key={a.id}
              href={`/dashboard/agents/${a.id}`}
              className="card bevel group p-6 transition-colors hover:border-line-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-ink text-dim">
                    <Bot size={18} />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-semibold text-chalk">{meta.label}</h2>
                    <p className="mt-0.5 font-mono text-[10.5px] text-dim">
                      agent {a.id} · {a.market}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  <ArrowUpRight
                    size={15}
                    className="text-dim transition-colors group-hover:text-chalk"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-4 gap-4 border-t border-line pt-5">
                {[
                  { k: "today", v: usd(a.daily_pnl_usd, { sign: true }), tone: pnlTone },
                  { k: "lev cap", v: `${a.max_leverage}×`, tone: "text-chalk" },
                  { k: "per trade", v: usd(a.margin_per_trade), tone: "text-chalk" },
                  {
                    k: "daily loss",
                    v: a.max_daily_loss != null ? usd(a.max_daily_loss) : "off",
                    tone: a.max_daily_loss != null ? "text-chalk" : "text-dim",
                  },
                ].map((s) => (
                  <div key={s.k}>
                    <div className="eyebrow">{s.k}</div>
                    <div className={cn("tnum mt-1.5 text-[13px] font-medium", s.tone)}>
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-1.5">
                {a.markets.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] text-dim"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
