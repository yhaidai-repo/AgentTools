import { createScheduledTask, readTaskSchedule } from "@adoa/core";
import type { WorkerContext } from "../models/WorkerContext";

// One schedule tick or "Create now": the target agent's Config options go to its producer (e.g. the vault review's
// staleDays), so the "needed?" check matches what the agent's own tools will list.
export async function runScheduledTask(context: WorkerContext, scheduleId: number): Promise<string> {
  const schedule = await readTaskSchedule(context.db, scheduleId);

  if (!schedule) {
    return "the schedule was deleted";
  }

  const agent = await context.config.get(schedule.agentId);

  return createScheduledTask(context.db, schedule, agent?.options ?? {});
}
