import { PgBoss } from "pg-boss";
import type { DispatchJob } from "./models/DispatchJob";
import type { TaskSchedule } from "./models/TaskSchedule";
import type { TaskScheduleJob } from "./models/TaskScheduleJob";

export const DISPATCH_QUEUE = "dispatch";
export const AGENT_RUN_QUEUE = "agent-run";
export const DRAFTS_QUEUE = "drafts";
// Sent only by the PBI page's "Load from Confluence" (no schedule).
export const CONFLUENCE_QUEUE = "confluence";
// Sent only by the refresh after an item changes (no schedule).
export const PBI_QUEUE = "pbi";
// Scheduled tasks (user decision 2026-10-03): one queue for every task schedule; each schedule is a pg-boss schedule
// keyed by its id, so a new schedule needs no new queue.
export const TASK_SCHEDULE_QUEUE = "task-schedule";

const DRAFTS_CRON = "*/10 * * * *";

const TICK_KEY = "tick";
const TICK_CRON = "* * * * *";

// Worker owns pg-boss maintenance and cron; the web only sends and schedules.
export function createWorkerBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url });
}

export function createSenderBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url, supervise: false, schedule: false, migrate: false });
}

// One agent run can take long (first clones, slow models): a long expiry, and no automatic retry, because a failed
// run already counted the attempt on its task and the dispatcher hands the task out again.
const AGENT_RUN_OPTIONS = { expireInSeconds: 4 * 60 * 60, retryLimit: 0 };

export async function ensureQueues(boss: PgBoss): Promise<void> {
  await ensureQueue(boss, DISPATCH_QUEUE, "standard");
  await ensureQueue(boss, AGENT_RUN_QUEUE, "standard", AGENT_RUN_OPTIONS);
  await ensureQueue(boss, DRAFTS_QUEUE, "exclusive");
  await ensureQueue(boss, CONFLUENCE_QUEUE, "standard");
  await ensureQueue(boss, PBI_QUEUE, "standard");
  await ensureQueue(boss, TASK_SCHEDULE_QUEUE, "standard");
}

// The dispatcher's every-minute tick keeps statuses, notes and hand-ons current between agent schedules.
export async function applyDispatchTick(boss: PgBoss): Promise<void> {
  const tick: DispatchJob = {};

  await boss.schedule(DISPATCH_QUEUE, TICK_CRON, tick, { key: TICK_KEY });
}

// The drafts job (user decision 2026-10-02): its own queue and schedule, the only reader of the draft folder.
export async function applyDraftsSchedule(boss: PgBoss): Promise<void> {
  await boss.schedule(DRAFTS_QUEUE, DRAFTS_CRON);
}

// A task schedule ticks on the shared queue under its own key; a disabled one only creates tasks on "Create now".
export async function applyTaskSchedule(boss: PgBoss, schedule: TaskSchedule): Promise<void> {
  if (!schedule.enabled) {
    await removeTaskSchedule(boss, schedule.id);

    return;
  }

  const job: TaskScheduleJob = { scheduleId: schedule.id };

  await boss.schedule(TASK_SCHEDULE_QUEUE, schedule.cron, job, { key: taskScheduleKey(schedule.id) });
}

export async function removeTaskSchedule(boss: PgBoss, scheduleId: number): Promise<void> {
  await boss.unschedule(TASK_SCHEDULE_QUEUE, taskScheduleKey(scheduleId));
}

// At worker start: every schedule as saved, and pg-boss schedules whose row is gone removed.
export async function applyTaskSchedules(boss: PgBoss, schedules: TaskSchedule[]): Promise<void> {
  const keys = new Set(schedules.map((schedule) => taskScheduleKey(schedule.id)));
  const orphans = (await boss.getSchedules(TASK_SCHEDULE_QUEUE)).filter((entry) => !keys.has(entry.key));

  for (const orphan of orphans) {
    await boss.unschedule(TASK_SCHEDULE_QUEUE, orphan.key);
  }

  for (const schedule of schedules) {
    await applyTaskSchedule(boss, schedule);
  }
}

function taskScheduleKey(scheduleId: number): string {
  return `schedule-${scheduleId}`;
}

// An agent's schedule sends a dispatch for that agent; a disabled agent or one without a schedule runs only on "Run now".
export async function applyAgentSchedule(boss: PgBoss, agentId: string, cron: string | null, enabled: boolean): Promise<void> {
  if (!enabled || !cron) {
    await boss.unschedule(DISPATCH_QUEUE, agentId);

    return;
  }

  const job: DispatchJob = { agentId };

  await boss.schedule(DISPATCH_QUEUE, cron, job, { key: agentId });
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
