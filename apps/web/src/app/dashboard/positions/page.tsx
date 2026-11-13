import { ArrowDownRight, ArrowUpRight, LineChart } from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { EmptyState, Stat } from "@/components/ui/badge";
import { cn, pct, price, relativeTime, usd } from "@/lib/format";

export const metadata = { title: "Positions" };

export default async function PositionsPage() {
  const { openPositions, closedPositions, pnl } = await loadDashboard();

  const notional = openPositions.reduce((s, p) => s + p.size * p.entry_price, 0);
  const margin = openPositions.reduce((s, p) => s + p.margin_usd, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div>
        <span className="eyebrow text-accent">Positions</span>
        <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
          {openPositions.length} open · {closedPositions.length} closed
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Notional" value={usd(notional)} sub={`${openPositions.length} positions`} />
        <Stat label="Margin in use" value={usd(margin)} />
        <Stat
          label="Realized · 30d"
          value={usd(pnl.realizedUsd, { sign: true })}
          tone={pnl.realizedUsd >= 0 ? "long" : "short"}
        />
        <Stat
          label="Win rate"
          value={pnl.trades > 0 ? pct((pnl.wins / pnl.trades) * 100) : "—"}
          sub={pnl.trades > 0 ? `${pnl.wins}W / ${pnl.losses}L` : undefined}
        />
      </div>

      <div className="panel bevel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold text-chalk">Open</h2>
        </div>
        {openPositions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<LineChart size={20} />}
              title="Nothing open right now"
              body="Agents open positions inside their limits. When one does, it lands here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Market", "Side", "Size", "Entry", "TP", "SL", "Lev", "Margin", "Age"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 font-mono text-[10px] font-medium tracking-wider text-dim uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {openPositions.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-line/60 last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] text-chalk">{p.market}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "font-mono text-[10.5px] tracking-wide uppercase",
                          p.side === "long" ? "text-long" : "text-short",
                        )}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-mute">{p.size}</td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-mute">
                      {price(p.entry_price)}
                    </td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-long">
                      {p.take_profit ? price(p.take_profit) : "—"}
                    </td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-short">
                      {p.stop_loss ? price(p.stop_loss) : "—"}
                    </td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-dim">{p.leverage}×</td>
                    <td className="tnum px-5 py-3.5 text-[12px] text-chalk">
                      {usd(p.margin_usd)}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[10.5px] text-dim">
                      {relativeTime(p.opened_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel bevel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold text-chalk">Closed</h2>
        </div>
        {closedPositions.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12.5px] text-dim">
            No closed positions in the window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Market", "Side", "Entry", "Reason", "Held", "Realized"].map((h) => (
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
                {closedPositions.map((p) => {
                  const win = (p.realized_pnl ?? 0) > 0;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-line/60 last:border-0 hover:bg-surface-2/50"
                    >
                      <td className="px-5 py-3.5 font-mono text-[12px] text-chalk">
                        {p.market}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "font-mono text-[10.5px] tracking-wide uppercase",
                            p.side === "long" ? "text-long" : "text-short",
                          )}
                        >
                          {p.side}
                        </span>
                      </td>
                      <td className="tnum px-5 py-3.5 text-[12px] text-mute">
                        {price(p.entry_price)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-dim">
                        {p.close_reason}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[10.5px] text-dim">
                        {p.closed_at ? relativeTime(p.closed_at) : "—"}
                      </td>
                      <td
                        className={cn(
                          "tnum px-5 py-3.5 text-[12.5px] font-semibold",
                          win ? "text-long" : "text-short",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {win ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          {usd(p.realized_pnl ?? 0, { sign: true })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
