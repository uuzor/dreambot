import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/headers only works inside a request scope. The gate reads one cookie, so
// a small mock is enough to drive it directly.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined) }),
}));

const { requireSession, sessionTelegramId } = await import("../src/lib/api");
const { SESSION_COOKIE, issueSession } = await import("../src/lib/session");

const KEYS = ["DASHBOARD_SESSION_SECRET", "DASHBOARD_TELEGRAM_ID"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  process.env.DASHBOARD_SESSION_SECRET = "s3cret";
  jar.clear();
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("requireSession", () => {
  it("returns 401 when no cookie is present", async () => {
    const res = await requireSession();
    expect("response" in res).toBe(true);
    if ("response" in res) expect(res.response.status).toBe(401);
  });

  it("ignores DASHBOARD_TELEGRAM_ID, so a pinned single-user deploy cannot be traded through", async () => {
    // The reader honours this variable; the control gate must not.
    process.env.DASHBOARD_TELEGRAM_ID = "12345";
    const res = await requireSession();
    expect("response" in res).toBe(true);
  });

  it("resolves the id from a valid session cookie", async () => {
    jar.set(SESSION_COOKIE, issueSession(99)!);
    const res = await requireSession();
    expect("id" in res && res.id).toBe(99);
  });

  it("rejects a cookie signed with another secret", async () => {
    const cookie = issueSession(1)!;
    process.env.DASHBOARD_SESSION_SECRET = "different";
    jar.set(SESSION_COOKIE, cookie);
    const res = await requireSession();
    expect("response" in res).toBe(true);
  });
});

describe("sessionTelegramId", () => {
  it("is null without a cookie and the id with one", async () => {
    expect(await sessionTelegramId()).toBeNull();
    jar.set(SESSION_COOKIE, issueSession(7)!);
    expect(await sessionTelegramId()).toBe(7);
  });
});
