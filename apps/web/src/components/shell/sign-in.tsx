"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "idle" | "waiting" | "error" | "unavailable";

/**
 * Sign in to the dashboard with Telegram.
 *
 * The dashboard can deploy agents and close positions, so it has to know who is
 * asking. There is no password: we mint a one-time token, send the user to the
 * bot with it, and the bot tells us which Telegram account presented it. Only
 * someone who controls that account can finish, and only then do we set a session
 * cookie. This component owns the whole handshake.
 */
export function SignIn({ botConfigured }: { botConfigured: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>("");
  const [url, setUrl] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const poll = useCallback(
    async (token: string) => {
      try {
        const res = await fetch("/api/auth/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as { status?: string; message?: string };
        if (res.ok && data.status === "ready") {
          stop();
          router.refresh();
          return;
        }
        if (res.status === 410) {
          stop();
          setPhase("error");
          setMessage("That sign-in expired. Try again.");
        }
      } catch {
        // A transient network error: keep polling until the token expires.
      }
    },
    [router, stop],
  );

  async function begin() {
    setPhase("waiting");
    setMessage("");
    try {
      const res = await fetch("/api/auth/start", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; token?: string; url?: string; message?: string };
      if (!res.ok || !data.token || !data.url) {
        setPhase(res.status === 503 ? "unavailable" : "error");
        setMessage(data.message ?? "Could not start sign-in.");
        return;
      }
      tokenRef.current = data.token;
      setUrl(data.url);
      // Open the bot in a new tab so this one keeps polling.
      window.open(data.url, "_blank", "noopener,noreferrer");
      stop();
      timerRef.current = setInterval(() => {
        if (tokenRef.current) void poll(tokenRef.current);
      }, 2000);
    } catch {
      setPhase("error");
      setMessage("Could not reach the server. Try again.");
    }
  }

  return (
    <div className="panel bevel mx-auto w-full max-w-xl p-7">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-ink text-accent">
        <ShieldCheck size={18} />
      </span>
      <h1 className="display mt-5 text-[clamp(1.5rem,3.4vw,2rem)]">Sign in to trade</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-mute">
        Deploying agents and changing limits needs to know which account is yours.
        Telegram is the identity it uses.
      </p>

      <ol className="mt-5 space-y-2 text-[12.5px] leading-relaxed text-mute">
        <li>Tap the button. We open the bot with a one-time code.</li>
        <li>Tap Start in the bot to send the code.</li>
        <li>Come back here. This page finishes on its own.</li>
      </ol>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={begin} disabled={phase === "waiting" || !botConfigured}>
          {phase === "waiting" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {phase === "waiting" ? "Waiting for the bot…" : "Sign in with Telegram"}
        </Button>
        {url && phase === "waiting" && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-accent"
          >
            Reopen the bot <ArrowUpRight size={13} />
          </a>
        )}
      </div>

      {!botConfigured && (
        <p className="mt-4 font-mono text-[11px] text-warn">
          NEXT_PUBLIC_TELEGRAM_BOT_USERNAME is unset, so there is no bot to sign in with.
        </p>
      )}
      {phase !== "idle" && phase !== "waiting" && message && (
        <p className="mt-4 text-[12.5px] text-warn">{message}</p>
      )}
    </div>
  );
}
