import { PgBoss } from "pg-boss";

export const SYNC_QUEUE = "sync";
export const PREPARE_QUEUE = "prepare";

// Worker owns pg-boss maintenance and cron; the web only sends and schedules.
export function createWorkerBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url });
}

export function createSenderBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url, supervise: false, schedule: false, migrate: false });
}

export async function ensureQueues(boss: PgBoss): Promise<void> {
  // exclusive: at most one sync queued or running, so "sync now" can't pile up.
  await ensureQueue(boss, SYNC_QUEUE, "exclusive");
  await ensureQueue(boss, PREPARE_QUEUE, "standard");
}

export async function applySyncSchedule(boss: PgBoss, cron: string): Promise<void> {
  await boss.schedule(SYNC_QUEUE, cron);
}

async function ensureQueue(boss: PgBoss, name: string, policy: "exclusive" | "standard"): Promise<void> {
  const existing = await boss.getQueue(name);

  if (existing) {
    return;
  }

  await boss.createQueue(name, { policy });
}
