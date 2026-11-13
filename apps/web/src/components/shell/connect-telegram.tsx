import { ArrowUpRight, Send } from "lucide-react";
import type { TelegramLink } from "@/lib/types";

/**
 * The hand-off to Telegram.
 *
 * The dashboard cannot trade — only the bot can — so when Telegram is not yet
 * connected this is the one action that matters, and it sits at the top of every
 * dashboard page. When there is no bot username configured it renders a
 * disabled state rather than a dead link.
 */
export function ConnectTelegram({ telegram }: { telegram: TelegramLink }) {
  // Connected: nothing to do. Stay out of the way.
  if (telegram.reachability === "connected") return null;

  const known = telegram.reachability === "not-started";
  const configured = Boolean(telegram.url);

  return (
    <div className="panel bevel mb-6 flex flex-wrap items-center gap-x-5 gap-y-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink text-accent">
        <Send size={17} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[14px] font-semibold text-chalk">
            {known ? "Connect Telegram" : "Telegram"}
          </h2>
          {telegram.reachability === "unknown" && (
            <span className="font-mono text-[10px] tracking-wide text-dim uppercase">
              status unknown
            </span>
          )}
        </div>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-mute">
          {known ? (
            <>
              This dashboard is read-only. Deploying an agent, setting risk limits and
              closing positions all happen in the bot — start a chat and the account
              below is already yours.
            </>
          ) : (
            <>
              The bot handles everything this dashboard cannot: deploying agents, risk
              limits and closing positions. Start a chat to get going.
            </>
          )}
        </p>
      </div>

      {configured ? (
        <a
          href={telegram.url!}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-chalk px-5 text-sm font-semibold whitespace-nowrap text-ink transition-all duration-200 hover:bg-white active:scale-[0.985]"
        >
          <Send size={15} />
          {known ? "Connect Telegram" : "Open the bot"}
          <ArrowUpRight size={14} />
        </a>
      ) : (
        <span
          title="Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME to enable this link"
          className="inline-flex h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-2xl border border-line px-5 text-sm whitespace-nowrap text-dim"
        >
          <Send size={15} />
          Bot link not configured
        </span>
      )}
    </div>
  );
}
