import type { AgentWorkspace } from "@agenttools/runtime";

// What a planning run prepares once: the PBI context (its first message and .planning/PBI.md) and the worktree it plans in.
export interface PreparedPlanning {
  context: string;
  workspace: AgentWorkspace | null;
}
