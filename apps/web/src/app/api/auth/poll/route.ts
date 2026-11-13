import { NextResponse } from "next/server";
import { readStore } from "@/lib/data";
import { issueSession, sessionCookieOptions, SESSION_COOKIE, sessionsEnabled } from "@/lib/session";

/**
 * Finish a web sign-in.
 *
 * Polls the challenge the start route created. Until the bot has claimed it the
 * answer is "pending"; once it has, this is the only place a session cookie is
 * ever issued, and it is issued for the Telegram id the bot recorded — never for
 * anything the browser supplied.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (!sessionsEnabled()) {
    return NextResponse.json({ ok: false, message: "Web sign-in is not configured." }, { status: 503 });
  }

  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = typeof body.token === "string" ? body.token : "";
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false, message: "Missing token." }, { status: 400 });

  let row;
  try {
    const store = await readStore();
    row = await store.getLogin(token);
  } catch (err) {
    return NextResponse.json({ ok: false, message: `Lookup failed: ${(err as Error).message}` }, { status: 500 });
  }

  // Unknown or expired: the browser should start again rather than wait.
  if (!row) return NextResponse.json({ ok: false, status: "expired" }, { status: 410 });
  if (row.telegram_id === null) return NextResponse.json({ ok: true, status: "pending" });

  const session = issueSession(row.telegram_id);
  if (!session) {
    return NextResponse.json({ ok: false, message: "Could not issue a session." }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, status: "ready", telegramId: row.telegram_id });
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
}
