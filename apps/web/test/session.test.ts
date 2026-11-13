import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  issueSession,
  newLoginToken,
  sessionsEnabled,
  verifySession,
} from "../src/lib/session";

// These read process.env at call time, so a case can set and unset freely.
const KEYS = ["DASHBOARD_SESSION_SECRET", "DASHBOARD_COOKIE_INSECURE"] as const;
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

describe("sessionsEnabled", () => {
  it("is false without a secret, so a misconfigured deploy is read-only", () => {
    expect(sessionsEnabled()).toBe(false);
  });

  it("is true with a secret", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    expect(sessionsEnabled()).toBe(true);
  });
});

describe("issueSession / verifySession", () => {
  it("refuses to issue a session when no secret is configured", () => {
    expect(issueSession(1)).toBeNull();
  });

  it("round-trips a Telegram id", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    expect(verifySession(issueSession(42))).toBe(42);
  });

  it("rejects a value signed with a different secret", () => {
    process.env.DASHBOARD_SESSION_SECRET = "a";
    const cookie = issueSession(1);
    process.env.DASHBOARD_SESSION_SECRET = "b";
    expect(verifySession(cookie)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    const cookie = issueSession(1)!;
    const [, exp, sig] = cookie.split(".");
    // Claim to be user 2, keeping the signature for user 1.
    expect(verifySession(`2.${exp}.${sig}`)).toBeNull();
  });

  it("rejects a tampered expiry, which would otherwise extend the session", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    const cookie = issueSession(1)!;
    const [id, , sig] = cookie.split(".");
    expect(verifySession(`${id}.${Math.floor(Date.now() / 1000) + 999999}.${sig}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    // Issued at the epoch, so it expired long ago.
    const cookie = issueSession(1, 0)!;
    expect(verifySession(cookie)).toBeNull();
  });

  it("accepts a session that is still inside its window", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    const now = Date.now();
    const cookie = issueSession(7, now)!;
    expect(verifySession(cookie, now + (SESSION_TTL_SECONDS - 10) * 1000)).toBe(7);
  });

  it("rejects malformed values without throwing", () => {
    process.env.DASHBOARD_SESSION_SECRET = "s3cret";
    for (const v of ["", "x", "a.b", "a.b.c.d", "1.2.3", "undefined.undefined.undefined"]) {
      expect(verifySession(v)).toBeNull();
    }
    expect(verifySession(undefined)).toBeNull();
  });
});

describe("newLoginToken", () => {
  it("is URL-safe, so it survives the Telegram start payload", () => {
    for (let i = 0; i < 20; i++) {
      expect(newLoginToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newLoginToken()));
    expect(seen.size).toBe(50);
  });
});
