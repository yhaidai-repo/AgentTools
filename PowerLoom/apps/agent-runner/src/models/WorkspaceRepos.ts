import type { RepoCache } from "@agenttools/runtime";

// The part of the repo cache a workspace needs.
export type WorkspaceRepos = Pick<RepoCache, "acquire" | "release" | "openBranchWorktree">;
