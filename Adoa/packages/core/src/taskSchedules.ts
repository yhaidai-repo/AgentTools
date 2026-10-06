import { localItem, taskSchedule, type AdoaDb } from "@adoa/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { nextGlobalItemId } from "./localItemIds";
import type { Outcome } from "./models/Outcome";
import type { ProducedTask } from "./models/ProducedTask";
import type { ProducerParamSpec } from "./models/ProducerParamSpec";
import type { TaskProducer } from "./models/TaskProducer";
import type { TaskSchedule } from "./models/TaskSchedule";
import type { TaskScheduleInput } from "./models/TaskScheduleInput";
import { producerFor } from "./taskProducers/taskProducers";
import { goalParams, goalParamsProblem, insertGoalTask } from "./goalSchedules";

// Blocked counts too: a new task would fail the same way, so the user decides (Rerun or delete) first.
const WAITING = ["open", "in-progress", "blocked"] as const;

export async function listTaskSchedules(db: AdoaDb): Promise<TaskSchedule[]> {
  return db.select().from(taskSchedule).orderBy(asc(taskSchedule.name), asc(taskSchedule.id));
}

// The selected vault's schedules (the Tasks page and the Maintenance tab show one vault, 2026-10-06).
export async function listVaultTaskSchedules(db: AdoaDb, vault: string): Promise<TaskSchedule[]> {
  return db.select().from(taskSchedule).where(eq(taskSchedule.vault, vault)).orderBy(asc(taskSchedule.name), asc(taskSchedule.id));
}

export async function readTaskSchedule(db: AdoaDb, id: number): Promise<TaskSchedule | null> {
  const [row] = await db.select().from(taskSchedule).where(eq(taskSchedule.id, id));

  return row ?? null;
}

// An agent with a task producer takes the producer's params; any other agent takes a goal and the vault's repos (user
// decision 2026-10-06).
export async function saveTaskSchedule(db: AdoaDb, input: TaskScheduleInput): Promise<Outcome<TaskSchedule>> {
  const producer = producerFor(input.agentId);
  const problem = !input.name.trim() ? "A schedule needs a name." : producer ? await paramsProblem(producer, input.params) : await goalParamsProblem(db, input.vault, goalParams(input.params));

  if (problem) {
    return { ok: false, error: problem };
  }

  const params = producer ? producerParams(producer, input.params) : { ...goalParams(input.params) };
  const values = { name: input.name.trim(), agentId: input.agentId, vault: input.vault, cron: input.cron.trim(), enabled: input.enabled, params };
  const [row] = input.id === null
    ? await db.insert(taskSchedule).values(values).returning()
    : await db.update(taskSchedule).set({ ...values, updatedAt: new Date() }).where(eq(taskSchedule.id, input.id)).returning();

  return row ? { ok: true, value: row } : { ok: false, error: `Schedule ${input.id} doesn't exist any more.` };
}

export async function deleteTaskSchedule(db: AdoaDb, id: number): Promise<void> {
  await db.delete(taskSchedule).where(eq(taskSchedule.id, id));
}

// One tick: the schedule's task, only when needed (user decision 2026-10-03): none of its tasks waits, and the producer
// says there is work. "Create now" forces it past the producer's check (user decision 2026-10-03), never past a waiting
// task. Returns what happened, also kept on the schedule for the Tasks page.
export async function createScheduledTask(db: AdoaDb, schedule: TaskSchedule, agentOptions: Record<string, unknown>, force = false): Promise<string> {
  const result = await tickResult(db, schedule, agentOptions, force);

  await db.update(taskSchedule).set({ lastRunAt: new Date(), lastResult: result }).where(eq(taskSchedule.id, schedule.id));

  return result;
}

async function tickResult(db: AdoaDb, schedule: TaskSchedule, agentOptions: Record<string, unknown>, force: boolean): Promise<string> {
  const producer = producerFor(schedule.agentId);
  const waiting = await waitingTaskId(db, schedule.id);

  if (waiting) {
    return `${waiting} still waits; no new task`;
  }

  // A goal task is always wanted when none waits; the agent's result says what it found.
  if (!producer) {
    return `${await insertGoalTask(db, schedule)} created`;
  }

  const produced = await producer.produce({ db, vault: schedule.vault, agentOptions }, schedule.params);

  if (!produced.ok) {
    return `no task: ${produced.error}`;
  }

  const skipReason = force ? null : produced.value.notNeeded;

  return skipReason ? `no task: ${skipReason}` : `${await insertTask(db, schedule, producer, produced.value)} created`;
}

async function waitingTaskId(db: AdoaDb, scheduleId: number): Promise<string | null> {
  const [task] = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(sql`(${localItem.data}->>'scheduleId')::int = ${scheduleId}`, inArray(localItem.status, [...WAITING])))
    .limit(1);

  return task?.id ?? null;
}

async function insertTask(db: AdoaDb, schedule: TaskSchedule, producer: TaskProducer, task: ProducedTask): Promise<string> {
  const id = await nextGlobalItemId(db, producer.prefix);

  await db.insert(localItem).values({
    id,
    kind: producer.kind,
    pbiId: null,
    title: task.title.slice(0, 120),
    status: "open",
    assignee: `agent:${schedule.agentId}`,
    vault: schedule.vault,
    body: task.body,
    data: { ...task.data, scheduleId: schedule.id, key: `schedule:${schedule.id}:${new Date().toISOString()}` },
  });

  return id;
}

// The form sends every field; a producer keeps only its own parameters.
function producerParams(producer: TaskProducer, params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(producer.params.filter((spec) => spec.key in params).map((spec) => [spec.key, params[spec.key]]));
}

async function paramsProblem(producer: TaskProducer, params: Record<string, unknown>): Promise<string | null> {
  const own = producerParams(producer, params);
  const problems = await Promise.all(producer.params.map((spec) => paramProblem(spec, own[spec.key])));

  return problems.find(Boolean) ?? null;
}

async function paramProblem(spec: ProducerParamSpec, value: unknown): Promise<string | null> {
  const values = Array.isArray(value) ? value.map(String) : [];

  if (values.length === 0) {
    return `${spec.label}: choose at least one.`;
  }

  const offered = await spec.choices();
  const invalid = values.filter((entry) => !offered.includes(entry));

  return invalid.length > 0 ? `${spec.label}: ${invalid.join(", ")} not offered.` : null;
}
