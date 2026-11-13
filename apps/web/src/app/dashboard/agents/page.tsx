import Link from "next/link";
import { ArrowUpRight, Bot, Plus } from "lucide-react";
import { STRATEGIES } from "@dreampilot/agent";
import { loadDashboard, opsDeps } from "@/lib/data";
import { liveMarkets } from "@dreampilot/ops";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SignIn } from "@/components/shell/sign-in";
import { DeployForm } from "@/components/shell/deploy-form";
import { AgentControls } from "@/components/shell/agent-controls";
import { botUsername } from "@/lib/telegram";
import { cn, usd } from "@/lib/format";
import { STRATEGY_META, STATUS_TONE } from "@/lib/strategies";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const data = await loadDashboard();

  // Creating an agent needs an account, and the market list comes from the
  // exchange, so it is read here rather than hardcoded in the form.
  let markets: string[] = [];
  try {
    markets = await liveMarkets(await opsDeps());
  } catch {
    markets = [];
  }

  const disabledReason = !data.signedIn
    ? "Sign in to deploy."
    : !data.account
      ? "Connect a DreamDEX account first, on the Settings page."
      : markets.length === 0
        ? "The exchange market list is unavailable right now."
        : data.agents.some((a) => a.status === "running")
          ? "You already have a running agent."
          : null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-accent">Agents</span>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.6rem)]">
            {data.agents.length} deployed
          </h1>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-mute">
            Create an agent here or in the bot. Both run the same operation, so the
            limits you set are enforced by the same risk engine either way.
          </p>
        </div>
        {data.agents.length > 0 && (
          <ButtonLink href="#deploy" size="sm">
            <Plus size={15} />
            Deploy an agent
          </ButtonLink>
        )}
      </div>

      {!data.signedIn && (
        <SignIn botConfigured={botUsername() !== null} />
      )}

      {data.signedIn && (
        <div id="deploy" className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="mb-4 text-[15px] font-semibold text-chalk">Create and launch</h2>
            <DeployForm
              strategies={STRATEGIES.map((s) => ({
                key: s.key,
                label: s.label,
                description: s.description,
              }))}
              markets={markets}
              disabledReason={disabledReason}
            />
          </div>
          <div className="space-y-4">
            <h2 className="text-[15px] font-semibold text-chalk">Your agents</h2>
            {data.agents.length === 0 ? (
              <p className="text-[13px] text-mute">
                No agents yet. Pick a strategy and a market on the left to create one.
              </p>
            ) : (
              data.agents.map((a) => <AgentCard key={a.id} agent={a} />)
            )}
          </div>
        </div>
      )}

      {!data.signedIn && data.agents.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent: a }: { agent: import("@dreampilot/store").Agent }) {
  const meta = STRATEGY_META[a.strategy] ?? {
    label: a.strategy,
    tagline: "",
    tone: "neutral" as const,
  };
  const pnlTone =
    a.daily_pnl_usd > 0 ? "text-long" : a.daily_pnl_usd < 0 ? "text-short" : "text-dim";

  return (
    <div className="card bevel p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-ink text-dim">
            <Bot size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-chalk">{meta.label}</h2>
            <p className="mt-0.5 font-mono text-[10.5px] text-dim">
              agent {a.id} · {a.market}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
          <Link href={`/dashboard/agents/${a.id}`} aria-label={`agent ${a.id} details`}>
            <ArrowUpRight size={15} className="text-dim transition-colors hover:text-chalk" />
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4 border-t border-line pt-5">
        {[
          { k: "today", v: usd(a.daily_pnl_usd, { sign: true }), tone: pnlTone },
          { k: "lev cap", v: `${a.max_leverage}×`, tone: "text-chalk" },
          { k: "per trade", v: usd(a.margin_per_trade), tone: "text-chalk" },
          {
            k: "daily loss",
            v: a.max_daily_loss != null ? usd(a.max_daily_loss) : "off",
            tone: a.max_daily_loss != null ? "text-chalk" : "text-dim",
          },
        ].map((s) => (
          <div key={s.k}>
            <div className="eyebrow">{s.k}</div>
            <div className={cn("tnum mt-1.5 text-[13px] font-medium", s.tone)}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {a.markets.map((m) => (
          <span
            key={m}
            className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[10px] text-dim"
          >
            {m}
          </span>
        ))}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <AgentControls agentId={a.id} status={a.status} />
      </div>
    </div>
  );
}

