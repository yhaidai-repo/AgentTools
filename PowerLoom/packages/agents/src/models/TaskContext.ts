import type { AgentDefinition, AgentsGlobal } from "@agenttools/config";
import type { AgentDeps } from "./AgentDeps";
import type { LoadedPrompt } from "./LoadedPrompt";
import type { StageSkills } from "./StageSkills";

// Everything an agent's executor needs for one task.
export interface TaskContext {
  deps: AgentDeps;
  agent: AgentDefinition;
  global: AgentsGlobal;
  prompt: LoadedPrompt;
  skills: StageSkills;
}
