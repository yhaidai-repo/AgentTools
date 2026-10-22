import type { AgentDefinition } from "./models/AgentDefinition";

// Only agents created in the UI can be deleted; the ones shipped in code come back with the next ensureDefaults anyway.
export function isRemovable(agent: Pick<AgentDefinition, "origin">): boolean {
  return agent.origin === "user";
}
