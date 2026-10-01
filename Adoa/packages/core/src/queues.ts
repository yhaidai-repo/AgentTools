import { PgBoss } from "pg-boss";

export const SYNC_QUEUE = "sync";
export const PREPARE_QUEUE = "prepare";
export const REFINEMENT_QUEUE = "refinement";
export const RESEARCH_QUEUE = "research";
export const RENDER_QUEUE = "render";

// Worker owns pg-boss maintenance and cron; the web only sends and schedules.
export function createWorkerBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url });
}

export function createSenderBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url, supervise: false, schedule: false, migrate: false });
}

// Agent batches can run for hours (several runs, first clones): a long expiry, and no automatic retry,
// because a failed batch already recorded its failures and the next scheduled run picks the work up.
const AGENT_QUEUE_OPTIONS = { expireInSeconds: 4 * 60 * 60, retryLimit: 0 };

export async function ensureQueues(boss: PgBoss): Promise<void> {
  // exclusive: at most one queued or running, so "run now" can't pile up.
  await ensureQueue(boss, SYNC_QUEUE, "exclusive");
  await ensureQueue(boss, PREPARE_QUEUE, "standard");
  await ensureQueue(boss, RENDER_QUEUE, "standard");
  await ensureQueue(boss, REFINEMENT_QUEUE, "exclusive", AGENT_QUEUE_OPTIONS);
  await ensureQueue(boss, RESEARCH_QUEUE, "exclusive", AGENT_QUEUE_OPTIONS);
}

export async function applySyncSchedule(boss: PgBoss, cron: string): Promise<void> {
  await boss.schedule(SYNC_QUEUE, cron);
}

// Agent queues are named after the agent id; a disabled agent or one without a schedule runs only on demand.
export async function applyAgentSchedule(boss: PgBoss, agentId: string, cron: string | null, enabled: boolean): Promise<void> {
  if (!enabled || !cron) {
    await boss.unschedule(agentId);

    return;
  }

  await boss.schedule(agentId, cron);
}

async function ensureQueue(boss: PgBoss, name: string, policy: "exclusive" | "standard", options: { expireInSeconds?: number; retryLimit?: number } = {}): Promise<void> {
  const existing = await boss.getQueue(name);

  const hasOptions = Object.keys(options).length > 0;

  if (existing && hasOptions) {
    await boss.updateQueue(name, options);
  }

  if (existing) {
    return;
  }

  await boss.createQueue(name, { policy, ...options });
}
