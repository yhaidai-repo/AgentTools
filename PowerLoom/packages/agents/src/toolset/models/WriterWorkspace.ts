import type { AgentWorkspace, ToolPolicy } from "@agenttools/runtime";

// A writer's own worktree for its run (the runner prepares it as the run starts) and the policy every tool call of the
// run passes there.
export interface WriterWorkspace {
  workspace: AgentWorkspace;
  toolPolicy: ToolPolicy;
}
