import type { AgentDefinition } from "./models/AgentDefinition";
import type { AgentsGlobal } from "./models/AgentsGlobal";
import type { SystemAgentRefresh } from "./models/SystemAgentRefresh";

// Every skill a system agent ships with, to tell a user's own skill from a shipped one.
export function shippedSkillNames(agents: AgentDefinition[]): ReadonlySet<string> {
  return new Set(agents.flatMap((agent) => agent.skills));
}

// One line per start that changed a stored agent; a start that changes nothing logs nothing.
export function logRefresh(refresh: SystemAgentRefresh): void {
  if (refresh.replaced.length === 0) {
    return;
  }

  console.info(`Agent ${refresh.agent.id} takes the shipped ${refresh.replaced.join(", ")} (the stored values differed; an edited prompt stays in its history).`);
}

export function logFrameworkRefresh(stored: Partial<AgentsGlobal> | null, merged: AgentsGlobal): void {
  if (!stored?.framework || merged.framework) {
    return;
  }

  console.info("The agents take the shipped framework again: the code ships a new one (the edited framework stays in its history).");
}
