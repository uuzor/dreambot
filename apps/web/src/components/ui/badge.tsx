import { cn } from "@/lib/format";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "long" | "short" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "border-line-2 bg-surface-2 text-mute",
    accent: "border-accent/35 bg-accent/10 text-accent",
    long: "border-long/35 bg-long/10 text-long",
    short: "border-short/35 bg-short/10 text-short",
    warn: "border-warn/35 bg-warn/10 text-warn",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "font-mono text-[10.5px] font-medium tracking-wider uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A status dot that breathes, used for anything live. */
export function LiveDot({ tone = "long" }: { tone?: "long" | "warn" | "dim" }) {
  const color = { long: "bg-long", warn: "bg-warn", dim: "bg-dim" }[tone];
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span
        className={cn("absolute inline-flex h-full w-full rounded-full animate-pulse-dot", color)}
      />
      <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", color)} />
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "long" | "short" | "warn";
  className?: string;
}) {
  const valueTone = {
    default: "text-chalk",
    long: "text-long",
    short: "text-short",
    warn: "text-warn",
  }[tone];

  return (
    <div className={cn("panel bevel p-5", className)}>
      <div className="eyebrow">{label}</div>
      <div className={cn("tnum mt-3 text-2xl font-semibold tracking-tight", valueTone)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel gridlines flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-dim">{icon}</div>}
      <p className="text-sm font-medium text-chalk">{title}</p>
      {body && <p className="max-w-sm text-[13px] leading-relaxed text-dim">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
