import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  Percent,
  Plus,
  ShieldHalf,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { Badge, EmptyState, LiveDot, Stat } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EquityChart } from "@/components/shell/equity-chart";
import { cn, pct, price, relativeTime, usd } from "@/lib/format";

const STRATEGY_LABEL: Record<string, string> = {
  "trend-rider": "Trend Rider",
  "funding-hunter": "Funding Hunter",
  "mean-reversion": "Mean Reversion",
  "ai-trader": "AI Trader",
};

export default async function OverviewPage() {
  const data = await loadDashboard();
  const { agents, openPositions, pnl, equity, audit } = data;

  const running = agents.filter((a) => a.status === "running").length;
  const marginInUse = openPositions.reduce((s, p) => s + p.margin_usd, 0);
  const notional = openPositions.reduce(
    (s, p) => s + p.size * p.entry_price,
    0,
  );
  const todayPnl = agents.reduce((s, a) => s + a.daily_pnl_usd, 0);
  const winRate = pnl.trades > 0 ? (pnl.wins / pnl.trades) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="eyebrow text-accent">Overview</span>
            {data.source === "live" ? (
              <span className="flex items-center gap-2 font-mono text-[10.5px] text-mute">
                <LiveDot /> live store
              </span>
            ) : (
              <Badge tone="warn">demo data</Badge>
            )}
          </div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
            Good to see you{data.user.username ? `, ${data.user.username}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/dashboard/agents" variant="outline" size="sm">
            <Bot size={15} />
            Manage agents
          </ButtonLink>
          <ButtonLink href="/dashboard/agents" size="sm">
            <Plus size={15} />
            Deploy an agent
          </ButtonLink>
        </div>
      </div>

      {!data.account && (
        <div className="panel bevel flex flex-wrap items-center justify-between gap-4 border-warn/30 bg-warn/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldHalf size={17} className="mt-0.5 text-warn" />
            <div>
              <p className="text-[13.5px] font-medium text-chalk">
                No DreamDEX account linked yet
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mute">
                Create a bot key, link its address in the DreamDEX app, then deploy an
                agent. Nothing can trade until then.
              </p>
            </div>
          </div>
          <ButtonLink href="/dashboard/settings" size="sm" variant="outline">
            Connect an account
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Realized · 30d"
          value={usd(pnl.realizedUsd, { sign: true })}
          tone={pnl.realizedUsd >= 0 ? "long" : "short"}
          sub={`${pnl.trades} closed trades`}
        />
        <Stat
          label="Today"
          value={usd(todayPnl, { sign: true })}
          tone={todayPnl >= 0 ? "long" : "short"}
          sub={`${running} of ${agents.length} agents running`}
        />
        <Stat
          label="Margin in use"
          value={usd(marginInUse)}
          sub={`${usd(notional)} notional`}
        />
        <Stat
          label="Win rate"
          value={pnl.trades > 0 ? pct(winRate) : "—"}
          sub={pnl.trades > 0 ? `${pnl.wins}W / ${pnl.losses}L` : "no closed trades yet"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel bevel p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-semibold text-chalk">Equity</h2>
              <p className="mt-0.5 text-[11.5px] text-dim">30 days, realized</p>
            </div>
            <div className="flex items-center gap-2">
              {(["1D", "1W", "1M", "ALL"] as const).map((r, i) => (
                <span
                  key={r}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-mono text-[10.5px]",
                    i === 2 ? "bg-surface-2 text-chalk" : "text-dim",
                  )}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5">
            <EquityChart data={equity} />
          </div>
        </div>

        <div className="panel bevel flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-chalk">Recent decisions</h2>
            <Link
              href="/dashboard/journal"
              className="flex items-center gap-1 font-mono text-[10.5px] text-accent"
            >
              journal <ArrowUpRight size={11} />
            </Link>
          </div>

          <ul className="mt-4 flex-1 space-y-1">
            {audit.slice(0, 6).map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-surface-2/60"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border",
                    a.status === "ok"
                      ? "border-long/30 bg-long/10 text-long"
                      : "border-warn/30 bg-warn/10 text-warn",
                  )}
                >
                  {a.status === "ok" ? (
                    <TrendingUp size={13} />
                  ) : (
                    <TrendingDown size={13} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-chalk">
                    {a.action} · {a.market}
                    {a.side ? ` · ${a.side}` : ""}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-dim">
                    {a.error ?? a.tx_hash ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-dim">
                  {relativeTime(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel bevel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold text-chalk">Open positions</h2>
            <Link
              href="/dashboard/positions"
              className="flex items-center gap-1 font-mono text-[10.5px] text-accent"
            >
              all positions <ArrowUpRight size={11} />
            </Link>
          </div>

          {openPositions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CircleDollarSign size={20} />}
                title="No open positions"
                body="When an agent opens a position it appears here with its live margin and levels."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Market", "Side", "Entry", "Size", "Lev", "Margin"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 font-mono text-[10px] font-medium tracking-wider text-dim uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openPositions.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-line/60 last:border-0 hover:bg-surface-2/50"
                    >
                      <td className="px-5 py-3 font-mono text-[12px] text-chalk">
                        {p.market}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            "font-mono text-[10.5px] tracking-wide uppercase",
                            p.side === "long" ? "text-long" : "text-short",
                          )}
                        >
                          {p.side}
                        </span>
                      </td>
                      <td className="tnum px-5 py-3 text-[12px] text-mute">
                        {price(p.entry_price)}
                      </td>
                      <td className="tnum px-5 py-3 text-[12px] text-mute">{p.size}</td>
                      <td className="tnum px-5 py-3 text-[12px] text-dim">
                        {p.leverage}×
                      </td>
                      <td className="tnum px-5 py-3 text-[12px] text-chalk">
                        {usd(p.margin_usd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel bevel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold text-chalk">Agents</h2>
            <Link
              href="/dashboard/agents"
              className="flex items-center gap-1 font-mono text-[10.5px] text-accent"
            >
              manage <ArrowUpRight size={11} />
            </Link>
          </div>

          <ul className="divide-y divide-line">
            {agents.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/agents/${a.id}`}
                  className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2/50"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      a.status === "running"
                        ? "bg-long"
                        : a.status === "paused"
                          ? "bg-warn"
                          : "bg-dim",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-chalk">
                      {STRATEGY_LABEL[a.strategy] ?? a.strategy}
                    </span>
                    <span className="block font-mono text-[10.5px] text-dim">
                      {a.market} · {a.max_leverage}× cap
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tnum shrink-0 text-[12.5px] font-medium",
                      a.daily_pnl_usd > 0
                        ? "text-long"
                        : a.daily_pnl_usd < 0
                          ? "text-short"
                          : "text-dim",
                    )}
                  >
                    {a.daily_pnl_usd !== 0
                      ? usd(a.daily_pnl_usd, { sign: true })
                      : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel bevel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <Percent size={17} className="mt-0.5 text-accent" />
          <div>
            <p className="text-[13px] font-medium text-chalk">
              Funding is the quiet cost of holding a perp
            </p>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-mute">
              Current testnet funding sits near 10.95% APR across sampled markets. The
              Funding Hunter strategy exists to be paid it rather than to pay it — but
              it is still a drag on any position held against the crowd.
            </p>
          </div>
        </div>
        <ButtonLink href="/dashboard/risk" variant="outline" size="sm">
          Review risk limits
        </ButtonLink>
      </div>
    </div>
  );
}
