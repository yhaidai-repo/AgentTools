import { DEMONSTRATION_LABEL } from "../demonstrations/request";
import { AGENT_TASK_TYPES } from "../agentStages";

// A task type's name: what `handles` and `canAssign` list, and what a task's kind is.
export const TASK_TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;

// The task types agents made in the UI added (user decision 2026-10-24): every type an agent handles that the built-in
// list doesn't name. Tasks of these types are created and routed like the built-in ones.
export function customTaskTypes(agents: { handles: string[] }[]): string[] {
  const types = agents.flatMap((agent) => agent.handles).filter((type) => !AGENT_TASK_TYPES.includes(type));

  return [...new Set(types)].sort();
}

export function isCustomTaskType(type: string): boolean {
  return TASK_TYPE_PATTERN.test(type) && !AGENT_TASK_TYPES.includes(type);
}

// "security-review" → "Security review": how a custom type's results and tasks are titled.
export function taskTypeTitle(type: string): string {
  if (type === "demonstration") return DEMONSTRATION_LABEL;
  const words = type.replace(/-/g, " ");

  return words.charAt(0).toUpperCase() + words.slice(1);
}
