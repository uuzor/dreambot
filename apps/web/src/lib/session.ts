import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Web sessions.
 *
 * The dashboard can now deploy agents and close positions, so it needs to know
 * who is asking. A session is a signed cookie holding the Telegram id: the web
 * app never stores a session table, because the signature is the only thing that
 * needs to be unforgeable.
 *
 * The signing secret is DASHBOARD_SESSION_SECRET. When it is unset there are no
 * sessions and every control route refuses, which is the safe default: a
 * deployment that forgot the secret is read-only, not open.
 */

const COOKIE = "dp_session";
/** How long a session stays valid, in seconds. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function sessionSecret(): string | null {
  const s = process.env.DASHBOARD_SESSION_SECRET?.trim();
  return s ? s : null;
}

/** True when the deployment can issue and verify sessions at all. */
export function sessionsEnabled(): boolean {
  return sessionSecret() !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/**
 * Mint a session value for a Telegram id.
 *
 * Returns null when no secret is configured, so callers cannot accidentally
 * issue a session that no one can verify.
 */
export function issueSession(telegramId: number, nowMs: number = Date.now()): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${telegramId}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a session value and return the Telegram id it belongs to.
 *
 * Returns null for anything malformed, unsigned, tampered with or expired. The
 * signature is compared in constant time so a forged cookie cannot be discovered
 * one byte at a time.
 */
export function verifySession(value: string | undefined | null, nowMs: number = Date.now()): number | null {
  if (!value) return null;
  const secret = sessionSecret();
  if (!secret) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts as [string, string, string];

  const expected = sign(`${id}.${exp}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expiresAt = Number(exp);
  const telegramId = Number(id);
  if (!Number.isFinite(expiresAt) || !Number.isFinite(telegramId)) return null;
  if (expiresAt * 1000 <= nowMs) return null;

  return telegramId;
}

export const SESSION_COOKIE = COOKIE;

/** A fresh, unguessable login token, safe to put in a URL. */
export function newLoginToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Cookie attributes for the session. Secure is on unless explicitly disabled for local http. */
export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.DASHBOARD_COOKIE_INSECURE === "true" ? false : true,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
