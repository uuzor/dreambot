// One tick of one agent, and the error boundary around it.
//
// The worker's only job is to call this for each running agent on a schedule.
// Keeping the unit of work here means the same function runs under BullMQ in
// production and under the in-process scheduler in a no-Redis deployment.

import { Journal } from "@dreampilot/risk";
import {
  buildVenue,
  limitsOf,
  runTick,
  strategyByKey,
  type Strategy,
  type TickOutcome,
} from "@dreampilot/agent";
import { DEFAULT_NOTIFY, decideNotice, formatNotice, type NotifyPrefs } from "@dreampilot/telegram";
import type { Agent, Cipher, Store } from "@dreampilot/store";

export interface WorkerDeps {
  store: Store;
  cipher: Cipher;
  dryRun: boolean;
  network: string;
  anthropicApiKey?: string;
  model?: string;
  /** Where to write the one-line tick summary. */
  log?: (line: string) => void;
  /**
   * Deliver a user-facing message. The bot process supplies this; a worker run
   * without a bot token leaves it undefined and notifications are skipped.
   */
  notify?: (telegramId: number, text: string) => Promise<void>;
}

/** A strategy instance for an agent, or undefined when the key is unknown. */
export function strategyFor(agent: Agent, deps: WorkerDeps): Strategy | undefined {
  const descriptor = strategyByKey(agent.strategy);
  if (!descriptor) return undefined;
  return descriptor.build({
    apiKey: deps.anthropicApiKey,
    model: deps.model,
    thesis: agent.thesis,
  });
}

/**
 * Deliver a tick's notice to the user, if the notice and their preferences say
 * to. Never throws: a failed notification must not fail the tick that produced
 * it, and the position change has already happened by this point.
 */
export async function deliverNotice(agent: Agent, outcome: TickOutcome, deps: WorkerDeps): Promise<void> {
  const log = deps.log ?? ((l: string) => console.log(l));
  if (!outcome.notice || !deps.notify) return;
  try {
    const settings = await deps.store.getNotify(agent.telegram_id);
    const prefs: NotifyPrefs = settings
      ? { onOpen: settings.on_open, onClose: settings.on_close, onRefuse: settings.on_refuse }
      : DEFAULT_NOTIFY;
    const state = {
      lastRefusalKey: settings?.last_refusal_key ?? null,
      lastRefusalAt: settings?.last_refusal_at?.getTime() ?? null,
    };
    const decision = decideNotice(outcome.notice, prefs, state, Date.now());
    if (!decision.send) return;
    await deps.notify(agent.telegram_id, formatNotice(outcome.notice, `agent ${agent.id} · ${agent.strategy}`));
    if (decision.state) {
      await deps.store.saveNotify(agent.telegram_id, {
        last_refusal_key: decision.state.lastRefusalKey,
        last_refusal_at: decision.state.lastRefusalAt ? new Date(decision.state.lastRefusalAt) : null,
      });
    }
  } catch (err) {
    log(`agent ${agent.id}: notify failed (${err instanceof Error ? err.message : String(err)})`);
  }
}

/**
 * Run one decision cycle for one agent. Never throws: a failing agent must not
 * take down the worker, and the failure is recorded so the user can see it.
 */
export async function tickAgent(agent: Agent, deps: WorkerDeps): Promise<void> {
  const log = deps.log ?? ((l: string) => console.log(l));
  const strategy = strategyFor(agent, deps);
  if (!strategy) {
    log(`agent ${agent.id}: unknown strategy "${agent.strategy}", skipping`);
    return;
  }

  const account = await deps.store.getAccount(agent.telegram_id);
  let live: { account: `0x${string}`; botPrivateKey: `0x${string}`; network: string } | undefined;
  if (account && account.account_address && !deps.dryRun) {
    try {
      const privateKey = deps.cipher.decrypt(account.bot_key_encrypted) as `0x${string}`;
      live = { account: account.account_address as `0x${string}`, botPrivateKey: privateKey, network: account.network };
    } catch (err) {
      log(`agent ${agent.id}: cannot read the bot key (${(err as Error).message}); skipping`);
      return;
    }
  }

  const { venue, paper } = buildVenue({
    network: account?.network ?? deps.network,
    live,
    dryRun: deps.dryRun,
    paperStartingUsd: 1000,
  });

  const journal = new Journal(agent.journal_path);
  try {
    const outcome = await runTick({
      venue,
      strategy,
      store: deps.store,
      journal,
      agent,
      dryRun: deps.dryRun,
    });
    log(`agent ${agent.id} (${agent.strategy}, ${paper ? "paper" : "live"}): ${outcome.reason}`);
    await deliverNotice(agent, outcome, deps);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`agent ${agent.id} tick failed: ${message}`);
    journal.append("error", { phase: "tick", message });
    await deps.store.record({
      telegram_id: agent.telegram_id,
      agent_id: agent.id,
      action: "tick",
      status: "error",
      error: message,
    });
  }
}

/** Refresh the cached daily PnL the risk engine reads for the daily-loss cap. */
export async function refreshDailyPnl(agent: Agent, deps: WorkerDeps): Promise<void> {
  const summary = await deps.store.pnlSummary(agent.telegram_id, 24);
  await deps.store.setAgentDailyPnl(agent.id, summary.realizedUsd);
}

/** Run one tick for every running agent. */
export async function tickAll(deps: WorkerDeps): Promise<void> {
  const agents = await deps.store.listRunningAgents();
  for (const agent of agents) {
    await refreshDailyPnl(agent, deps);
    await tickAgent(agent, deps);
  }
}

export { limitsOf };
