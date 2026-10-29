import type { AgentDefinition } from "./AgentDefinition";

// A system agent as a start stores it, and the code-owned fields whose stored value the shipped one replaced.
export interface SystemAgentRefresh {
  agent: AgentDefinition;
  replaced: string[];
}
