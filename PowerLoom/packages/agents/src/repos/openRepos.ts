import type { AgentDefinition } from "@agenttools/config";
import { createRepoTools, type ToolDefinition } from "@agenttools/runtime";
import type { AgentRunSession } from "../AgentRunSession";
import type { AgentDeps } from "../models/AgentDeps";
import type { OpenReposOptions } from "../models/OpenReposOptions";
import type { RepoAccess } from "../models/RepoAccess";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { numberOption } from "../stage";
import { agentRepos } from "./agentRepos";
import { createOpenRepoTool } from "./openRepoTool";

export const READ_REPOS_INTEGRATION = "readRepos";

// Read repositories (user decision 2026-10-13): one switch per agent in its Config. With it on, the run reads the repos
// attached to its task (the PBI's, the schedule's, the PR's, the docs project's), each one cloned or refreshed in the
// vault's cache and held until closeRepos. The tools read the cache's checkouts, or the run's own root (code review
// reads its PR checkout); they read other branches and commits too, and open_repo adds any repo of the vault's catalog,
// also when nothing is attached to the task (user decision 2026-10-14: the catalog is open to every agent with the switch).
export async function openRepos(context: TaskContext, session: AgentRunSession, sources: RepoSource[], options: OpenReposOptions = {}): Promise<RepoAccess> {
  const { deps, agent } = context;

  if (!isReadReposOn(agent)) {
    await session.phase("repos", { readRepos: false });

    return noRepos();
  }

  const repos = await agentRepos(deps.db, sources);

  await session.phase("repos", { asked: sources.flatMap((source) => source.names), repos: repos.map((repo) => repo.name) });

  const commits = await deps.repoCache.acquire(repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  const access: RepoAccess = { isOn: true, repos, commits, tools: [] };
  const names = repos.map((repo) => repo.name);
  const openRepo = await openRepoTool(context, session, access, names, sources[0]?.vault ?? options.vault, options.toolsRoot);

  if (names.length > 0 || openRepo) {
    access.tools = [...createRepoTools({ root: options.toolsRoot ?? deps.repoCache.root, repos: names, refs: deps.repoCache.refs }), ...(openRepo ? [openRepo] : [])];
  }

  return access;
}

// Not for a run that reads its own root (code review's PR checkout): an opened repo lands in the cache, not there.
async function openRepoTool(context: TaskContext, session: AgentRunSession, access: RepoAccess, names: string[], vault: string | undefined, toolsRoot?: string): Promise<ToolDefinition<any> | null> {
  if (toolsRoot || !vault) {
    return null;
  }

  return createOpenRepoTool(context, session, access, names, vault);
}

// Releases what openRepos took from the cache; a run that never opened its repos releases nothing.
export function closeRepos(deps: AgentDeps, access: RepoAccess): void {
  deps.repoCache.release(access.repos);
}

export function noRepos(): RepoAccess {
  return { isOn: false, repos: [], commits: {}, tools: [] };
}

export function isReadReposOn(agent: AgentDefinition): boolean {
  return agent.capabilities.integrations?.[READ_REPOS_INTEGRATION] === true;
}
