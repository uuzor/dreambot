"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentStatus } from "@dreampilot/store";

/**
 * The per-agent controls: pause, resume and close everything.
 *
 * Every action posts to an authenticated route, so the button only works for the
 * account behind the session. Close-all is deliberately a separate, labelled
 * action rather than something that happens on a stray click.
 */
export function AgentControls({
  agentId,
  status,
}: {
  agentId: number;
  status: AgentStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function call(path: string, body: unknown, label: string) {
    setBusy(label);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setMessage(data.message ?? (res.ok ? "Done." : "Failed."));
      if (res.ok) router.refresh();
    } catch {
      setMessage("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "running" ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => call("/api/agents/status", { agentId, status: "paused" }, "pause")}
        >
          {busy === "pause" ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}
          Pause
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => call("/api/agents/status", { agentId, status: "running" }, "resume")}
        >
          {busy === "resume" ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Resume
        </Button>
      )}

      <Button
        variant="danger"
        size="sm"
        disabled={busy !== null}
        onClick={() => call("/api/positions/close-all", {}, "close")}
      >
        {busy === "close" ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
        Close all &amp; pause
      </Button>

      {message && <span className="font-mono text-[11px] text-mute">{message}</span>}
    </div>
  );
}
