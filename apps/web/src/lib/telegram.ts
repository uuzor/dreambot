import { createHmac } from "node:crypto";

/**
 * Everything the web app needs to point a user at the Telegram bot.
 *
 * The bot is the only surface that can act on an account, so the dashboard's job
 * here is to hand the user over, not to imitate it. When no bot username is
 * configured the helpers return null and the UI hides the link rather than
 * rendering a dead one.
 */

export function botUsername(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  return raw ? raw : null;
}

/**
 * A `?start=` token the bot can verify came from the dashboard. It is an HMAC of
 * the Telegram id, so the bot can trust it without the web app holding any
 * session state. Without a secret we fall back to the bare bot link: the bot
 * still works, it just cannot pre-associate the chat with the account.
 */
export function connectToken(telegramId: number): string | null {
  const secret = process.env.DASHBOARD_LINK_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(String(telegramId)).digest("hex").slice(0, 24);
}

/** The `t.me` deep link for a given account, or the plain bot link. */
export function telegramConnectUrl(telegramId: number): string | null {
  const username = botUsername();
  if (!username) return null;
  const token = connectToken(telegramId);
  return token ? `https://t.me/${username}?start=${token}` : `https://t.me/${username}`;
}

export type TelegramReachability = "connected" | "not-started" | "unknown";

/**
 * Ask Telegram whether the user has ever opened the bot.
 *
 * This is the only honest way to answer "is Telegram connected?" — the store
 * knows who has traded, not who has started a chat. `getChat` returns 400 for a
 * chat that has never been opened, and 200 once it exists.
 *
 * Returns "unknown" when there is no bot token, when the call fails, or on any
 * status other than 200/400. A 401 means *our* token is bad and a 403 means the
 * user blocked the bot — neither is evidence about whether the chat exists, so
 * neither may be reported as "not-started". Callers must treat "unknown" as
 * "do not claim anything".
 */
export async function telegramReachability(
  telegramId: number,
): Promise<TelegramReachability> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return "unknown";

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId }),
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (res.ok) return "connected";
    // 400 is Telegram's "chat not found": the user has never opened the bot.
    return res.status === 400 ? "not-started" : "unknown";
  } catch {
    return "unknown";
  }
}
