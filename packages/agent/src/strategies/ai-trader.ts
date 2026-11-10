// AI Trader: reads the market and proposes a trade, with a deterministic
// fallback.
//
// The model proposes; it never executes. Its proposal is a plain object that the
// tick runner hands to the same risk engine every other strategy goes through,
// so a hallucinated 50x on a market the user did not allow is refused in code.
//
// With no ANTHROPIC_API_KEY the strategy falls back to a rules-based momentum
// reading, so the agent still works out of the box.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { bracketAround, type Proposal, type Strategy, type StrategyContext } from "../strategy.js";

const ProposalSchema = z.object({
  market: z.string().min(1),
  side: z.enum(["long", "short"]),
  leverage: z.number().int().min(1),
  margin_usd: z.number().positive(),
  reasoning: z.string().min(1),
  take_profit_pct: z.number().positive().optional(),
  stop_loss_pct: z.number().positive().optional(),
});

const SYSTEM = [
  "You are an autonomous perpetual-futures trading agent on DreamDEX, a venue on the Somnia network.",
  "Every decision you make is written to a public, tamper-evident journal, so state your reasoning plainly.",
  "You may open at most one position per tick, and only on the markets you are allowed.",
  "Your leverage and margin are hard-capped in code; a request outside the caps is clamped or refused.",
  "Prefer holding to forcing a trade. Protecting capital comes first.",
].join(" ");

export interface AiTraderOptions {
  model?: string;
  /** The free-text guidance the user gave the agent. */
  thesis?: string | null;
  apiKey?: string;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  /** Injected for tests; defaults to a real client when an API key exists. */
  client?: Pick<Anthropic, "messages">;
}

export class AiTrader implements Strategy {
  readonly name = "ai-trader";
  readonly description = "Reads live market conditions and proposes trades, inside your limits.";

  private readonly client?: Pick<Anthropic, "messages">;
  private readonly model: string;

  constructor(private readonly opts: AiTraderOptions = {}) {
    this.model = opts.model ?? "claude-sonnet-4-5";
    if (opts.client) this.client = opts.client;
    else if (opts.apiKey) this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async decide(ctx: StrategyContext): Promise<Proposal | undefined> {
    if (ctx.account.positions.length >= ctx.limits.maxOpenPositions) return undefined;
    const tradable = ctx.markets.filter((m) => m.markPx !== null);
    if (tradable.length === 0) return undefined;
    if (!this.client) return this.fallback(ctx, tradable);

    try {
      const raw = await this.askModel(ctx, tradable);
      if (raw === null) return undefined;
      const parsed = ProposalSchema.safeParse(raw);
      if (!parsed.success) return undefined;
      const p = parsed.data;
      const info = tradable.find((m) => m.market === p.market);
      if (!info || info.markPx === null) return undefined;
      const { takeProfit, stopLoss } = bracketAround(
        info.markPx,
        p.side,
        p.take_profit_pct ?? this.opts.takeProfitPct ?? 2,
        p.stop_loss_pct ?? this.opts.stopLossPct ?? 1,
      );
      return {
        market: p.market,
        side: p.side,
        leverage: p.leverage,
        marginUsd: p.margin_usd,
        reasoning: p.reasoning,
        takeProfit,
        stopLoss,
      };
    } catch {
      // A model or network failure must not leave the agent idle forever, and it
      // must not leave it trading blindly either. The fallback is deterministic.
      return this.fallback(ctx, tradable);
    }
  }

  private async askModel(ctx: StrategyContext, tradable: StrategyContext["markets"]): Promise<unknown> {
    const snapshot = tradable.map((m) => ({
      market: m.market,
      mark: m.markPx,
      bid: m.bid,
      ask: m.ask,
      fundingApr: Number(m.fundingApr.toFixed(4)),
      momentum1h: m.momentumPct === null ? null : Number(m.momentumPct.toFixed(4)),
    }));
    const account = {
      equityUsd: Number(ctx.account.equityUsd.toFixed(2)),
      availableUsd: Number(ctx.account.availableUsd.toFixed(2)),
      openPositions: ctx.account.positions.map((p) => ({ market: p.market, side: p.side })),
    };
    const res = await this.client!.messages.create({
      model: this.model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Strategy from the user:\n${this.opts.thesis ?? ctx.thesis ?? "Trade conservatively."}`,
            `Hard limits (enforced in code): markets ${ctx.limits.markets.join(", ")}; ` +
              `max leverage ${ctx.limits.maxLeverage}x; margin per trade ${ctx.limits.marginPerTradeUsd} USD; ` +
              `max ${ctx.limits.maxOpenPositions} open position(s).`,
            `Markets:\n${JSON.stringify(snapshot, null, 2)}`,
            `Account:\n${JSON.stringify(account, null, 2)}`,
            "Reply with ONLY a JSON object, no prose, in one of these two shapes:",
            '{"action":"hold","reasoning":"..."}',
            '{"action":"open","market":"BTC-PERP","side":"long","leverage":2,"margin_usd":25,"reasoning":"...","take_profit_pct":2,"stop_loss_pct":1}',
          ].join("\n\n"),
        },
      ],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    if (!json) return null;
    const parsed = JSON.parse(json) as { action?: string };
    if (parsed.action === "hold") return null;
    return parsed;
  }

  /** Rules-based momentum reading, used with no API key or when the model fails. */
  private fallback(ctx: StrategyContext, tradable: StrategyContext["markets"]): Proposal | undefined {
    const open = new Set(ctx.account.positions.map((p) => p.market));
    const best = tradable
      .filter((m) => m.momentumPct !== null && !open.has(m.market) && m.markPx !== null)
      .sort((a, b) => Math.abs(b.momentumPct!) - Math.abs(a.momentumPct!))[0];
    if (!best || best.momentumPct === null || best.markPx === null) return undefined;
    if (Math.abs(best.momentumPct) < 0.005) return undefined;
    const side: "long" | "short" = best.momentumPct > 0 ? "long" : "short";
    const { takeProfit, stopLoss } = bracketAround(
      best.markPx,
      side,
      this.opts.takeProfitPct ?? 2,
      this.opts.stopLossPct ?? 1,
    );
    return {
      market: best.market,
      side,
      leverage: this.opts.leverage ?? 2,
      marginUsd: ctx.limits.marginPerTradeUsd,
      reasoning:
        `No model is configured, so I read the tape: ${best.market} is the strongest mover at ` +
        `${(best.momentumPct * 100).toFixed(2)}%, and I am taking it ${side} with the standard bracket.`,
      takeProfit,
      stopLoss,
    };
  }
}
