import type { AgentWorkspace } from "@agenttools/runtime";

// What a planning run prepares once: the PBI context (its first message and .planning/PBI.md), the worktree it plans in
// and the PBI's content hash the context was built from.
export interface PreparedPlanning {
  context: string;
  workspace: AgentWorkspace | null;
  pbiContentHash: string;
}
