import { TASK_PRODUCERS, goalParams, type TaskSchedule } from "@powerloom/core";
import type { AgentChoice } from "@/models/AgentChoice";
import type { ScheduleFormValues } from "@/models/ScheduleFormValues";
import { getAgentConfig } from "./agentConfig";

const DEFAULT_CRON = "0 */6 * * *";

// The agents the schedule form offers (user decision 2026-10-06: any configured agent, with a goal on the vault's repos),
// without those whose tasks are a vault's maintenance (the vault review, added on the Vault page). `editing` keeps the
// agent of an existing schedule, so its page still shows it.
export async function agentChoices(editing?: string): Promise<AgentChoice[]> {
  const maintenance = new Set(TASK_PRODUCERS.filter((producer) => producer.maintenance).map((producer) => producer.agentId));
  const agents = await getAgentConfig().list();

  const producers = new Set(TASK_PRODUCERS.map((producer) => producer.agentId));

  return agents.filter((agent) => !maintenance.has(agent.id) || agent.id === editing).map((agent) => ({ id: agent.id, label: agent.label, takesGoal: !producers.has(agent.id) }));
}

export function newScheduleValues(agents: AgentChoice[]): ScheduleFormValues {
  return { id: null, name: "", agentId: agents[0]?.id ?? "", cron: DEFAULT_CRON, enabled: true, goal: "", repos: [] };
}

export function scheduleValues(schedule: TaskSchedule): ScheduleFormValues {
  const params = goalParams(schedule.params);

  return { id: schedule.id, name: schedule.name, agentId: schedule.agentId, cron: schedule.cron, enabled: schedule.enabled, goal: params.goal, repos: params.repos };
}
