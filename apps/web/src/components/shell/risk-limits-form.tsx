"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, usd } from "@/lib/format";

export interface Limits {
  maxLeverage: number;
  marginPerTrade: number;
  maxTotalMargin: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
}

const FIELDS: Array<{
  key: keyof Limits;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}> = [
  {
    key: "maxLeverage",
    label: "Leverage cap",
    hint: "the risk engine clamps any proposal above this",
    min: 1,
    max: 20,
    step: 1,
    format: (v) => `${v}×`,
  },
  {
    key: "marginPerTrade",
    label: "Margin per trade",
    hint: "most a single position may commit",
    min: 10,
    max: 2_000,
    step: 10,
    format: usd,
  },
  {
    key: "maxTotalMargin",
    label: "Max total margin",
    hint: "across all open positions at once",
    min: 50,
    max: 10_000,
    step: 50,
    format: usd,
  },
  {
    key: "maxOpenPositions",
    label: "Max open positions",
    hint: "further opens are refused",
    min: 1,
    max: 10,
    step: 1,
    format: (v) => String(v),
  },
  {
    key: "maxDailyLoss",
    label: "Daily loss cap",
    hint: "once hit, new positions are refused until the day rolls",
    min: 20,
    max: 5_000,
    step: 20,
    format: usd,
  },
];

/**
 * Edit one agent's risk limits.
 *
 * Limits live per agent in the store, so this posts to the authenticated limits
 * route for a specific agent rather than pretending to be an account-wide
 * setting. The route revalidates every number with the same schema the engine
 * uses, so the UI is a convenience, not the guard.
 */
export function RiskLimitsForm({
  agentId,
  initial,
  canEdit,
}: {
  agentId: number;
  initial: Limits;
  /** False when the visitor is not signed in: the sliders are shown but inert. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [limits, setLimits] = useState<Limits>(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dirty = FIELDS.some((f) => limits[f.key] !== initial[f.key]);

  function set(key: keyof Limits, value: number) {
    setLimits((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/agents/limits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, ...limits }),
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

  const disabled = !canEdit || busy;

  return (
    <form onSubmit={submit} className="space-y-6">
      {FIELDS.map((f) => {
        const value = limits[f.key];
        return (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor={`${agentId}-${f.key}`} className="text-[12.5px] font-medium text-chalk">
                {f.label}
              </label>
              <span className="tnum font-mono text-[12.5px] text-accent">{f.format(value)}</span>
            </div>

            <input
              id={`${agentId}-${f.key}`}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={value}
              disabled={disabled}
              onChange={(e) => set(f.key, Number(e.target.value))}
              className={cn(
                "mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-line",
                "accent-[#0099ff] disabled:opacity-50",
              )}
            />

            <p className="mt-2 text-[11.5px] leading-relaxed text-dim">{f.hint}</p>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" size="sm" disabled={disabled || !dirty}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Saving…" : "Save limits"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setLimits(initial);
            setResult(null);
          }}
        >
          <RotateCcw size={13} />
          Reset
        </Button>
        {!canEdit && <span className="font-mono text-[10.5px] text-warn">sign in to edit</span>}
        {canEdit && dirty && <span className="font-mono text-[10.5px] text-warn">unsaved changes</span>}
      </div>

      {result && (
        <p className={cn("text-[12px]", result.ok ? "text-long" : "text-warn")}>{result.message}</p>
      )}
    </form>
  );
}
