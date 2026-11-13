import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldHalf, Sparkles, Target, Wallet } from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { Badge, Stat } from "@/components/ui/badge";
import { AgentControls } from "@/components/shell/agent-controls";
import { JournalTable } from "@/components/shell/journal-table";
import { cn, price, usd } from "@/lib/format";
import { STRATEGY_META, STATUS_TONE } from "@/lib/strategies";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadDashboard();
  const agent = data.agents.find((a) => String(a.id) === id);
  if (!agent) notFound();

  const meta = STRATEGY_META[agent.strategy] ?? {
    label: agent.strategy,
    tagline: "",
    tone: "neutral" as const,
  };
  const positions = data.openPositions.filter((p) => p.agent_id === agent.id);
  const margin = positions.reduce((s, p) => s + p.margin_usd, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-2 font-mono text-[11px] text-dim transition-colors hover:text-chalk"
      >
        <ArrowLeft size={13} />
        all agents
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="eyebrow text-accent">agent {agent.id}</span>
            <Badge tone={STATUS_TONE[agent.status]}>{agent.status}</Badge>
          </div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
            {meta.label}
          </h1>
          <p className="mt-2 font-mono text-[11.5px] text-dim">
            {meta.tagline} · {agent.market} · {agent.markets.length} markets
          </p>
        </div>
        <AgentControls
          agentId={agent.id}
          status={agent.status}
          canControl={data.signedIn}
        />
      </div>

      {agent.thesis && (
        <div className="panel bevel flex items-start gap-3 p-5">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <div className="eyebrow">Thesis</div>
            <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-mute">
              {agent.thesis}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today"
          value={usd(agent.daily_pnl_usd, { sign: true })}
          tone={agent.daily_pnl_usd >= 0 ? "long" : "short"}
        />
        <Stat label="Margin at work" value={usd(margin)} sub={`${positions.length} open`} />
        <Stat
          label="Daily loss cap"
          value={agent.max_daily_loss != null ? usd(agent.max_daily_loss) : "off"}
          sub={agent.max_daily_loss != null ? "refuses trades past this" : "unlimited"}
        />
        <Stat label="Total margin cap" value={usd(agent.max_total_margin)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="panel bevel p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-chalk">
            <ShieldHalf size={15} className="text-accent" />
            Limits
          </h2>
          <dl className="mt-5 divide-y divide-line">
            {[
              { k: "Leverage cap", v: `${agent.max_leverage}×` },
              { k: "Margin per trade", v: usd(agent.margin_per_trade) },
              { k: "Max total margin", v: usd(agent.max_total_margin) },
              { k: "Max open positions", v: String(agent.max_open_positions) },
              {
                k: "Daily loss cap",
                v: agent.max_daily_loss != null ? usd(agent.max_daily_loss) : "off",
              },
              { k: "Journal", v: agent.journal_path },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[12.5px] text-mute">{r.k}</dt>
                <dd className="tnum font-mono text-[12px] text-chalk">{r.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 border-t border-line pt-5">
            <div className="eyebrow flex items-center gap-2">
              <Target size={11} /> Markets
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {agent.markets.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-line bg-ink px-2.5 py-1 font-mono text-[10.5px] text-mute"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="panel bevel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-chalk">
              <Wallet size={15} className="text-accent" />
              Open positions
            </h2>
            <span className="font-mono text-[10.5px] text-dim">
              {positions.length} of {agent.max_open_positions}
            </span>
          </div>

          {positions.length === 0 ? (
            <p className="px-5 py-10 text-center text-[12.5px] text-dim">
              No open positions for this agent.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {positions.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <span
                    className={cn(
                      "font-mono text-[10.5px] tracking-wide uppercase",
                      p.side === "long" ? "text-long" : "text-short",
                    )}
                  >
                    {p.side}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-chalk">{p.market}</span>
                    <span className="block font-mono text-[10.5px] text-dim">
                      entry {price(p.entry_price)} · {p.leverage}×
                    </span>
                  </span>
                  <span className="tnum text-right">
                    <span className="block text-[12.5px] text-chalk">
                      {usd(p.margin_usd)}
                    </span>
                    <span className="block font-mono text-[10.5px] text-dim">
                      TP {p.take_profit ? price(p.take_profit) : "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-chalk">Decision journal</h2>
        <p className="mt-1 mb-4 text-[12.5px] text-mute">
          Append-only and hash-chained. Each line commits to the hash of the one before.
        </p>
        <JournalTable lines={data.journal} />
      </div>
    </div>
  );
}
