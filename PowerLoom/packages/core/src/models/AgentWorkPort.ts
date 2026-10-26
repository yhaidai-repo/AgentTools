import type { Outcome } from "./Outcome";

// An agent's prompt history (PowerLoom's table; the definitions stay the AgentConfig module's).
export interface AgentWorkPort {
  // One saved version of an agent's prompt, or of the shared framework's.
  addPromptVersion(agentId: string, version: number, text: string): Promise<Outcome<number>>;
  // A deleted agent takes its prompt history with it.
  deletePromptVersions(agentId: string): Promise<Outcome<string>>;
}
