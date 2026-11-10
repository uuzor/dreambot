// Turning a tick outcome into a message a user wants to read, and deciding
// whether to send it at all.
//
// The worker runs in its own process, so it cannot reuse the bot's polling loop
// to reach a chat. Instead the bot is constructed with `bot.init()` (identity
// only, no polling) and the worker calls `bot.api.sendMessage` directly. That
// keeps one bot token and one process tree, and needs no Redis.

import type { TickNotice } from "@dreampilot/agent";
import { bold, code, escapeHtml, fmtNum, fmtSignedUsd, fmtUsd } from "./format.js";

/** The per-user notice preferences a user sets with /notify. */
export interface NotifyPrefs {
  /** Send a message for every position the agent opens. */
  onOpen: boolean;
  /** Send a message for every position the agent closes. */
  onClose: boolean;
  /** Send a message when the risk engine refuses a proposed trade. */
  onRefuse: boolean;
}

export const DEFAULT_NOTIFY: NotifyPrefs = { onOpen: true, onClose: true, onRefuse: false };

/** The in-memory form of the persisted preference row. */
export interface NotifyState {
  lastRefusalKey: string | null;
  lastRefusalAt: number | null;
}

/** One hour, in milliseconds: the refusal de-duplication window. */
export const REFUSAL_WINDOW_MS = 60 * 60 * 1000;

export interface NoticeDecision {
  /** True when the user should be messaged about this notice. */
  send: boolean;
  /** The new state to persist, when the decision changed it. */
  state?: NotifyState;
}

/**
 * Decide whether to deliver a notice.
 *
 * Opens and closes are one-off events, so they are sent whenever enabled. A
 * refusal is different: a strategy that keeps proposing a trade the limits clamp
 * will refuse on every tick, so an identical refusal is sent at most once per
 * hour, and a different reason is treated as news.
 */
export function decideNotice(
  notice: TickNotice,
  prefs: NotifyPrefs,
  state: NotifyState,
  nowMs: number,
): NoticeDecision {
  if (notice.kind === "opened") return { send: prefs.onOpen };
  if (notice.kind === "closed") return { send: prefs.onClose };
  if (notice.kind === "error") return { send: true };

  if (!prefs.onRefuse) return { send: false };
  const key = `${notice.market ?? ""}|${notice.detail ?? ""}`;
  const withinWindow = state.lastRefusalAt !== null && nowMs - state.lastRefusalAt < REFUSAL_WINDOW_MS;
  if (state.lastRefusalKey === key && withinWindow) return { send: false };
  return { send: true, state: { lastRefusalKey: key, lastRefusalAt: nowMs } };
}

/** A short, human line for a notice, in HTML for Telegram. */
export function formatNotice(notice: TickNotice, label: string): string {
  const who = bold(label);
  const market = notice.market ? code(notice.market) : "your agent";
  switch (notice.kind) {
    case "opened": {
      const side = notice.side === "short" ? "short" : "long";
      const lines = [
        `${bold("Position opened")} - ${who}`,
        "",
        `${side.toUpperCase()} ${market}`,
      ];
      if (notice.size !== undefined) lines.push(`Size:      ${fmtNum(notice.size)}`);
      if (notice.price !== undefined) lines.push(`Entry:     ${fmtNum(notice.price)}`);
      if (notice.leverage !== undefined) lines.push(`Leverage:  ${notice.leverage}x`);
      if (notice.marginUsd !== undefined) lines.push(`Margin:    ${fmtUsd(notice.marginUsd)}`);
      lines.push("", "Exits are watched by the agent; /positions to see it, /closeall to stop.");
      return lines.join("\n");
    }
    case "closed": {
      const lines = [
        `${bold("Position closed")} - ${who}`,
        "",
        `${market} ${notice.detail ? `(${escapeHtml(notice.detail)})` : ""}`.trim(),
      ];
      if (notice.price !== undefined) lines.push(`Exit:      ${fmtNum(notice.price)}`);
      if (notice.pnlUsd !== undefined) lines.push(`PnL:       ${fmtSignedUsd(notice.pnlUsd)}`);
      return lines.join("\n");
    }
    case "refused":
      return [
        `${bold("Trade refused by your limits")} - ${who}`,
        "",
        `${notice.side ? `${notice.side.toUpperCase()} ` : ""}${market}`,
        escapeHtml(notice.detail ?? "the risk engine refused it"),
        "",
        "Adjust with /risk, or /pause to stop the agent proposing.",
      ].join("\n");
    case "error":
      return [
        `${bold("Agent error")} - ${who}`,
        "",
        market,
        escapeHtml(notice.detail ?? "an unknown error"),
      ].join("\n");
  }
}
