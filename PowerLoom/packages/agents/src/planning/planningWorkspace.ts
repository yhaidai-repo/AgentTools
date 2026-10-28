import type { AgentWorkspace, GsdSeed, RepoRef } from "@agenttools/runtime";
import type { PowerLoomDb, workItem } from "@powerloom/db";
import { agentRepos, pbiRepoSources } from "../repos/agentRepos";

type PbiRow = typeof workItem.$inferSelect;

// The PBI branch planning and implementation share (one worktree per repo and branch); a child item (a bug of the PBI)
// is planned and fixed on its parent's branch.
export function pbiBranch(pbi: Pick<PbiRow, "adoId" | "parentId">): string {
  return `powerloom/pbi-${pbi.parentId ?? pbi.adoId}`;
}

// The PBI worktree a planning run works in: the PBI's first enabled repo, on the PBI branch from that repo's default
// branch, prepared for GSD with the run's seed. Null when the PBI has no enabled repo: there is nothing to plan in.
export async function planningWorkspace(db: PowerLoomDb, pbi: PbiRow, seed: GsdSeed): Promise<AgentWorkspace | null> {
  const [first] = await agentRepos(db, await pbiRepoSources(db, pbi.adoId));

  if (!first) {
    return null;
  }

  const repo: RepoRef = { name: first.name, remoteUrl: first.remoteUrl, defaultBranch: first.defaultBranch };

  return { repo, branch: pbiBranch(pbi), baseBranch: repo.defaultBranch, gsd: true, gsdSeed: seed };
}

// What the first message says about the worktree, so the agent knows where GSD runs, or that it can't.
export function workspaceBlock(workspace: AgentWorkspace | null): string {
  if (!workspace) {
    return "<planning-workspace>none: the PBI has no enabled repo, so GSD can't run. Hand off a question to a person naming the repo to plan in.</planning-workspace>";
  }

  return [
    "<planning-workspace>",
    `Repo: ${workspace.repo.name}`,
    `Branch: ${workspace.branch} (from ${workspace.baseBranch})`,
    "Your working folder is this branch's worktree. GSD is installed there; .planning/config.json and .planning/PBI.md are written for this run.",
    "</planning-workspace>",
  ].join("\n");
}
