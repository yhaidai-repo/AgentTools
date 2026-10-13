import type { RepoAccess } from "../models/RepoAccess";

// The first message's <repos>: the repos the agent may read, at the commit it reads, or why it has none.
export function reposBlock(access: RepoAccess): string {
  return ["<repos>", ...repoLines(access), "</repos>"].join("\n");
}

function repoLines(access: RepoAccess): string[] {
  if (!access.isOn) {
    return ["none: Read repositories is off for this agent, so it has no code tools."];
  }

  if (access.repos.length === 0) {
    return ["none: no enabled repository is attached to this task."];
  }

  return access.repos.map((repo) => `- ${repo.name} @ ${access.commits[repo.name]?.slice(0, 10) ?? "?"} (branch ${repo.defaultBranch})`);
}
