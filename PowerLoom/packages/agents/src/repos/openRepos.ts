import type { AgentDefinition } from "@agenttools/config";
import { createRepoTools } from "@agenttools/runtime";
import type { AgentRunSession } from "../AgentRunSession";
import type { AgentDeps } from "../models/AgentDeps";
import type { RepoAccess } from "../models/RepoAccess";
import type { RepoSource } from "../models/RepoSource";
import type { TaskContext } from "../models/TaskContext";
import { numberOption } from "../stage";
import { agentRepos } from "./agentRepos";

export const READ_REPOS_INTEGRATION = "readRepos";

// Read repositories (user decision 2026-10-13): one switch per agent in its Config. With it on, the run reads the repos
// attached to its task (the PBI's, the schedule's, the PR's, the docs project's), each one cloned or refreshed in the
// vault's cache and held until closeRepos. The tools read the cache's checkouts, or the run's own root (code review
// reads its PR checkout).
export async function openRepos(context: TaskContext, session: AgentRunSession, sources: RepoSource[], toolsRoot?: string): Promise<RepoAccess> {
  const { deps, agent } = context;

  if (!isReadReposOn(agent)) {
    await session.phase("repos", { readRepos: false });

    return noRepos();
  }

  const repos = await agentRepos(deps.db, sources);

  await session.phase("repos", { asked: sources.flatMap((source) => source.names), repos: repos.map((repo) => repo.name) });

  const commits = await deps.repoCache.acquire(repos, (progress) => session.phase("repo", { ...progress }), numberOption(agent, "repoRefreshMinutes", 30));
  const tools = repos.length > 0 ? createRepoTools({ root: toolsRoot ?? deps.repoCache.root, repos: repos.map((repo) => repo.name) }) : [];

  return { isOn: true, repos, commits, tools };
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
