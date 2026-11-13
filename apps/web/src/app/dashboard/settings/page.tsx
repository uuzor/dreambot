import { Check, Copy, KeyRound, Link2, MessageSquare, Wallet } from "lucide-react";
import { loadDashboard } from "@/lib/data";
import { Badge, LiveDot, Stat } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/format";

export const metadata = { title: "Settings" };

function Copyable({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line bg-ink px-3.5 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-mute">
        {value}
      </code>
      <span className="text-dim">
        <Copy size={13} />
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  const { account, user, agents } = await loadDashboard();
  const linked = Boolean(account?.linked);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div>
        <span className="eyebrow text-accent">Settings</span>
        <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
          Account and connection
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Telegram" value={user.username ?? "—"} sub={`id ${user.telegramId}`} />
        <Stat
          label="Network"
          value={account?.network ?? "not set"}
          sub="hideki · chain 50383"
        />
        <Stat
          label="Link status"
          value={linked ? "linked" : "not linked"}
          tone={linked ? "long" : "short"}
          sub={linked ? "bot key authorised" : "no trading possible"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel bevel p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-chalk">
              <Wallet size={15} className="text-accent" />
              DreamDEX account
            </h2>
            <Badge tone={linked ? "long" : "warn"}>
              {linked ? "linked" : "action needed"}
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="eyebrow mb-2">Your trading account</div>
              <Copyable value={account?.address ?? "—"} />
            </div>
            <div>
              <div className="eyebrow mb-2 flex items-center gap-2">
                <KeyRound size={11} /> Bot key (public)
              </div>
              <Copyable value={account?.botKeyAddress ?? "—"} />
              <p className="mt-2 text-[11.5px] leading-relaxed text-dim">
                The private half is generated on this server and encrypted at rest. It
                can place, cancel and reduce orders. It has no withdrawal path.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <Button size="sm" variant="outline">
              <Link2 size={14} />
              {linked ? "Re-link in DreamDEX" : "Link in DreamDEX"}
            </Button>
            <Button size="sm" variant="ghost">
              Rotate bot key
            </Button>
          </div>
        </div>

        <div className="panel bevel p-6">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-chalk">
            <MessageSquare size={15} className="text-accent" />
            Telegram notifications
          </h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-mute">
            What the bot messages you about. Refusals are de-duplicated, so an identical
            refusal is not repeated every tick.
          </p>

          <ul className="mt-5 divide-y divide-line">
            {[
              { k: "Position opened", on: true },
              { k: "Position closed", on: true },
              { k: "Order refused by risk engine", on: true },
              { k: "Daily summary", on: false },
            ].map((r) => (
              <li key={r.k} className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-[12.5px] text-mute">{r.k}</span>
                <span
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    r.on ? "bg-accent/30" : "bg-line",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full transition-all",
                      r.on ? "left-[18px] bg-accent" : "left-0.5 bg-dim",
                    )}
                  />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-5">
            <LiveDot tone="long" />
            <span className="font-mono text-[10.5px] text-mute">
              {agents.length} agents reporting to this chat
            </span>
          </div>
        </div>
      </div>

      <div className="panel bevel p-6">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold text-chalk">
          <Check size={15} className="text-long" />
          Risk disclosure
        </h2>
        <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-mute">
          Perpetual futures are leveraged and you can lose more than you deposit.
          DreamPilot is testnet software: it runs on Somnia Hideki (chain 50383) and
          refuses mainnet. Nothing here is financial advice, and an autonomous agent
          can be wrong repeatedly before it is right.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Badge tone={user.tosAccepted ? "long" : "warn"}>
            {user.tosAccepted ? "accepted" : "not accepted"}
          </Badge>
          <span className="font-mono text-[10.5px] text-dim">
            /tos in the Telegram bot
          </span>
        </div>
      </div>
    </div>
  );
}
