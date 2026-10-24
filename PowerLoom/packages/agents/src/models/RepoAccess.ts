import type { RepoRef, ToolDefinition } from "@agenttools/runtime";

// What one run may read of the code: the repos it took from the cache, their commits and the tools that read them.
// `isOn` is the agent's Read repositories switch; when it is off the run has no repos and no tools.
export interface RepoAccess {
  isOn: boolean;
  repos: RepoRef[];
  commits: Record<string, string>;
  tools: ToolDefinition<any>[];
}
