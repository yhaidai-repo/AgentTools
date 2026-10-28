import type { AgentRequest } from "@agenttools/runtime";

// A request ready to run in its workspace; `release` gives the repo back when the run ends (the worktree stays).
export interface ResolvedWorkspace {
  request: AgentRequest;
  release: () => void;
}
