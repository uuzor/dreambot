// The notification decision and its rendering. No bot, no network: the point is
// that a refusal is not repeated every tick, and that a message cannot inject
// markup.

import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFY, REFUSAL_WINDOW_MS, decideNotice, formatNotice, type NotifyState } from "../src/notify.js";

const EMPTY: NotifyState = { lastRefusalKey: null, lastRefusalAt: null };
const NOW = 1_700_000_000_000;

describe("decideNotice", () => {
  it("sends opens and closes by default", () => {
    expect(decideNotice({ kind: "opened", market: "BTC-PERP" }, DEFAULT_NOTIFY, EMPTY, NOW).send).toBe(true);
    expect(decideNotice({ kind: "closed", market: "BTC-PERP" }, DEFAULT_NOTIFY, EMPTY, NOW).send).toBe(true);
  });

  it("does not send a refusal by default", () => {
    expect(decideNotice({ kind: "refused", market: "BTC-PERP" }, DEFAULT_NOTIFY, EMPTY, NOW).send).toBe(false);
  });

  it("honours a user turning opens off", () => {
    const prefs = { ...DEFAULT_NOTIFY, onOpen: false };
    expect(decideNotice({ kind: "opened", market: "BTC-PERP" }, prefs, EMPTY, NOW).send).toBe(false);
  });

  it("sends the first refusal when the user asked for them, and records the state", () => {
    const prefs = { ...DEFAULT_NOTIFY, onRefuse: true };
    const decision = decideNotice({ kind: "refused", market: "BTC-PERP", detail: "daily loss cap" }, prefs, EMPTY, NOW);
    expect(decision.send).toBe(true);
    expect(decision.state?.lastRefusalKey).toBe("BTC-PERP|daily loss cap");
  });

  it("suppresses an identical refusal inside the window", () => {
    const prefs = { ...DEFAULT_NOTIFY, onRefuse: true };
    const first = decideNotice({ kind: "refused", market: "BTC-PERP", detail: "daily loss cap" }, prefs, EMPTY, NOW);
    const state = first.state!;
    const second = decideNotice(
      { kind: "refused", market: "BTC-PERP", detail: "daily loss cap" },
      prefs,
      state,
      NOW + 1000,
    );
    expect(second.send).toBe(false);
  });

  it("sends an identical refusal again after the window", () => {
    const prefs = { ...DEFAULT_NOTIFY, onRefuse: true };
    const state: NotifyState = { lastRefusalKey: "BTC-PERP|daily loss cap", lastRefusalAt: NOW };
    const later = decideNotice(
      { kind: "refused", market: "BTC-PERP", detail: "daily loss cap" },
      prefs,
      state,
      NOW + REFUSAL_WINDOW_MS + 1,
    );
    expect(later.send).toBe(true);
  });

  it("treats a different refusal reason as news", () => {
    const prefs = { ...DEFAULT_NOTIFY, onRefuse: true };
    const state: NotifyState = { lastRefusalKey: "BTC-PERP|daily loss cap", lastRefusalAt: NOW };
    const other = decideNotice(
      { kind: "refused", market: "BTC-PERP", detail: "leverage above the market max" },
      prefs,
      state,
      NOW + 1000,
    );
    expect(other.send).toBe(true);
  });

  it("always sends an error", () => {
    expect(decideNotice({ kind: "error", detail: "rpc down" }, DEFAULT_NOTIFY, EMPTY, NOW).send).toBe(true);
  });
});

describe("formatNotice", () => {
  it("renders an open with the side, size and leverage", () => {
    const text = formatNotice(
      { kind: "opened", market: "BTC-PERP", side: "long", size: 0.01, price: 61000, leverage: 2, marginUsd: 25 },
      "agent 3 · trend-rider",
    );
    expect(text).toContain("Position opened");
    expect(text).toContain("LONG");
    expect(text).toContain("BTC-PERP");
    expect(text).toContain("2x");
  });

  it("renders a close with a signed PnL", () => {
    const text = formatNotice({ kind: "closed", market: "BTC-PERP", pnlUsd: -12.5, detail: "stop loss" }, "agent 1");
    expect(text).toContain("Position closed");
    expect(text).toContain("-$12.50");
    expect(text).toContain("stop loss");
  });

  it("escapes a market name, so a hostile symbol cannot inject markup", () => {
    const text = formatNotice({ kind: "opened", market: "<b>x</b>", side: "long" }, "a");
    expect(text).not.toContain("<b>x</b>");
    expect(text).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
