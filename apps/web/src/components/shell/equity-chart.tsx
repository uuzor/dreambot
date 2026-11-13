"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityPoint } from "@/lib/types";
import { usd } from "@/lib/format";

export function EquityChart({ data }: { data: EquityPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="gridlines flex h-[240px] items-center justify-center rounded-[24px] border border-line">
        <p className="max-w-xs px-6 text-center text-[12.5px] leading-relaxed text-dim">
          The equity curve appears once this account has closed positions to chart.
        </p>
      </div>
    );
  }

  const first = data[0]?.equity ?? 0;
  const last = data[data.length - 1]?.equity ?? 0;
  const up = last >= first;

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={up ? "#22c98a" : "#ff4d6a"}
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor={up ? "#22c98a" : "#ff4d6a"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            stroke="#616169"
            fontSize={10.5}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            fontFamily="var(--font-geist-mono)"
          />
          <YAxis
            stroke="#616169"
            fontSize={10.5}
            tickLine={false}
            axisLine={false}
            width={52}
            domain={["dataMin - 120", "dataMax + 120"]}
            tickFormatter={(v: number) => `$${Math.round(v / 100) / 10}k`}
            fontFamily="var(--font-geist-mono)"
          />
          <Tooltip
            contentStyle={{
              background: "#131317",
              border: "1px solid #262629",
              borderRadius: 14,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono)",
            }}
            labelStyle={{ color: "#9898a3", fontSize: 11 }}
            formatter={(v) => [usd(Number(v)), "equity"]}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={up ? "#22c98a" : "#ff4d6a"}
            strokeWidth={1.8}
            fill="url(#equityFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
