// The scheduler: what decides WHEN an agent ticks.
//
// Two implementations behind one interface.
//
//   * With REDIS_URL, BullMQ. The queue survives a restart, and a repeatable job
//     fans out to per-agent ticks so one slow agent cannot delay the others.
//   * Without it, an in-process interval. Honest for a single-process deployment
//     or a first run, and it keeps the project runnable on a machine with no
//     Redis at all.
//
// The tick itself is identical in both, because both call `tickAgent`.

import { Queue, Worker as BullWorker, type Job } from "bullmq";
import IORedis from "ioredis";
import { tickAgent, tickAll, refreshDailyPnl, type WorkerDeps } from "./tick.js";

export interface Scheduler {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface SchedulerOptions {
  deps: WorkerDeps;
  redisUrl?: string;
  /** How often to look for work, in milliseconds. */
  intervalMs: number;
  log: (line: string) => void;
}

export function createScheduler(opts: SchedulerOptions): Scheduler {
  return opts.redisUrl ? new BullScheduler(opts) : new IntervalScheduler(opts);
}

/** No Redis: a plain interval in this process. */
class IntervalScheduler implements Scheduler {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly opts: SchedulerOptions) {}

  async start(): Promise<void> {
    this.opts.log(`scheduler: in-process interval every ${this.opts.intervalMs}ms (no REDIS_URL)`);
    const run = async () => {
      // Skip a tick that overlaps the previous one, so a slow venue read cannot
      // pile up overlapping cycles for the same agent.
      if (this.running) return;
      this.running = true;
      try {
        await tickAll(this.opts.deps);
      } catch (err) {
        this.opts.log(`scheduler: cycle failed: ${(err as Error).message}`);
      } finally {
        this.running = false;
      }
    };
    await run();
    this.timer = setInterval(run, this.opts.intervalMs);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}

const QUEUE = "dreampilot-agents";

/** With Redis: a repeatable fan-out job and a worker pool. */
class BullScheduler implements Scheduler {
  private connection: IORedis;
  private queue: Queue;
  private worker?: BullWorker;

  constructor(private readonly opts: SchedulerOptions) {
    this.connection = new IORedis(opts.redisUrl!, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE, { connection: this.connection });
  }

  async start(): Promise<void> {
    this.opts.log(`scheduler: BullMQ on ${this.redact(this.opts.redisUrl!)} every ${this.opts.intervalMs}ms`);

    // One repeatable job that fans out: it lists the running agents and enqueues
    // a tick for each, so the per-agent work is retried independently.
    await this.queue.add(
      "fanout",
      {},
      {
        repeat: { every: this.opts.intervalMs },
        removeOnComplete: 50,
        removeOnFail: 100,
        jobId: "fanout",
      },
    );

    this.worker = new BullWorker(
      QUEUE,
      async (job: Job) => {
        const deps = this.opts.deps;
        if (job.name === "fanout") {
          const agents = await deps.store.listRunningAgents();
          for (const agent of agents) {
            await this.queue.add("tick", { agentId: agent.id }, { removeOnComplete: 50, removeOnFail: 100 });
          }
          return;
        }
        const agentId = Number(job.data?.agentId);
        const agent = await deps.store.getAgent(agentId);
        if (!agent || agent.status !== "running") return;
        await refreshDailyPnl(agent, deps);
        await tickAgent(agent, deps);
      },
      { connection: this.connection, concurrency: 4 },
    );

    this.worker.on("failed", (job, err) => {
      this.opts.log(`scheduler: job ${job?.name} failed: ${err.message}`);
    });
  }

  async stop(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }

  private redact(url: string): string {
    try {
      const u = new URL(url);
      if (u.password) u.password = "***";
      return u.toString();
    } catch {
      return "redis";
    }
  }
}
