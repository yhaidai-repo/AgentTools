import type { TaskSchedule } from "@powerloom/core";
import type { TaskFormValues } from "@/models/TaskFormValues";

// A new task: one task now, or a schedule once a cron is filled in.
export const NEW_TASK_VALUES: TaskFormValues = { type: "research", title: "", description: "", acceptanceCriteria: "", pbi: "", repos: [], scheduleId: null, cron: "", enabled: true };

// A schedule by task type (user decision 2026-10-14): PowerLoom's TaskParams in `params`, the task's title as its name.
export function taskScheduleValues(schedule: TaskSchedule): TaskFormValues {
  const params = schedule.params as { description?: string; acceptanceCriteria?: string; pbiId?: number | null; repos?: string[] };

  return {
    type: schedule.taskType ?? "",
    title: schedule.name,
    description: params.description ?? "",
    acceptanceCriteria: params.acceptanceCriteria ?? "",
    pbi: params.pbiId ? String(params.pbiId) : "",
    repos: params.repos ?? [],
    scheduleId: schedule.id,
    cron: schedule.cron,
    enabled: schedule.enabled,
  };
}
