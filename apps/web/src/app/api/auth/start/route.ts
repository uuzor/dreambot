import { NextResponse } from "next/server";
import { readStore } from "@/lib/data";
import { botUsername } from "@/lib/telegram";
import { newLoginToken, sessionsEnabled } from "@/lib/session";

/**
 * Begin a web sign-in.
 *
 * The browser cannot prove it controls a Telegram account, so we do not ask it
 * to. Instead we mint a one-time token, hand the user a deep link that opens the
 * bot with that token, and wait. Only someone who can send the token to the bot
 * from the account completes the sign-in, which is the whole proof.
 */
const TTL_MS = 5 * 60 * 1000;

export async function POST(): Promise<NextResponse> {
  if (!sessionsEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Web sign-in is not configured. Set DASHBOARD_SESSION_SECRET." },
      { status: 503 },
    );
  }
  const username = botUsername();
  if (!username) {
    return NextResponse.json(
      { ok: false, message: "No Telegram bot is configured. Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME." },
      { status: 503 },
    );
  }

  const token = newLoginToken();
  try {
    const store = await readStore();
    await store.createLogin(token, TTL_MS);
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: `Could not start sign-in: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // The bot claims `/start login_<token>`. Telegram allows [A-Za-z0-9_-] in a
  // start payload, and base64url produces exactly that, so it survives the trip.
  const url = `https://t.me/${username}?start=login_${token}`;
  return NextResponse.json({ ok: true, token, url, expiresInMs: TTL_MS });
}
