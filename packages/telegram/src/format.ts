// Telegram-safe formatting. Everything user-supplied is escaped before it
// reaches HTML mode, so a market name or a thesis can never inject markup.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function bold(s: string): string {
  return `<b>${escapeHtml(s)}</b>`;
}

export function code(s: string): string {
  return `<code>${escapeHtml(s)}</code>`;
}

export function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `$${n.toFixed(digits)}`;
}

/** A signed USD figure, so a loss is visibly a loss. */
export function fmtSignedUsd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(digits)}`;
}

export function fmtPct(fraction: number | null | undefined, digits = 2): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "-";
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function fmtNum(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

export function shortAddr(addr: string): string {
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** A block explorer link on the Somnia Hideki testnet. */
export function explorerTx(hash: string): string {
  return `https://shannon-explorer.somnia.network/tx/${hash}`;
}
