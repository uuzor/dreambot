import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { botUsername, connectToken, telegramConnectUrl } from "../src/lib/telegram";

// These read process.env at call time, so a case can set and unset freely.
const KEYS = [
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
  "DASHBOARD_LINK_SECRET",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("botUsername", () => {
  it("returns null when unset, so the UI can hide the link", () => {
    expect(botUsername()).toBeNull();
  });

  it("returns null for a blank value rather than an empty username", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "   ";
    expect(botUsername()).toBeNull();
  });

  it("strips a leading @ and surrounding whitespace", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "  @dreampilot_bot  ";
    expect(botUsername()).toBe("dreampilot_bot");
  });
});

describe("connectToken", () => {
  it("is null without a secret, so the link degrades instead of lying", () => {
    expect(connectToken(770_001_337)).toBeNull();
  });

  it("is deterministic for the same id and secret", () => {
    process.env.DASHBOARD_LINK_SECRET = "s3cret";
    expect(connectToken(1)).toBe(connectToken(1));
  });

  it("differs between ids, so a token cannot be replayed across accounts", () => {
    process.env.DASHBOARD_LINK_SECRET = "s3cret";
    expect(connectToken(1)).not.toBe(connectToken(2));
  });

  it("differs between secrets", () => {
    process.env.DASHBOARD_LINK_SECRET = "a";
    const first = connectToken(1);
    process.env.DASHBOARD_LINK_SECRET = "b";
    expect(connectToken(1)).not.toBe(first);
  });

  it("is hex and short enough to sit in a deep link", () => {
    process.env.DASHBOARD_LINK_SECRET = "s3cret";
    expect(connectToken(1)).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe("telegramConnectUrl", () => {
  it("is null without a username", () => {
    expect(telegramConnectUrl(1)).toBeNull();
  });

  it("is the bare bot link without a secret", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "dreampilot_bot";
    expect(telegramConnectUrl(1)).toBe("https://t.me/dreampilot_bot");
  });

  it("carries the start token when a secret is set", () => {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "dreampilot_bot";
    process.env.DASHBOARD_LINK_SECRET = "s3cret";
    expect(telegramConnectUrl(1)).toBe(
      `https://t.me/dreampilot_bot?start=${connectToken(1)}`,
    );
  });
});
