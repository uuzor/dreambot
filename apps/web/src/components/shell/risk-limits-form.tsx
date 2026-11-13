"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, usd } from "@/lib/format";

interface Limits {
  maxLeverage: number;
  marginPerTrade: number;
  maxTotalMargin: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
}

const DEFAULTS: Limits = {
  maxLeverage: 3,
  marginPerTrade: 150,
  maxTotalMargin: 600,
  maxOpenPositions: 2,
  maxDailyLoss: 180,
};

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

export function RiskLimitsForm() {
  const [limits, setLimits] = useState<Limits>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  const dirty = FIELDS.some((f) => limits[f.key] !== DEFAULTS[f.key]);

  function set(key: keyof Limits, value: number) {
    setLimits((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
      className="space-y-6"
    >
      {FIELDS.map((f) => {
        const value = limits[f.key];
        return (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-4">
              <label
                htmlFor={f.key}
                className="text-[12.5px] font-medium text-chalk"
              >
                {f.label}
              </label>
              <span className="tnum font-mono text-[12.5px] text-accent">
                {f.format(value)}
              </span>
            </div>

            <input
              id={f.key}
              type="range"
              min={f.min}
              max={f.max}
              step={f.step}
              value={value}
              onChange={(e) => set(f.key, Number(e.target.value))}
              className={cn(
                "mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-line",
                "accent-[#0099ff]",
              )}
            />

            <p className="mt-2 text-[11.5px] leading-relaxed text-dim">{f.hint}</p>
          </div>
        );
      })}

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <Button type="submit" size="sm" disabled={!dirty}>
          <Save size={14} />
          {saved && !dirty ? "Saved" : "Save limits"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setLimits(DEFAULTS);
            setSaved(false);
          }}
        >
          <RotateCcw size={13} />
          Reset
        </Button>
        {dirty && (
          <span className="font-mono text-[10.5px] text-warn">
            unsaved changes
          </span>
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-dim">
        Saving here tightens the account-wide ceiling. Each agent&apos;s own caps are
        clamped to it, so a strategy can never propose past what you set.
      </p>
    </form>
  );
}
