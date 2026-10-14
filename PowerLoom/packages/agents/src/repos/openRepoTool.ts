import { enabledRepos } from "@powerloom/core";
import { defineTool, type ToolDefinition } from "@agenttools/runtime";
import { z } from "zod";
import type { AgentRunSession } from "../AgentRunSession";
import type { RepoAccess } from "../models/RepoAccess";
import type { TaskContext } from "../models/TaskContext";
import { numberOption } from "../stage";
import { agentRepos } from "./agentRepos";

export const OPEN_REPO_TOOL = "open_repo";

// A clone of a big repo takes minutes, so a run opens only a few (the agent's maxOpenedRepos option).
const DEFAULT_MAX_OPENED = 3;

// open_repo: the answer is in code the task's repos don't hold (another code area, a shared library, the caller of an
// API). The repo comes from the vault's catalog of enabled repos and is held like the task's repos until closeRepos.
export async function createOpenRepoTool(context: TaskContext, session: AgentRunSession, access: RepoAccess, names: string[], vault: string): Promise<ToolDefinition<any>> {
  const catalog = (await enabledRepos(context.deps.db, vault)).map((row) => row.name);
  const maxOpened = numberOption(context.agent, "maxOpenedRepos", DEFAULT_MAX_OPENED);
  let opened = 0;

  return defineTool({
    name: OPEN_REPO_TOOL,
    description: `Add a repo of the catalog to your code tools when the answer is in code your task's repos don't hold (at most ${maxOpened} per run). Catalog: ${catalog.join(", ") || "none"}.`,
    input: { name: z.string().min(1).describe("The repo's name as the catalog lists it") },
    handler: async ({ name }) => {
      const [repo] = await agentRepos(context.deps.db, [{ vault, names: [name] }]);

      if (!repo) {
        return { text: `"${name}" is not an enabled repo in the catalog. Catalog: ${catalog.join(", ") || "none"}.`, isError: true };
      }

      if (names.includes(repo.name)) {
        return { text: `${repo.name} is already in your code tools.` };
      }

      if (opened >= maxOpened) {
        return { text: `At most ${maxOpened} repos per run; say in your result what is left to read in ${repo.name}.`, isError: true };
      }

      const commits = await context.deps.repoCache.acquire([repo], (progress) => session.phase("repo", { ...progress, opened: true }), numberOption(context.agent, "repoRefreshMinutes", 30));

      opened++;
      access.repos.push(repo);
      access.commits[repo.name] = commits[repo.name];
      names.push(repo.name);

      return { text: `Opened ${repo.name} @ ${commits[repo.name].slice(0, 10)} (branch ${repo.defaultBranch}); its paths start with '${repo.name}/'.` };
    },
  });
}
