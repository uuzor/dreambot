import { AlertTriangle, ShieldHalf } from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { Badge, Stat } from "@/components/ui/badge";
import { RiskLimitsForm } from "@/components/shell/risk-limits-form";
import { cn, usd } from "@/lib/format";
import { STRATEGY_META, STATUS_TONE } from "@/lib/strategies";

export const metadata = { title: "Risk" };

export default async function RiskPage() {
  const { agents, openPositions, pnl } = await loadDashboard();

  const exposure = openPositions.reduce((s, p) => s + p.size * p.entry_price, 0);
  const margin = openPositions.reduce((s, p) => s + p.margin_usd, 0);
  const dailyLoss = agents.reduce((s, a) => s + Math.min(0, a.daily_pnl_usd), 0);
  const breached = agents.filter(
    (a) => a.max_daily_loss != null && a.daily_pnl_usd <= -a.max_daily_loss,
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div>
        <span className="eyebrow text-accent">Risk</span>
        <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
          The limits are the product
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-mute">
          A strategy proposes; this engine decides. Leverage, margin, exposure and
          daily loss are checked in code before any order leaves the process, and a
          refusal is journalled just like a fill.
        </p>
      </div>

      {breached.length > 0 && (
        <div className="panel bevel flex items-start gap-3 border-short/40 bg-short/5 p-5">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-short" />
          <div>
            <p className="text-[13.5px] font-medium text-chalk">
              Daily loss cap breached on {breached.length} agent
              {breached.length > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-[12.5px] text-mute">
              {breached.map((a) => STRATEGY_META[a.strategy]?.label ?? a.strategy).join(", ")}
              {" "}— new positions are refused until the window rolls over.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Notional exposure" value={usd(exposure)} sub={`${openPositions.length} positions`} />
        <Stat label="Margin committed" value={usd(margin)} />
        <Stat
          label="Daily loss so far"
          value={usd(dailyLoss, { sign: true })}
          tone={dailyLoss < 0 ? "short" : "default"}
        />
        <Stat
          label="Caps breached"
          value={String(breached.length)}
          tone={breached.length > 0 ? "short" : "long"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="panel bevel p-6">
          <div className="flex items-center gap-2">
            <ShieldHalf size={16} className="text-accent" />
            <h2 className="text-[14px] font-semibold text-chalk">Global limits</h2>
          </div>
          <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-mute">
            These apply to every agent on the account. Per-agent caps tighten them;
            they can never loosen them.
          </p>
          <div className="mt-6">
            <RiskLimitsForm />
          </div>
        </div>

        <div className="panel bevel overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold text-chalk">Per-agent caps</h2>
          </div>
          <ul className="divide-y divide-line">
            {agents.map((a) => {
              const meta = STRATEGY_META[a.strategy];
              const lossRatio =
                a.max_daily_loss != null && a.daily_pnl_usd < 0
                  ? Math.min(1, Math.abs(a.daily_pnl_usd) / a.max_daily_loss)
                  : 0;
              return (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium text-chalk">
                      {meta?.label ?? a.strategy}
                    </span>
                    <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { k: "lev", v: `${a.max_leverage}×` },
                      { k: "per trade", v: usd(a.margin_per_trade) },
                      {
                        k: "loss cap",
                        v: a.max_daily_loss != null ? usd(a.max_daily_loss) : "off",
                      },
                    ].map((s) => (
                      <div key={s.k}>
                        <div className="eyebrow">{s.k}</div>
                        <div className="tnum mt-1 text-[12px] text-mute">{s.v}</div>
                      </div>
                    ))}
                  </div>
                  {a.max_daily_loss != null && (
                    <div className="mt-3">
                      <div className="h-1 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            lossRatio > 0.8
                              ? "bg-short"
                              : lossRatio > 0.4
                                ? "bg-warn"
                                : "bg-long",
                          )}
                          style={{ width: `${Math.max(lossRatio * 100, 2)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] text-dim">
                        {Math.round(lossRatio * 100)}% of daily loss cap used
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
