import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

/**
 * The Telegram id behind a control request, or null.
 *
 * Unlike the dashboard's reader, this never falls back to DASHBOARD_TELEGRAM_ID:
 * that variable exists so a single-user local run can *look* at an account, and
 * it must not be a way to *act* on one. Only a signed session can trade, so a
 * deployment that pins an id is read-only until someone signs in.
 */
export async function sessionTelegramId(): Promise<number | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** A JSON error with a status, for a route handler to return. */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, message }, { status });
}

/** 401 when there is no signed-in user, otherwise the id. */
export async function requireSession(): Promise<{ id: number } | { response: NextResponse }> {
  const id = await sessionTelegramId();
  if (id === null) {
    return { response: fail("Sign in with Telegram to control agents.", 401) };
  }
  return { id };
}
