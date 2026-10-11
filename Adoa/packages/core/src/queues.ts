import { PgBoss } from "pg-boss";
import type { DispatchJob } from "./models/DispatchJob";

export const DISPATCH_QUEUE = "dispatch";
// Sent only by the refresh after an item changes (no schedule).
export const PBI_QUEUE = "pbi";

const TICK_KEY = "tick";
const TICK_CRON = "* * * * *";

// Worker owns pg-boss maintenance and cron; the web only sends and schedules.
export function createWorkerBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url });
}

export function createSenderBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url, supervise: false, schedule: false, migrate: false });
}

export async function ensureQueues(boss: PgBoss): Promise<void> {
  await ensureQueue(boss, DISPATCH_QUEUE, "standard");
  await ensureQueue(boss, PBI_QUEUE, "standard");
}

// The dispatcher's every-minute tick keeps statuses, notes and hand-ons current between agent schedules.
export async function applyDispatchTick(boss: PgBoss): Promise<void> {
  const tick: DispatchJob = {};

  await boss.schedule(DISPATCH_QUEUE, TICK_CRON, tick, { key: TICK_KEY });
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
