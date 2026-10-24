import { AGENT_TASK_TYPES, CREATABLE_TASK_TYPES, USER_TASK_TYPES, customTaskTypes } from "@powerloom/core";
import type { TaskTypeChoices } from "@/models/TaskTypeChoices";
import { getAgentConfig } from "./agentConfig";

// The task types the pages offer: the built-in ones plus every custom type an agent handles (user decision 2026-10-24).
export async function taskTypeChoices(): Promise<TaskTypeChoices> {
  const custom = await loadCustomTaskTypes();

  return { agent: [...AGENT_TASK_TYPES, ...custom], creatable: [...CREATABLE_TASK_TYPES, ...custom] };
}

// What the user may create on the Tasks page and schedule.
export async function userTaskTypes(): Promise<string[]> {
  return [...USER_TASK_TYPES, ...(await loadCustomTaskTypes())];
}

export async function loadCustomTaskTypes(): Promise<string[]> {
  return customTaskTypes(await getAgentConfig().list());
}
