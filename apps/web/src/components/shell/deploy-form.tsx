"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, usd } from "@/lib/format";

interface Strategy {
  key: string;
  label: string;
  description: string;
}

const FIELDS = [
  { key: "maxLeverage", label: "Leverage cap", min: 1, max: 20, step: 1, format: (v: number) => `${v}×` },
  { key: "marginPerTrade", label: "Margin per trade", min: 10, max: 2_000, step: 10, format: usd },
  { key: "maxTotalMargin", label: "Max total margin", min: 50, max: 10_000, step: 50, format: usd },
  { key: "maxOpenPositions", label: "Max open positions", min: 1, max: 10, step: 1, format: (v: number) => String(v) },
  { key: "maxDailyLoss", label: "Daily loss cap", min: 20, max: 5_000, step: 20, format: usd },
] as const;

type Limits = Record<(typeof FIELDS)[number]["key"], number>;

const DEFAULT_LIMITS: Limits = {
  maxLeverage: 2,
  marginPerTrade: 25,
  maxTotalMargin: 100,
  maxOpenPositions: 1,
  maxDailyLoss: 25,
};

/**
 * Create and launch an agent from the dashboard.
 *
 * This is the browser's `/deploy`. It posts to an authenticated route that runs
 * the same operation the bot does, so the limits a user sets here are enforced by
 * the same risk engine. `markets` comes from the live exchange listing, so a user
 * cannot pick a market that does not exist.
 */
export function DeployForm({
  strategies,
  markets,
  disabledReason,
}: {
  strategies: Strategy[];
  markets: string[];
  /** Set when deployment is not possible yet; disables the form with the reason. */
  disabledReason: string | null;
}) {
  const router = useRouter();
  const [strategy, setStrategy] = useState(strategies[0]?.key ?? "");
  const [market, setMarket] = useState(markets[0] ?? "");
  const [thesis, setThesis] = useState("");
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const disabled = busy || disabledReason !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/agents/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ strategy, market, thesis, limits }),
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      setResult(data);
      if (data.ok) router.refresh();
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel bevel space-y-7 p-6">
      <div>
        <div className="eyebrow">Strategy</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {strategies.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStrategy(s.key)}
              disabled={disabled}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
                strategy === s.key
                  ? "border-accent/50 bg-accent/8"
                  : "border-line bg-surface/50 hover:border-line-2",
              )}
            >
              <div className="text-[13px] font-medium text-chalk">{s.label}</div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-dim">{s.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="market" className="eyebrow">
          Market
        </label>
        <select
          id="market"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          disabled={disabled}
          className="mt-3 h-11 w-full rounded-2xl border border-line bg-surface px-3.5 font-mono text-[12.5px] text-chalk focus:border-line-2 focus:outline-none disabled:opacity-50"
        >
          {markets.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        <div className="eyebrow">Risk limits</div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor={f.key} className="text-[12.5px] font-medium text-chalk">
                {f.label}
              </label>
              <span className="tnum font-mono text-[12.5px] text-accent">{f.format(limits[f.key])}</span>
            </div>
            <input
              id={f.key}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={limits[f.key]}
              disabled={disabled}
              onChange={(e) => setLimits((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
              className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-[#0099ff] disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="thesis" className="eyebrow">
          Guidance (optional)
        </label>
        <textarea
          id="thesis"
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="e.g. trade conservatively, avoid the Asian session"
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[12.5px] text-chalk placeholder:text-dim focus:border-line-2 focus:outline-none disabled:opacity-50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" disabled={disabled}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
          {busy ? "Deploying…" : "Create and launch"}
        </Button>
        {disabledReason && <span className="text-[11.5px] text-warn">{disabledReason}</span>}
      </div>

      {result && (
        <p className={cn("text-[12.5px]", result.ok ? "text-long" : "text-warn")}>{result.message}</p>
      )}
    </form>
  );
}
