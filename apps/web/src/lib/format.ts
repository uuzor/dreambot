import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Money in the dashboard is always signed and always two places. */
export function usd(value: number, opts: { sign?: boolean } = {}) {
  const sign = opts.sign && value > 0 ? "+" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Prices span eight orders of magnitude across the perp markets, so the
 *  precision has to follow the magnitude rather than being fixed. */
export function price(value: number) {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 1 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(value: number, opts: { sign?: boolean } = {}) {
  const sign = opts.sign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function compact(value: number) {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function relativeTime(iso: string | Date) {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const secs = Math.round((Date.now() - then.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function shortAddress(addr: string, size = 4) {
  if (addr.length <= size * 2 + 2) return addr;
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`;
}
