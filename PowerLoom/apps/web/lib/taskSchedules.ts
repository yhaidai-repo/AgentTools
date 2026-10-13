import { TASK_PRODUCERS, goalParams, type TaskSchedule } from "@powerloom/core";
import type { AgentChoice } from "@/models/AgentChoice";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import type { TaskFormValues } from "@/models/TaskFormValues";
import { getAgentConfig } from "./agentConfig";

// The agents the schedule form offers (user decision 2026-10-06: any configured agent, with a goal on the vault's repos),
// without those whose tasks are a vault's maintenance (the vault review, added on the Vault page). `editing` keeps the
// agent of an existing schedule, so its page still shows it.
export async function agentChoices(editing?: string): Promise<AgentChoice[]> {
  const maintenance = new Set(TASK_PRODUCERS.filter((producer) => producer.maintenance).map((producer) => producer.agentId));
  const agents = await getAgentConfig().list();

  const producers = new Set(TASK_PRODUCERS.map((producer) => producer.agentId));

  return agents.filter((agent) => !maintenance.has(agent.id) || agent.id === editing).map((agent) => ({ id: agent.id, label: agent.label, takesGoal: !producers.has(agent.id) }));
}

export function scheduleValues(schedule: TaskSchedule): ScheduleFormValues {
  const params = goalParams(schedule.params);

  return { id: schedule.id, name: schedule.name, agentId: schedule.agentId, cron: schedule.cron, enabled: schedule.enabled, goal: params.goal, repos: params.repos };
}

// A new task: one task now, or a schedule once a cron is filled in.
export const NEW_TASK_VALUES: TaskFormValues = { type: "research", title: "", description: "", acceptanceCriteria: "", pbi: "", repos: [], docPath: "", scheduleId: null, cron: "", enabled: true };

// A schedule by task type (user decision 2026-10-14): PowerLoom's TaskParams in `params`, the task's title as its name.
export function taskScheduleValues(schedule: TaskSchedule): TaskFormValues {
  const params = schedule.params as { description?: string; acceptanceCriteria?: string; pbiId?: number | null; repos?: string[]; docPath?: string | null };

  return {
    type: schedule.taskType ?? "",
    title: schedule.name,
    description: params.description ?? "",
    acceptanceCriteria: params.acceptanceCriteria ?? "",
    pbi: params.pbiId ? String(params.pbiId) : "",
    repos: params.repos ?? [],
    docPath: params.docPath ?? "",
    scheduleId: schedule.id,
    cron: schedule.cron,
    enabled: schedule.enabled,
  };
}
